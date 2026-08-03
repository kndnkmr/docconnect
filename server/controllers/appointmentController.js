// ============================================
// Appointment Controller - Booking Logic
// ============================================
// This handles all the appointment operations:
// - Patient books an appointment
// - Patient views their appointments
// - Doctor views their appointments
// - Doctor updates appointment status (confirm/complete/cancel)
// - Either party cancels
//
// KEY CONCEPT: "populate()"
// When we fetch appointments, we don't just want the doctor's ID —
// we want their name, specialization, etc. populate() fills in the
// referenced data automatically.

const Appointment = require('../models/Appointment');
const User = require('../models/User');

// ============================================
// BOOK APPOINTMENT - Patient only
// ============================================
// Endpoint: POST /api/appointments
// Body: { doctorId, date, timeSlot, reason, consultationType }
//
// Only patients can book. The patient is identified from their token (req.user).

const bookAppointment = async (req, res) => {
  try {
    const { doctorId, date, timeSlot, reason, consultationType } = req.body;

    // Step 1: Validate required fields
    if (!doctorId || !date || !timeSlot || !reason) {
      return res.status(400).json({
        message: 'Please provide doctorId, date, timeSlot, and reason'
      });
    }

    // Step 2: Verify the doctor exists and is actually a doctor
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }

    // Step 3: Check if the time slot is already taken
    // We don't want two patients booking the same doctor at the same time!
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: new Date(date),
      timeSlot: timeSlot,
      status: { $nin: ['cancelled'] }
      // $nin = "not in" — we ignore cancelled appointments
      // A cancelled slot should be available again
    });

    if (existingAppointment) {
      return res.status(400).json({
        message: 'This time slot is already booked. Please choose another time.'
      });
    }

    // Step 4: Check the appointment date is in the future
    if (new Date(date) < new Date()) {
      return res.status(400).json({
        message: 'Cannot book appointments in the past'
      });
    }

    // Step 5: Create the appointment
    const appointment = await Appointment.create({
      patient: req.user._id,
      // ^ The logged-in patient's ID (from auth middleware)
      doctor: doctorId,
      date: new Date(date),
      timeSlot,
      reason,
      consultationType: consultationType || 'in-person',
      status: 'pending'
      // Starts as pending — doctor must confirm
    });

    // Step 6: Populate doctor info before sending response
    // So the frontend gets the doctor's name, not just their ID
    await appointment.populate('doctor', 'name specialization profilePhoto');
    // Second argument = which fields to include (space-separated)

    res.status(201).json({
      message: 'Appointment booked successfully! Waiting for doctor confirmation.',
      appointment
    });

  } catch (error) {
    console.error('Book appointment error:', error.message);
    res.status(500).json({
      message: 'Error booking appointment'
    });
  }
};

// ============================================
// GET MY APPOINTMENTS - For logged-in user (patient or doctor)
// ============================================
// Endpoint: GET /api/appointments/my
// Query params: ?status=pending&page=1&limit=10
//
// Returns different results based on role:
// - If patient: shows appointments they've booked
// - If doctor: shows appointments patients booked with them

const getMyAppointments = async (req, res) => {
  try {
    // Build filter based on user's role
    const filter = {};

    if (req.user.role === 'patient') {
      filter.patient = req.user._id;
      // Show appointments where I am the patient
    } else if (req.user.role === 'doctor') {
      filter.doctor = req.user._id;
      // Show appointments where I am the doctor
    }

    // Optional status filter
    if (req.query.status) {
      filter.status = req.query.status;
      // Example: ?status=pending → only show pending appointments
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch appointments with populated references
    const appointments = await Appointment.find(filter)
      .populate('doctor', 'name specialization profilePhoto consultationFee')
      // ^ Fill in doctor details (instead of just showing their ID)
      .populate('patient', 'name email phone')
      // ^ Fill in patient details
      .sort({ date: -1 })
      // ^ Newest appointments first
      .skip(skip)
      .limit(limit);

    const total = await Appointment.countDocuments(filter);

    res.json({
      appointments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalAppointments: total
      }
    });

  } catch (error) {
    console.error('Get appointments error:', error.message);
    res.status(500).json({
      message: 'Error fetching appointments'
    });
  }
};

// ============================================
// GET SINGLE APPOINTMENT - View details
// ============================================
// Endpoint: GET /api/appointments/:id
// Only the patient or doctor involved can view it

const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'name specialization profilePhoto consultationFee clinicAddress')
      .populate('patient', 'name email phone');

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    // Security check: only the involved patient or doctor can view
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor._id.toString() === req.user._id.toString();
    // .toString() because MongoDB ObjectIds aren't plain strings —
    // you can't compare them directly with ===

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        message: 'You are not authorized to view this appointment'
      });
    }

    res.json({ appointment });

  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid appointment ID' });
    }
    console.error('Get appointment error:', error.message);
    res.status(500).json({
      message: 'Error fetching appointment details'
    });
  }
};

// ============================================
// UPDATE APPOINTMENT STATUS - Doctor only
// ============================================
// Endpoint: PUT /api/appointments/:id/status
// Body: { status, notes }
//
// Doctors can: confirm, complete, or cancel appointments
// Valid transitions:
//   pending → confirmed (doctor accepts)
//   confirmed → completed (consultation done)
//   pending/confirmed → cancelled (doctor cancels)

const updateAppointmentStatus = async (req, res) => {
  try {
    const { status, notes, meetingLink } = req.body;

    if (!status) {
      return res.status(400).json({
        message: 'Please provide a status'
      });
    }

    // Find the appointment
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    // Verify this doctor owns the appointment
    if (appointment.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only update your own appointments'
      });
    }

    // Validate status transitions
    // We don't want random jumps like "completed → pending"
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],      // Final state — no changes allowed
      cancelled: []       // Final state — no changes allowed
    };

    if (!validTransitions[appointment.status].includes(status)) {
      return res.status(400).json({
        message: `Cannot change status from "${appointment.status}" to "${status}". Valid options: ${validTransitions[appointment.status].join(', ') || 'none (final state)'}`
      });
    }

    // Update the appointment
    appointment.status = status;
    if (notes) {
      appointment.notes = notes;
    }
    if (meetingLink) {
      appointment.meetingLink = meetingLink;
    }

    await appointment.save();
    // .save() triggers any pre-save hooks and validates the data

    // Populate before sending back
    await appointment.populate('doctor', 'name specialization');
    await appointment.populate('patient', 'name email');

    res.json({
      message: `Appointment ${status} successfully`,
      appointment
    });

  } catch (error) {
    console.error('Update appointment status error:', error.message);
    res.status(500).json({
      message: 'Error updating appointment status'
    });
  }
};

// ============================================
// CANCEL APPOINTMENT - Patient cancels their own
// ============================================
// Endpoint: PUT /api/appointments/:id/cancel
// Body: { cancellationReason }
//
// Patients can cancel pending or confirmed appointments

const cancelAppointment = async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    // Verify this patient owns the appointment
    if (appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only cancel your own appointments'
      });
    }

    // Can only cancel if not already completed or cancelled
    if (['completed', 'cancelled'].includes(appointment.status)) {
      return res.status(400).json({
        message: `Cannot cancel an appointment that is already ${appointment.status}`
      });
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = cancellationReason || 'Cancelled by patient';

    await appointment.save();

    res.json({
      message: 'Appointment cancelled successfully',
      appointment
    });

  } catch (error) {
    console.error('Cancel appointment error:', error.message);
    res.status(500).json({
      message: 'Error cancelling appointment'
    });
  }
};

// ---- Export all controller functions ----
module.exports = {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment
};
