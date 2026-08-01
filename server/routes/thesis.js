// ============================================
// Thesis Routes - Publication URL endpoints
// ============================================
// Mix of public and protected routes:
//
// PUBLIC (no login needed):
//   GET  /api/thesis               → browse all public publications
//   GET  /api/thesis/share/:slug   → view a thesis via its share link
//
// PROTECTED (login as doctor required):
//   POST   /api/thesis             → upload a new thesis
//   GET    /api/thesis/my          → view your own publications
//   PUT    /api/thesis/:id         → edit your thesis
//   DELETE /api/thesis/:id         → delete your thesis
//
// IMPORTANT ROUTE ORDER:
// Specific routes (/share/:slug, /my) must come BEFORE generic (/:id)
// Otherwise Express thinks "share" or "my" is an ID!

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  createThesis,
  getAllPublicThesis,
  getThesisBySlug,
  getMyThesis,
  updateThesis,
  deleteThesis
} = require('../controllers/thesisController');

// Import middleware
const { protect, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// ---- PUBLIC ROUTES (no login needed) ----

// GET /api/thesis
// Browse all public publications
// Supports: ?tag=cardiology&search=heart&sort=popular&page=1&limit=10
router.get('/', getAllPublicThesis);

// GET /api/thesis/share/:slug
// View a thesis via its shareable link
// Example: /api/thesis/share/heart-disease-prevention-methods-a3f7b2
router.get('/share/:slug', getThesisBySlug);

// ---- PROTECTED ROUTES (doctor only) ----

// GET /api/thesis/my
// Doctor views their own publications (both public and private)
router.get('/my', protect, authorize('doctor'), getMyThesis);

// POST /api/thesis
// Doctor uploads a new publication
// upload.single('pdfFile') = expect one PDF file with field name "pdfFile"
router.post(
  '/',
  protect,
  authorize('doctor'),
  upload.single('pdfFile'),
  createThesis
);

// PUT /api/thesis/:id
// Doctor edits their own thesis
router.put(
  '/:id',
  protect,
  authorize('doctor'),
  upload.single('pdfFile'),
  updateThesis
);

// DELETE /api/thesis/:id
// Doctor deletes their own thesis
router.delete(
  '/:id',
  protect,
  authorize('doctor'),
  deleteThesis
);

module.exports = router;

// ============================================
// THESIS SHARING FLOW:
// ============================================
//
// 1. Doctor logs in → gets token
//
// 2. Doctor uploads thesis → POST /api/thesis
//    Body (form-data): { title, abstract, content, tags, visibility }
//    File: pdfFile (optional PDF attachment)
//    Response includes: shareLink: "/api/thesis/share/my-research-abc123"
//
// 3. Doctor copies the share link and sends it to colleagues
//
// 4. Anyone with the link → GET /api/thesis/share/my-research-abc123
//    Can read the full thesis (viewCount increments)
//
// 5. Other users browse → GET /api/thesis?tag=cardiology
//    See all public publications filtered by tag
//
// 6. Doctor wants to hide it → PUT /api/thesis/:id
//    Body: { visibility: "private" }
//    Now it's only visible to the author
// ============================================
