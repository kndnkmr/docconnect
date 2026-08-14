// ============================================
// Announcement Routes
// ============================================
//   GET    /api/announcements       → active announcements for my role (any user)
//   GET    /api/announcements/all    → all announcements (admin)
//   POST   /api/announcements        → create (admin)
//   PUT    /api/announcements/:id     → update/toggle (admin)
//   DELETE /api/announcements/:id     → delete (admin)

const express = require('express');
const router = express.Router();

const {
  getMyAnnouncements,
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} = require('../controllers/announcementController');

const { protect, authorize } = require('../middleware/auth');

// All routes require login
router.use(protect);

// Any logged-in user: get announcements for their role
router.get('/', getMyAnnouncements);

// Admin-only management
router.get('/all', authorize('admin'), getAllAnnouncements);
router.post('/', authorize('admin'), createAnnouncement);
router.put('/:id', authorize('admin'), updateAnnouncement);
router.delete('/:id', authorize('admin'), deleteAnnouncement);

module.exports = router;
