// ============================================
// Review Model - Patient rates doctor after consultation
// ============================================

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({

  // Who wrote the review
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Which doctor is being reviewed
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Which appointment this review is for
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true
  },

  // Star rating (1-5)
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },

  // Optional text review
  comment: {
    type: String,
    default: '',
    maxlength: [500, 'Review cannot exceed 500 characters']
  }

}, {
  timestamps: true
});

// One review per appointment (prevent duplicate reviews)
reviewSchema.index({ appointment: 1 }, { unique: true });
// Fast lookup by doctor
reviewSchema.index({ doctor: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
