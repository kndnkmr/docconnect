// ============================================
// Complaint Controller - Patient complaints management
// ============================================

const Complaint = require('../models/Complaint');

// ============================================
// CREATE COMPLAINT - Patient files a complaint
// ============================================
// Endpoint: POST /api/complaints
// Body: { subject, description, doctorId (optional), appointmentId (optional) }

const createComplaint = async (req, res) => {
  try {
    const { subject, description, doctorId, appointmentId } = req.body;

    if (!subject || !description) {
      return res.status(400).json({
        message: 'Subject and description are required'
      });
    }

    const complaint = await Complaint.create({
      patient: req.user._id,
      subject,
      description,
      doctor: doctorId || null,
      appointment: appointmentId || null
    });

    res.status(201).json({
      message: 'Complaint submitted successfully. We will review it shortly.',
      complaint
    });

  } catch (error) {
    console.error('Create complaint error:', error.message);
    res.status(500).json({ message: 'Error submitting complaint' });
  }
};

// ============================================
// GET MY COMPLAINTS - Patient views their complaints
// ============================================
// Endpoint: GET /api/complaints/my

const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ patient: req.user._id })
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 });

    res.json({ complaints });

  } catch (error) {
    console.error('Get my complaints error:', error.message);
    res.status(500).json({ message: 'Error fetching complaints' });
  }
};

// ============================================
// GET ALL COMPLAINTS - Admin views all complaints
// ============================================
// Endpoint: GET /api/complaints?status=open

const getAllComplaints = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const complaints = await Complaint.find(filter)
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Complaint.countDocuments(filter);

    res.json({
      complaints,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalComplaints: total
      }
    });

  } catch (error) {
    console.error('Get all complaints error:', error.message);
    res.status(500).json({ message: 'Error fetching complaints' });
  }
};

// ============================================
// UPDATE COMPLAINT STATUS - Admin resolves/closes
// ============================================
// Endpoint: PUT /api/complaints/:id
// Body: { status, response }

const updateComplaint = async (req, res) => {
  try {
    const { status, response } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    if (status) complaint.status = status;
    if (response) complaint.response = response;

    await complaint.save();

    res.json({
      message: 'Complaint updated successfully',
      complaint
    });

  } catch (error) {
    console.error('Update complaint error:', error.message);
    res.status(500).json({ message: 'Error updating complaint' });
  }
};

module.exports = { createComplaint, getMyComplaints, getAllComplaints, updateComplaint };
