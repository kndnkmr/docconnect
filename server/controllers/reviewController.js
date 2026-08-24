// ============================================
// Review Controller - Rating and reviews for doctors
// ============================================

const Review = require('../models/Review');
const Appointment = require('../models/Appointment');

// ============================================
// CREATE REVIEW - Patient rates after completed appointment
// ============================================
// Endpoint: POST /api/reviews
// Body: { appointmentId, rating, comment }

const createReview = async (req, res) => {
  try {
    const { appointmentId, rating, comment } = req.body;

    if (!appointmentId || !rating) {
      return res.status(400).json({ message: 'Appointment ID and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    // Verify appointment exists, is completed, and belongs to this patient
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only review your own appointments' });
    }

    if (appointment.status !== 'completed') {
      return res.status(400).json({ message: 'You can only rate completed appointments' });
    }

    // Check if already reviewed
    const existing = await Review.findOne({ appointment: appointmentId });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this appointment' });
    }

    const review = await Review.create({
      patient: req.user._id,
      doctor: appointment.doctor,
      appointment: appointmentId,
      rating,
      comment: comment || ''
    });

    res.status(201).json({
      message: 'Review submitted successfully. Thank you!',
      review
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this appointment' });
    }
    console.error('Create review error:', error.message);
    res.status(500).json({ message: 'Error submitting review' });
  }
};

// ============================================
// GET REVIEWS FOR A DOCTOR - Public
// ============================================
// Endpoint: GET /api/reviews/doctor/:doctorId

const getDoctorReviews = async (req, res) => {
  try {
    // Public view — never show admin-hidden reviews.
    const reviews = await Review.find({ doctor: req.params.doctorId, isHidden: { $ne: true } })
      .populate('patient', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    // Calculate average rating (hidden reviews don't count toward it)
    const allReviews = await Review.find({ doctor: req.params.doctorId, isHidden: { $ne: true } });
    const totalReviews = allReviews.length;
    const avgRating = totalReviews > 0
      ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1)
      : 0;

    res.json({
      reviews,
      stats: {
        averageRating: parseFloat(avgRating),
        totalReviews
      }
    });

  } catch (error) {
    console.error('Get doctor reviews error:', error.message);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
};

// ============================================
// DELETE REVIEW - Admin only (moderation)
// ============================================
// Endpoint: DELETE /api/reviews/:id

const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    res.json({ message: 'Review deleted' });
  } catch (error) {
    console.error('Delete review error:', error.message);
    res.status(500).json({ message: 'Error deleting review' });
  }
};

// ============================================
// GET TOP REVIEWS - For homepage testimonials (public)
// ============================================
// Endpoint: GET /api/reviews/top
// Returns 4-5 star reviews with comments for the scrolling testimonial

const getTopReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ rating: { $gte: 4 }, comment: { $ne: '' }, isHidden: { $ne: true } })
      .populate('patient', 'name')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 })
      .limit(15);

    res.json({ reviews });

  } catch (error) {
    console.error('Get top reviews error:', error.message);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
};

// ============================================
// REPLY TO REVIEW - Doctor's public right of reply
// ============================================
// Endpoint: PUT /api/reviews/:id/reply
// Body: { text }
// Only the doctor being reviewed can reply. Sets/updates their public reply.

const replyToReview = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Reply text is required' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Only the doctor who was reviewed can reply to it.
    if (review.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only reply to reviews of your own profile' });
    }

    review.doctorReply = { text: text.trim().slice(0, 500), repliedAt: new Date() };
    await review.save();

    res.json({ message: 'Reply posted', review });
  } catch (error) {
    console.error('Reply to review error:', error.message);
    res.status(500).json({ message: 'Error posting reply' });
  }
};

// ============================================
// HIDE / UNHIDE REVIEW - Admin moderation (soft, reversible)
// ============================================
// Endpoint: PUT /api/reviews/:id/hide
// Body: { isHidden: true|false, hiddenReason? }
// Hidden reviews stay in the DB but are excluded from every public read path.

const setReviewHidden = async (req, res) => {
  try {
    const { isHidden, hiddenReason } = req.body;

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    review.isHidden = !!isHidden;
    review.hiddenReason = isHidden ? (hiddenReason ? String(hiddenReason).trim().slice(0, 200) : 'Hidden by admin') : '';
    await review.save();

    res.json({
      message: review.isHidden ? 'Review hidden' : 'Review unhidden',
      review
    });
  } catch (error) {
    console.error('Set review hidden error:', error.message);
    res.status(500).json({ message: 'Error updating review' });
  }
};

// ============================================
// GET ALL REVIEWS - Admin moderation list (includes hidden)
// ============================================
// Endpoint: GET /api/reviews/all?hidden=true|false
// Admin-only. Returns all reviews (with patient + doctor names) for moderation,
// newest first, optionally filtered to only hidden / only visible.

const getAllReviews = async (req, res) => {
  try {
    const filter = {};
    if (req.query.hidden === 'true') filter.isHidden = true;
    else if (req.query.hidden === 'false') filter.isHidden = { $ne: true };

    const reviews = await Review.find(filter)
      .populate('patient', 'name patientId')
      .populate('doctor', 'name specialization')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({ reviews });
  } catch (error) {
    console.error('Get all reviews error:', error.message);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
};

module.exports = { createReview, getDoctorReviews, deleteReview, getTopReviews, replyToReview, setReviewHidden, getAllReviews };
