// ============================================
// Doctor Controller - Profile Management Logic
// ============================================
// This handles everything related to doctor profiles:
// - A doctor updating their own profile (specialization, bio, fee, etc.)
// - Anyone viewing a list of all doctors
// - Anyone viewing a single doctor's full profile
//
// CRUD = Create, Read, Update, Delete
// We already "Create" doctors during registration (authController).
// Here we focus on Read and Update.

const User = require('../models/User');
const { formatIndianPhone } = require('../utils/formatPhone');

// ============================================
// GET ALL DOCTORS - Public (anyone can browse)
// ============================================
// Endpoint: GET /api/doctors
// Optional query params: ?specialization=Cardiologist&page=1&limit=10
//
// This is what patients use to BROWSE available doctors.

const getAllDoctors = async (req, res) => {
  try {
    // ---- Build a filter object ----
    // Show verified doctors and legacy doctors (who don't have isVerified field yet)
    const filter = { role: 'doctor', isVerified: { $ne: false } };

    // If the user added ?specialization=something in the URL, filter by it
    // Example: /api/doctors?specialization=Cardiologist
    if (req.query.specialization) {
      // "new RegExp(..., 'i')" creates a case-insensitive search
      // So "cardio" matches "Cardiologist", "Cardiology", etc.
      filter.specialization = new RegExp(req.query.specialization, 'i');
    }

    // If filtering by name (search)
    if (req.query.name) {
      filter.name = new RegExp(req.query.name, 'i');
    }

    // Filter by max consultation fee
    if (req.query.maxFee) {
      filter.consultationFee = { $lte: Number(req.query.maxFee) };
    }

    // Filter by consultation type availability (doctors who offer video/phone)
    // This is implicit — all doctors can offer any type, but we can filter by fee range

    // Filter by "available today"
    if (req.query.availableToday === 'true') {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const today = dayNames[new Date().getDay()];
      filter['availability.day'] = today;
    }

    // ---- Pagination ----
    // We don't want to return ALL doctors at once (could be thousands!)
    // Instead, we return "pages" of results (like Google search results)
    const page = parseInt(req.query.page) || 1;
    // parseInt converts string "2" to number 2. Default to page 1.

    const limit = parseInt(req.query.limit) || 10;
    // How many doctors per page. Default 10.

    const skip = (page - 1) * limit;
    // Page 1: skip 0 (show items 1-10)
    // Page 2: skip 10 (show items 11-20)
    // Page 3: skip 20 (show items 21-30)

    // ---- Query the database ----
    const doctors = await User.find(filter)
      .select('-password')
      // ^ Exclude passwords from results (security!)
      .skip(skip)
      // ^ Skip this many results (for pagination)
      .limit(limit)
      // ^ Only return this many results
      .sort({ createdAt: -1 });
      // ^ Sort by newest first (-1 = descending order)

    // Get total count (for frontend to know how many pages exist)
    const total = await User.countDocuments(filter);

    // ---- Send response ----
    res.json({
      doctors,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        // Math.ceil rounds UP: 23 doctors / 10 per page = 2.3 → 3 pages
        totalDoctors: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get all doctors error:', error.message);
    res.status(500).json({
      message: 'Error fetching doctors list'
    });
  }
};

// ============================================
// GET SINGLE DOCTOR - Public (view full profile)
// ============================================
// Endpoint: GET /api/doctors/:id
// ":id" is a URL parameter — the actual doctor's database ID
// Example: GET /api/doctors/65a1b2c3d4e5f6789...

const getDoctorById = async (req, res) => {
  try {
    // req.params.id = the ":id" part from the URL
    const doctor = await User.findOne({
      _id: req.params.id,
      role: 'doctor'
      // Make sure we're fetching a doctor, not a patient
    }).select('-password');

    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }

    res.json({ doctor });

  } catch (error) {
    // If the ID format is wrong (not a valid MongoDB ObjectId), this catches it
    if (error.kind === 'ObjectId') {
      return res.status(400).json({
        message: 'Invalid doctor ID format'
      });
    }
    console.error('Get doctor by ID error:', error.message);
    res.status(500).json({
      message: 'Error fetching doctor profile'
    });
  }
};

// ============================================
// UPDATE DOCTOR PROFILE - Protected (doctor only)
// ============================================
// Endpoint: PUT /api/doctors/profile
// Body: { specialization, experience, qualification, clinicAddress, consultationFee, bio }
//
// A doctor can only update THEIR OWN profile (we use req.user from auth middleware)

const updateDoctorProfile = async (req, res) => {
  try {
    // Validate required fields (skip if this is just a file upload like QR code)
    if (!req.file) {
      const requiredFields = ['specialization', 'qualification', 'experience', 'consultationFee', 'clinicAddress', 'phone'];
      const missing = requiredFields.filter(f => !req.body[f]);
      if (missing.length > 0) {
        return res.status(400).json({
          message: `Please fill all required fields: ${missing.join(', ')}`
        });
      }
    }

    // These are the fields a doctor is ALLOWED to update
    const allowedUpdates = [
      'name',
      'specialization',
      'experience',
      'qualification',
      'clinicAddress',
      'consultationFee',
      'bio',
      'profilePhoto',
      'phone',
      'whatsappNumber',
      'upiId',
      'upiQrCode'
    ];

    // Build an object with only the allowed fields that were actually sent
    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        // Format phone numbers with +91
        if ((field === 'phone' || field === 'whatsappNumber') && req.body[field]) {
          updates[field] = formatIndianPhone(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    });
    // This prevents someone from sending { role: "admin" } and changing their role!

    // If a file was uploaded, convert to base64 and store in MongoDB
    if (req.file) {
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      if (req.body.fieldName === 'upiQrCode') {
        updates.upiQrCode = base64Image;
      } else {
        updates.profilePhoto = base64Image;
      }
    }

    // If no updates at all, return error
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    // Find the doctor and update their profile
    const doctor = await User.findByIdAndUpdate(
      req.user._id,
      // ^ The logged-in user's ID (from auth middleware)
      updates,
      // ^ The fields to update
      { new: true, runValidators: true }
      // ^ Options:
      //   new: true = return the UPDATED document (not the old one)
      //   runValidators: true = still check schema rules (like minlength)
    ).select('-password');

    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }

    res.json({
      message: 'Profile updated successfully!',
      doctor
    });

  } catch (error) {
    console.error('Update doctor profile error:', error.message);
    res.status(500).json({
      message: 'Error updating profile',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};

// ---- Export all controller functions ----
module.exports = { getAllDoctors, getDoctorById, updateDoctorProfile };
