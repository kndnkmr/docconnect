// ============================================
// Medical Report Routes
// ============================================
// POST   /api/reports           → patient uploads a report (patient only, with file)
// GET    /api/reports/my        → get my reports (both roles)
// PUT    /api/reports/:id/review → doctor reviews/comments on a report (doctor only)

const express = require('express');
const router = express.Router();

const { uploadReport, getMyReports, reviewReport, updateReport } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// All routes require login
router.use(protect);

// Both roles can view reports
router.get('/my', getMyReports);

// Patient uploads report (with file)
router.post('/', authorize('patient'), upload.single('reportFile'), uploadReport);

// Patient updates/replaces report (with optional new file)
router.put('/:id', authorize('patient'), upload.single('reportFile'), updateReport);

// Doctor reviews/comments on report
router.put('/:id/review', authorize('doctor'), reviewReport);

module.exports = router;
