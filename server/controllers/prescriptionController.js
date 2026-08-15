// ============================================
// Prescription Controller - Doctor writes, patient views
// ============================================

const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { sendPushToUser } = require('../utils/push');
const { getPagination, safeContainsRegex } = require('../utils/queryHelpers');

// Notify the patient the instant a prescription is written/updated, so it
// "auto appears" on their already-open dashboard instead of needing a manual
// refresh. Socket.io covers the case where they have the app open right now;
// push notification covers it even if they don't. Never throws — this is a
// pure enhancement on top of the REST response, which already succeeded.
const notifyPrescriptionUpdate = (req, prescription) => {
  try {
    const io = req.app.get('io');
    const patientId = prescription.patient.toString();
    if (io) {
      io.to(`user:${patientId}`).emit('prescription-updated', {
        prescriptionId: prescription._id.toString(),
        appointmentId: prescription.appointment.toString()
      });
    }
    sendPushToUser(patientId, {
      title: 'New prescription from your doctor',
      body: `Dr. ${req.user.name} has written a prescription for you.`,
      url: '/dashboard?tab=prescriptions',
      tag: `prescription-${prescription._id}`
    });
  } catch (error) {
    console.error('notifyPrescriptionUpdate error:', error.message);
  }
};

// ============================================
// CREATE PRESCRIPTION - Doctor writes after consultation
// ============================================
// Endpoint: POST /api/prescriptions
// Body: { appointmentId, diagnosis, medicines, testsRecommended, notes, followUpDate }

const createPrescription = async (req, res) => {
  try {
    const { appointmentId, diagnosis, medicines, testsRecommended, notes, followUpDate, followUpDays } = req.body;

    if (!appointmentId || !diagnosis) {
      return res.status(400).json({
        message: 'Appointment ID and diagnosis are required'
      });
    }

    // Verify the appointment exists and belongs to this doctor
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only write prescriptions for your own appointments' });
    }

    // If prescription already exists for this appointment, update it instead
    const existing = await Prescription.findOne({ appointment: appointmentId });
    if (existing) {
      existing.diagnosis = diagnosis || existing.diagnosis;
      // medicines/testsRecommended are arrays built client-side from a comma-
      // split textarea — leaving that field blank sends `[]`, which is
      // truthy, so a plain `|| existing...` would silently wipe an existing
      // list the doctor never meant to touch. Only replace when something
      // was actually provided.
      if (Array.isArray(medicines) && medicines.length > 0) existing.medicines = medicines;
      if (Array.isArray(testsRecommended) && testsRecommended.length > 0) existing.testsRecommended = testsRecommended;
      existing.notes = notes || existing.notes;
      if (followUpDate) existing.followUpDate = followUpDate;
      await existing.save();

      // Update follow-up deadline if specified
      if (followUpDays && followUpDays > 0) {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + followUpDays);
        appointment.followUpDeadline = deadline;
        await appointment.save({ validateModifiedOnly: true });
      }

      notifyPrescriptionUpdate(req, existing);

      return res.json({
        message: 'Prescription updated successfully',
        prescription: existing
      });
    }

    const prescription = await Prescription.create({
      appointment: appointmentId,
      doctor: req.user._id,
      patient: appointment.patient,
      diagnosis,
      medicines: medicines || [],
      testsRecommended: testsRecommended || [],
      notes: notes || '',
      followUpDate: followUpDate || null
    });

    // Set follow-up deadline on the appointment if doctor specified days
    if (followUpDays && followUpDays > 0) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + followUpDays);
      appointment.followUpDeadline = deadline;
      await appointment.save({ validateModifiedOnly: true });
    }

    notifyPrescriptionUpdate(req, prescription);

    res.status(201).json({
      message: 'Prescription created successfully',
      prescription
    });

  } catch (error) {
    console.error('Create prescription error:', error.message);
    res.status(500).json({ message: 'Error creating prescription' });
  }
};

