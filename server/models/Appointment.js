// ============================================
// Appointment Model - The shape of booking data
// ============================================
// This defines what an appointment looks like in MongoDB.
// Each appointment connects a PATIENT to a DOCTOR at a specific DATE/TIME.
//
// KEY CONCEPT: "References" (linking documents together)
// Instead of copying all doctor info into every appointment,
// we just store the doctor's ID. When we need full details,
// we use .populate() to "fill in" the referenced data.
// This is like storing a phone number vs the whole contact card.

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({

  // ---- WHO is the patient? ----
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    // ObjectId = a reference to another document in the database
    // It stores just the ID (like "65a1b2c3d4e5f6..."), not the full user data

    ref: 'User',
    // "ref" tells Mongoose: "This ID belongs to the User collection"
    // Later, we can use .populate('patient') to get the full patient details

    required: [true, 'Patient is required']
  },

  // ---- WHO is the doctor? ----
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor is required']
  },

  // ---- WHEN is the appointment? ----
  date: {
    type: Date,
    // JavaScript Date type — stores both date AND time
    // Example: "2024-03-15T10:30:00.000Z"
    required: [true, 'Appointment date is required']
  },

  // ---- Time slot (human-readable) ----
  timeSlot: {
    type: String,
    required: [true, 'Time slot is required']
    // Example: "10:00 AM - 10:30 AM"
    // We store this as a string for display purposes
  },

  // ---- WHAT is the status? ----
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    // The lifecycle of an appointment:
    //   pending    → patient just booked, waiting for doctor to accept
    //   confirmed  → doctor accepted the appointment
    //   completed  → appointment happened successfully
    //   cancelled  → either party cancelled
    default: 'pending'
  },

  // ---- WHY is the patient visiting? ----
  reason: {
    type: String,
    required: [true, 'Reason for visit is required'],
    trim: true
    // Example: "Chest pain for the last 2 days", "Annual checkup"
  },

  // ---- Additional notes ----
  notes: {
    type: String,
    default: ''
    // Doctor can add notes after the consultation
    // Example: "Prescribed medication X, follow up in 2 weeks"
  },

  // ---- Consultation type ----
  consultationType: {
    type: String,
    enum: ['in-person', 'video', 'phone'],
    default: 'in-person'
    // Modern healthcare offers multiple consultation modes
  },

  // ---- Payment status ----
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'
    // Admin/doctor marks as paid after receiving UPI payment
  },

  // ---- Meeting link (for video/phone consultations) ----
  meetingLink: {
    type: String,
    default: ''
    // Doctor adds this when confirming the appointment
    // e.g., a Google Meet or Zoom link for video calls
    // Patient sees it in their dashboard after doctor confirms
  },

  // ---- Cancellation reason (if cancelled) ----
  cancellationReason: {
    type: String,
    default: ''
  }

}, {
  timestamps: true
  // Adds createdAt (when booked) and updatedAt (when status last changed)
});

// ---- Indexes for performance ----
// Indexes help the database find documents faster (like a book's index)
// Without indexes, MongoDB scans EVERY document (slow with millions of records)

appointmentSchema.index({ patient: 1, date: -1 });
// ^ Makes it fast to find "all appointments for this patient, newest first"

appointmentSchema.index({ doctor: 1, date: -1 });
// ^ Makes it fast to find "all appointments for this doctor, newest first"

appointmentSchema.index({ doctor: 1, date: 1, timeSlot: 1 });
// ^ Makes it fast to check "is this time slot already taken?"

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
