// ============================================
// Prescription Model - Doctor writes prescription for patient
// ============================================
// After a consultation, doctor writes a prescription.
// Patient can view it from their dashboard.

const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({

  // Which appointment this prescription is for
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment is required']
  },

  // The doctor who wrote it
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor is required']
  },

  // The patient it's for
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient is required']
  },

  // Diagnosis
  diagnosis: {
    type: String,
    required: [true, 'Diagnosis is required'],
    trim: true
  },

  // Medicines prescribed
  medicines: [{
    name: { type: String, required: true },
    dosage: { type: String, default: '' },       // e.g., "500mg"
    frequency: { type: String, default: '' },    // e.g., "Twice a day"
    duration: { type: String, default: '' },     // e.g., "7 days"
    instructions: { type: String, default: '' }  // e.g., "Take after food"
  }],

  // Tests recommended
  testsRecommended: [{
    type: String
    // e.g., "Complete Blood Count", "MRI Brain", "Thyroid Profile"
  }],

  // Additional notes/advice
  notes: {
    type: String,
    default: ''
    // e.g., "Avoid spicy food, drink plenty of water, follow up in 2 weeks"
  },

  // Follow-up date (optional)
  followUpDate: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

// Indexes
prescriptionSchema.index({ appointment: 1 });
prescriptionSchema.index({ patient: 1, createdAt: -1 });
prescriptionSchema.index({ doctor: 1, createdAt: -1 });

const Prescription = mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;
