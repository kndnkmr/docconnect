// ============================================
// Prescription Controller - Doctor writes, patient views
// ============================================

const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');

// ============================================
// CREATE PRESCRIPTION - Doctor writes after consultation
// ============================================
// Endpoint: POST /api/prescriptions
// Body: { appointmentId, diagnosis, medicines, testsRecommended, notes, followUpDate }

const createPrescription = async (req, res) => {
  try {
    const { appointmentId, diagnosis, medicines, testsRecommended, notes, followUpDate } = req.body;

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

    // Check if prescription already exists for this appointment
    const existing = await Prescription.findOne({ appointment: appointmentId });
    if (existing) {
      return res.status(400).json({
        message: 'A prescription already exists for this appointment. Use update instead.'
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
      .populate('doctor', 'name specialization qualification')
      .populate('patient', 'name email phone');

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

    const prescriptions = await Prescription.find(filter)
      .populate('doctor', 'name specialization')
      .populate('patient', 'name email phone')
      .populate('appointment', 'date timeSlot')
      .sort({ createdAt: -1 });

    res.json({ prescriptions });

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
