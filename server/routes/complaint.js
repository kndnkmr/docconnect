// ============================================
// Complaint Routes
// ============================================
// POST   /api/complaints        → patient files a complaint (patient only)
// GET    /api/complaints/my     → patient views their complaints (patient only)
// GET    /api/complaints        → admin views all complaints (admin only)
// PUT    /api/complaints/:id    → admin updates status/response (admin only)

const express = require('express');
const router = express.Router();

const {
  createComplaint,
  getMyComplaints,
  getAllComplaints,
  updateComplaint
} = require('../controllers/complaintController');

const { protect, authorize } = require('../middleware/auth');

// All routes require login
router.use(protect);

// Patient routes
router.post('/', authorize('patient'), createComplaint);
router.get('/my', authorize('patient'), getMyComplaints);

// Admin routes
router.get('/', authorize('admin'), getAllComplaints);
router.put('/:id', authorize('admin'), updateComplaint);

module.exports = router;
