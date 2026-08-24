// ============================================
// Review Routes
// ============================================
// POST   /api/reviews                → patient submits review (patient only)
// GET    /api/reviews/doctor/:id     → get reviews for a doctor (public)
// DELETE /api/reviews/:id            → admin deletes review (admin only)

const express = require('express');
const router = express.Router();

const { createReview, getDoctorReviews, deleteReview, getTopReviews, replyToReview, setReviewHidden, getAllReviews } = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');

// Public: get top reviews for homepage
router.get('/top', getTopReviews);

// Admin: moderation list of all reviews (includes hidden). Defined before the
// public '/doctor/:id' route — different path, but literal routes first is the
// safe habit.
router.get('/all', protect, authorize('admin'), getAllReviews);

// Public: view doctor's reviews (hidden reviews excluded server-side)
router.get('/doctor/:doctorId', getDoctorReviews);

// Patient: submit review (must be logged in)
router.post('/', protect, authorize('patient'), createReview);

// Doctor: reply to a review of their own profile
router.put('/:id/reply', protect, authorize('doctor'), replyToReview);

// Admin: hide/unhide a review (soft moderation, reversible)
router.put('/:id/hide', protect, authorize('admin'), setReviewHidden);

// Admin: delete inappropriate review (permanent — prefer hide/unhide)
router.delete('/:id', protect, authorize('admin'), deleteReview);

module.exports = router;
