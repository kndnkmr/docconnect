// ============================================
// CallLog Model - Tracks in-app calls
// ============================================
// One record per doctor–patient call (logged from the DOCTOR's side so calls
// aren't double-counted when the patient also joins). Used for analytics:
// how many times doctors connect with patients and total minutes on calls.

const mongoose = require('mongoose');

const callLogSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },

  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  consultationType: {
    type: String,
    enum: ['video', 'phone', 'in-person'],
    default: 'video'
  },

  startedAt: {
    type: Date,
    default: Date.now
  },

  endedAt: {
    type: Date,
    default: null
  },

  // Duration in seconds (filled when the call ends)
  durationSeconds: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Fast lookups for analytics (per doctor, newest first)
callLogSchema.index({ doctor: 1, startedAt: -1 });

const CallLog = mongoose.model('CallLog', callLogSchema);

module.exports = CallLog;