// ============================================
// GET PRESCRIPTION BY APPOINTMENT - View prescription for a specific appointment
// ============================================
// Endpoint: GET /api/prescriptions/appointment/:appointmentId

const getPrescriptionByAppointment = async (req, res) => {
  try {
    const prescription = await Prescription.findOne({ appointment: req.params.appointmentId })
      .populate('doctor', 'name specialization qualification medicalRegistrationNo')
      .populate('patient', 'name email phone patientId');

    if (!prescription) {
      return res.status(404).json({ message: 'No prescription found for this appointment' });
    }

    // Only the involved doctor or patient can view
    const isDoctor = prescription.doctor._id.toString() === req.user._id.toString();
    const isPatient = prescription.patient._id.toString() === req.user._id.toString();

    if (!isDoctor && !isPatient) {
      return res.status(403).json({ message: 'Not authorized to view this prescription' });
    }

    res.json({ prescription });

  } catch (error) {
    console.error('Get prescription error:', error.message);
    res.status(500).json({ message: 'Error fetching prescription' });
  }
};

// ============================================
// GET MY PRESCRIPTIONS - Patient views all their prescriptions
// ============================================
// Endpoint: GET /api/prescriptions/my

const getMyPrescriptions = async (req, res) => {
  try {
    const filter = {};

    if (req.user.role === 'patient') {
      filter.patient = req.user._id;
    } else if (req.user.role === 'doctor') {
      filter.doctor = req.user._id;
    }

    // Optional search — matches the OTHER party's name/phone (and a
    // patient's Patient ID), same pattern as appointments search.
    if (req.query.search && req.query.search.trim()) {
      const re = safeContainsRegex(req.query.search.trim());
      const otherPartyRole = req.user.role === 'doctor' ? 'patient' : 'doctor';
      const matches = await User.find({
        role: otherPartyRole,
        $or: [{ name: re }, { phone: re }, { patientId: re }]
      }).select('_id');
      filter[otherPartyRole] = { $in: matches.map((m) => m._id) };
    }

    // Bounded + paginated, same reasoning as reports (see reportController):
    // defaultLimit is high (100) so an unparameterized call - the patient's
    // own list, and Dashboard.jsx's appointment-card cross-reference lookup
    // - keeps working exactly as before for any realistic volume, while the
    // doctor's browsable Prescriptions tab passes its own smaller page/limit.
    const { page, limit, skip } = getPagination(req, { defaultLimit: 100, maxLimit: 100 });

    const total = await Prescription.countDocuments(filter);
    const prescriptions = await Prescription.find(filter)
      .populate('doctor', 'name specialization qualification medicalRegistrationNo')
      .populate('patient', 'name email phone patientId')
      .populate('appointment', 'date timeSlot')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      prescriptions,
      pagination: { currentPage: page, totalPages: Math.ceil(total / limit), total }
    });

  } catch (error) {
    console.error('Get my prescriptions error:', error.message);
    res.status(500).json({ message: 'Error fetching prescriptions' });
  }
};

// ============================================
// UPDATE PRESCRIPTION - Doctor edits prescription
// ============================================
// Endpoint: PUT /api/prescriptions/:id

const updatePrescription = async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own prescriptions' });
    }

    const { diagnosis, medicines, testsRecommended, notes, followUpDate } = req.body;

    if (diagnosis) prescription.diagnosis = diagnosis;
    if (medicines) prescription.medicines = medicines;
    if (testsRecommended) prescription.testsRecommended = testsRecommended;
    if (notes !== undefined) prescription.notes = notes;
    if (followUpDate !== undefined) prescription.followUpDate = followUpDate;

    await prescription.save();

    notifyPrescriptionUpdate(req, prescription);

    res.json({
      message: 'Prescription updated successfully',
      prescription
    });

  } catch (error) {
    console.error('Update prescription error:', error.message);
    res.status(500).json({ message: 'Error updating prescription' });
  }
};

module.exports = { createPrescription, getPrescriptionByAppointment, getMyPrescriptions, updatePrescription };
