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
  },

  // ---- Doctor's public reply (right of reply) ----
  // Lets the reviewed doctor respond professionally to a review (thank a
  // patient, or address criticism) — the same courtesy Practo/Google offer.
  // Shown publicly under the review on the doctor's profile.
  doctorReply: {
    text: {
      type: String,
      default: '',
      maxlength: [500, 'Reply cannot exceed 500 characters']
    },
    repliedAt: {
      type: Date,
      default: null
    }
  },

  // ---- Admin moderation (soft-hide) ----
  // A hidden review stays in the DB (audit trail) but is excluded from every
  // public read path — doctor profile, homepage testimonials, and the rating
  // average. A safety valve for fake/abusive/spam reviews, reversible.
  isHidden: {
    type: Boolean,
    default: false
  },
  hiddenReason: {
    type: String,
    default: ''
  }

}, {
  timestamps: true
});

// One review per appointment (prevent duplicate reviews)
reviewSchema.index({ appointment: 1 }, { unique: true });
// Fast lookup by doctor, excluding hidden reviews (the common public query)
reviewSchema.index({ doctor: 1, isHidden: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
