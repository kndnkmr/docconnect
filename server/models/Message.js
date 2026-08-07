const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['patient', 'doctor'],
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

messageSchema.index({ appointment: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
