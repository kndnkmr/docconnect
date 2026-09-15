// ============================================
// Blog View Controller - view counter for blog articles
// ============================================
// Two public endpoints power the "reads" counter shown on each article:
//   GET  /api/blog-views/:slug   -> read the current count (no increment)
//   POST /api/blog-views/:slug   -> record one view, return the new count
//   GET  /api/blog-views         -> counts for ALL articles (for a future
//                                   "most read" list); optional.
//
// The atomic upsert + $inc means concurrent readers can't clobber each other's
// increments, and the counter document is created on first view (no seeding).
//
// Note on abuse: this is a public counter, so it can technically be inflated by
// scripted POSTs. That's acceptable for a soft "social proof" number on a blog.
// The frontend also throttles per browser (once per article per few hours) so a
// simple refresh doesn't pump the count. We deliberately keep this lightweight
// rather than building heavy bot protection for a vanity metric.

const BlogView = require('../models/BlogView');

// Basic slug sanity check — matches the slug style used in blogData.js
// (lowercase letters, numbers, hyphens). Rejects anything else so the counter
// collection can't be spammed with arbitrary keys.
const SLUG_RE = /^[a-z0-9-]{1,120}$/;

// ============================================
// INCREMENT - record one view for an article
// Endpoint: POST /api/blog-views/:slug
// ============================================
const incrementView = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug || !SLUG_RE.test(slug)) {
      return res.status(400).json({ message: 'Invalid article slug' });
    }

    // Atomic upsert: create the counter if it's the article's first ever view,
    // otherwise bump it by one. Returns the updated document.
    const doc = await BlogView.findOneAndUpdate(
      { slug },
      { $inc: { count: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.json({ slug, count: doc.count });
  } catch (error) {
    // A duplicate-key race on first insert is harmless — treat as success-ish
    // by returning the current count if we can read it.
    console.error('[blog-views] increment error:', error.message);
    return res.status(500).json({ message: 'Could not record view' });
  }
};

// ============================================
// GET ONE - current count for an article (no increment)
// Endpoint: GET /api/blog-views/:slug
// ============================================
const getView = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug || !SLUG_RE.test(slug)) {
      return res.status(400).json({ message: 'Invalid article slug' });
    }

    const doc = await BlogView.findOne({ slug }).lean();
    return res.json({ slug, count: doc ? doc.count : 0 });
  } catch (error) {
    console.error('[blog-views] get error:', error.message);
    return res.status(500).json({ message: 'Could not fetch view count' });
  }
};

// ============================================
// GET ALL - counts for every article (for a "most read" list)
// Endpoint: GET /api/blog-views
// ============================================
const getAllViews = async (req, res) => {
  try {
    const docs = await BlogView.find({}, 'slug count -_id').lean();
    // Return as a { slug: count } map — easy for the client to look up.
    const counts = {};
    for (const d of docs) counts[d.slug] = d.count;
    return res.json({ counts });
  } catch (error) {
    console.error('[blog-views] getAll error:', error.message);
    return res.status(500).json({ message: 'Could not fetch view counts' });
  }
};

module.exports = { incrementView, getView, getAllViews };
