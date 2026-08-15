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
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const { formatIndianPhone } = require('../utils/formatPhone');
const { uploadFile } = require('../utils/uploadFile');

// ============================================
// Next-available-slot helpers (all in IST)
// ============================================
const _dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Convert minutes-since-midnight to a display label like "09:00 AM" / "12:00 AM".
function _minutesToLabel(minutes) {
  let h = Math.floor(minutes / 60);
  const m = minutes % 60;
  h = h % 24; // 24:00 (midnight end) → 12:00 AM
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

// Generate a day's slots as { startMin, label } (label matches booked timeSlot strings).
function _genDaySlots(startTime, endTime, duration) {
  const [sh, sm] = (startTime || '').split(':').map(Number);
  const [eh, em] = (endTime || '').split(':').map(Number);
  let cur = (sh || 0) * 60 + (sm || 0);
  let end = (eh || 0) * 60 + (em || 0);
  if (end === 0) end = 24 * 60; // midnight end
  const out = [];
  while (cur + duration <= end) {
    out.push({ startMin: cur, label: `${_minutesToLabel(cur)} - ${_minutesToLabel(cur + duration)}` });
    cur += duration;
  }
  return out;
}

// Find the earliest free, future, unbooked slot for a doctor (searches up to 14 days).
// bookedByDate: { 'YYYY-MM-DD': Set(timeSlotLabels) } for this doctor.
function computeNextAvailable(doctor, bookedByDate) {
  const availability = doctor.availability || [];
  if (availability.length === 0) return null;
  const duration = doctor.slotDuration || 30;

  const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const nowMinutes = istNow.getHours() * 60 + istNow.getMinutes();

  for (let offset = 0; offset < 14; offset++) {
    const d = new Date(istNow);
    d.setDate(d.getDate() + offset);
    const dayName = _dayNames[d.getDay()];
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const sessions = availability.filter((a) => a.day === dayName);
    if (sessions.length === 0) continue;

    let daySlots = [];
    for (const s of sessions) daySlots = daySlots.concat(_genDaySlots(s.startTime, s.endTime, duration));
    daySlots.sort((a, b) => a.startMin - b.startMin);

    const bookedSet = (bookedByDate && bookedByDate[dateStr]) || null;
    for (const slot of daySlots) {
      if (offset === 0 && slot.startMin <= nowMinutes) continue; // past today
      if (bookedSet && bookedSet.has(slot.label)) continue; // already booked
      return { date: dateStr, dayName, timeSlot: slot.label, isToday: offset === 0 };
    }
  }
  return null;
}

// Attach `nextAvailable` to a set of doctor docs. Runs ONE booked-appointments
// query for all of them (efficient), then computes each doctor's next free slot.
// Returns plain objects (not Mongoose docs).
async function attachNextAvailable(docs) {
  const docIds = docs.map((d) => d._id);
  const bookedByDoctor = {};
  if (docIds.length > 0) {
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const appts = await Appointment.find({
      doctor: { $in: docIds },
      status: { $nin: ['cancelled'] },
      date: { $gte: new Date(todayIST) }
    }).select('doctor date timeSlot');

    for (const a of appts) {
      const dId = a.doctor.toString();
      const dStr = new Date(a.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      bookedByDoctor[dId] = bookedByDoctor[dId] || {};
      bookedByDoctor[dId][dStr] = bookedByDoctor[dId][dStr] || new Set();
      bookedByDoctor[dId][dStr].add(a.timeSlot);
    }
  }

  return docs.map((d) => {
    const obj = d.toObject();
    obj.nextAvailable = computeNextAvailable(obj, bookedByDoctor[d._id.toString()]);
    return obj;
  });
}

// Attach { average, count } rating stats to a page of doctors. One aggregate
// query for the whole page (not one per doctor), so it stays cheap regardless
// of how many doctors are shown.
async function attachRatings(docs) {
  if (!docs || docs.length === 0) return docs;
  const ids = docs.map((d) => d._id);

  const stats = await Review.aggregate([
    { $match: { doctor: { $in: ids } } },
    { $group: { _id: '$doctor', average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);

  const byId = {};
  stats.forEach((s) => {
    byId[s._id.toString()] = { average: Math.round(s.average * 10) / 10, count: s.count };
  });

  return docs.map((d) => {
    d.rating = byId[d._id.toString()] || { average: 0, count: 0 };
    return d;
  });
}

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
    const filter = { role: 'doctor', isVerified: { $ne: false }, isDeleted: { $ne: true }, isSuspended: { $ne: true } };

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

    // Filter by city
    if (req.query.city) {
      filter.city = new RegExp(req.query.city, 'i');
    }

    // Filter by consultation mode
    if (req.query.consultationMode) {
      filter.consultationModes = req.query.consultationMode;
    }

    const wantAvailableToday = req.query.availableToday === 'true';

    // As a cheap pre-filter for "available today", narrow to doctors who have a
    // session on today's weekday (in IST). We still verify a REAL free slot below.
    if (wantAvailableToday) {
      const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const today = _dayNames[istNow.getDay()];
      filter['availability.day'] = today;
    }

    // ---- Pagination ----
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let doctorsWithAvailability;
    let total;

    if (wantAvailableToday) {
      // Honest "available today": fetch all candidates, compute their next free
      // slot, and keep only those genuinely free TODAY. Paginate in memory.
      const candidates = await User.find(filter).select('-password -upiQrCode').sort({ createdAt: -1 });
      const withNA = await attachNextAvailable(candidates);
      const freeToday = withNA.filter((d) => d.nextAvailable && d.nextAvailable.isToday);
      total = freeToday.length;
      doctorsWithAvailability = freeToday.slice(skip, skip + limit);
    } else {
      // Normal path: DB-level pagination, then attach next-available info.
      const doctors = await User.find(filter)
        .select('-password -upiQrCode')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });
      total = await User.countDocuments(filter);
      doctorsWithAvailability = await attachNextAvailable(doctors);
    }

    // Attach average rating + review count (one query for this page)
    doctorsWithAvailability = await attachRatings(doctorsWithAvailability);

    // ---- Send response ----
    res.json({
      doctors: doctorsWithAvailability,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
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

    // Hide deleted or suspended doctors from public view
    if (doctor.isDeleted || doctor.isSuspended) {
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
      const requiredFields = ['specialization', 'qualification', 'medicalRegistrationNo', 'experience', 'consultationFee', 'clinicAddress', 'phone'];
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
      'medicalRegistrationNo',
      'clinicAddress',
      'city',
      'googleMapsLink',
      'consultationModes',
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

    // If a file was uploaded, store it (Cloudinary URL, or base64 fallback)
    if (req.file) {
      try {
        const isQr = req.body.fieldName === 'upiQrCode';
        const imageUrl = await uploadFile(
          req.file.buffer,
          req.file.mimetype,
          isQr ? 'promedicoz/qr' : 'promedicoz/profile'
        );
        if (isQr) {
          updates.upiQrCode = imageUrl;
        } else {
          updates.profilePhoto = imageUrl;
        }
      } catch (fileErr) {
        console.error('File processing error:', fileErr.message, 'file keys:', Object.keys(req.file));
        return res.status(500).json({ message: 'Error processing uploaded file' });
      }
    }

    // If no updates at all, return error
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    // Find the doctor and update their profile
    const doctor = await User.findById(req.user._id).select('-password');

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      doctor[key] = updates[key];
    });
    await doctor.save({ validateBeforeSave: false });

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
