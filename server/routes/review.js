// ============================================
// Review Routes
// ============================================
// POST   /api/reviews                → patient submits review (patient only)
// GET    /api/reviews/doctor/:id     → get reviews for a doctor (public)
// DELETE /api/reviews/:id            → admin deletes review (admin only)

const express = require('express');
const router = express.Router();

const { createReview, getDoctorReviews, deleteReview } = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');

// Public: view doctor's reviews
router.get('/doctor/:doctorId', getDoctorReviews);

// Patient: submit review (must be logged in)
router.post('/', protect, authorize('patient'), createReview);

// Admin: delete inappropriate review
router.delete('/:id', protect, authorize('admin'), deleteReview);

module.exports = router;
