// ============================================
// Complaint Model - Patient complaints/feedback
// ============================================
// Patients can file complaints about their experience.
// Admin and the concerned doctor can view them.

const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({

  // Who filed the complaint
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient is required']
  },

  // Which doctor is the complaint about (optional — could be a general complaint)
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Related appointment (optional)
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },

  // Subject/title of the complaint
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },

  // Detailed description
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },

  // Status of the complaint
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open'
  },

  // Admin response/resolution note
  response: {
    type: String,
    default: ''
  }

}, {
  timestamps: true
});

// Index for fast lookup by patient
complaintSchema.index({ patient: 1, createdAt: -1 });

const Complaint = mongoose.model('Complaint', complaintSchema);

module.exports = Complaint;
