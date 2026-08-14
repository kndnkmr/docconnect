// ============================================
// Announcement Model - Admin broadcast messages
// ============================================
// Admins create announcements shown as a banner on the dashboard to a chosen
// audience (doctors, patients, or everyone). Used for policy notices, fee
// changes, maintenance windows, new features, etc.

const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },

  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },

  // Who should see this announcement
  audience: {
    type: String,
    enum: ['doctors', 'patients', 'all'],
    default: 'all'
  },

  // Whether it's currently shown
  active: {
    type: Boolean,
    default: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

announcementSchema.index({ active: 1, audience: 1, createdAt: -1 });

const Announcement = mongoose.model('Announcement', announcementSchema);

module.exports = Announcement;
