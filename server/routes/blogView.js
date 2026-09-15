// ============================================
// Blog View Routes
// ============================================
// GET  /api/blog-views          → counts for all articles (public)
// GET  /api/blog-views/:slug    → current count for one article (public)
// POST /api/blog-views/:slug    → record one view, return new count (public)
//
// All public and unauthenticated: blog readers are anonymous, and the counter
// is a soft "social proof" number, not sensitive data.

const express = require('express');
const router = express.Router();

const { incrementView, getView, getAllViews, setLike } = require('../controllers/blogViewController');

// All counts (for a future "most read" list). Literal route before '/:slug'.
router.get('/', getAllViews);

// One article's count + likes (no increment)
router.get('/:slug', getView);

// Record a view for one article
router.post('/:slug', incrementView);

// Like / unlike one article — body { liked: true|false }
router.post('/:slug/like', setLike);

module.exports = router;
