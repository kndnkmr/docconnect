// ============================================
// Complaint Controller - Patient complaints management
// ============================================

const Complaint = require('../models/Complaint');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const { getPagination } = require('../utils/queryHelpers');
const { sendPushToUser } = require('../utils/push');

// Notify the patient the instant admin responds/updates status, so it
// "auto appears" on their already-open Complaints tab instead of needing a
// manual refresh — same pattern used for reports/prescriptions elsewhere.
const notifyComplaintUpdate = (req, complaint) => {
  try {
    const io = req.app.get('io');
    const patientId = complaint.patient.toString();
    if (io) {
      io.to(`user:${patientId}`).emit('complaint-updated', {
        complaintId: complaint._id.toString()
      });
    }
    sendPushToUser(patientId, {
      title: 'Update on your complaint',
      body: complaint.response ? 'Support has responded to your complaint.' : `Your complaint status changed to "${complaint.status}".`,
      url: '/dashboard?tab=complaints',
      tag: `complaint-${complaint._id}`
    });
  } catch (error) {
    console.error('notifyComplaintUpdate error:', error.message);
  }
};

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

    // Both are optional (a complaint can be general, not about a specific
    // doctor/visit), but if given, verify they're real and actually belong
    // to this patient - same reasoning as the report-upload link: without
    // this, nothing stops a crafted request from referencing someone else's
    // appointment or a non-doctor account.
    let appointment = null;
    if (appointmentId) {
      appointment = await Appointment.findById(appointmentId);
      if (!appointment || appointment.patient.toString() !== req.user._id.toString()) {
        return res.status(400).json({ message: 'Invalid appointment' });
      }
      if (doctorId && appointment.doctor.toString() !== doctorId) {
        return res.status(400).json({ message: 'That appointment is not with this doctor' });
      }
    }
    if (doctorId) {
      const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
      if (!doctor) {
        return res.status(400).json({ message: 'Invalid doctor' });
      }
    }

    const complaint = await Complaint.create({
      patient: req.user._id,
      subject,
      description,
      doctor: doctorId || (appointment ? appointment.doctor : null),
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
      .populate('appointment', 'date timeSlot')
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

    const { page, limit, skip } = getPagination(req, { defaultLimit: 20 });

    const complaints = await Complaint.find(filter)
      .populate('patient', 'name email phone patientId')
      .populate('doctor', 'name specialization')
      .populate('appointment', 'date timeSlot')
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
    notifyComplaintUpdate(req, complaint);

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
