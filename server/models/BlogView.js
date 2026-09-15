// ============================================
// BlogView Model - view counter per blog article
// ============================================
// A tiny counter document, one per article slug, holding how many times that
// article has been viewed. This gives us view numbers we OWN (independent of
// Google Analytics) that we can display right on the article (e.g. "1,240 reads").
//
// Design notes:
//   - Keyed by `slug` (unique), which matches the article slug in blogData.js.
//     No link to a specific User — blog readers are mostly anonymous.
//   - We store only an aggregate count, not per-reader rows: it's cheap, fast,
//     and privacy-friendly (no tracking of who read what).
//   - The document is created lazily (upsert) the first time an article is
//     viewed, so we don't need to seed one row per article.

const mongoose = require('mongoose');

const blogViewSchema = new mongoose.Schema({

  // The article slug, e.g. 'staying-healthy-after-60-older-age-guide'.
  // Matches `slug` in client/src/pages/blog/blogData.js.
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  // Total number of views recorded for this article.
  count: {
    type: Number,
    default: 0,
    min: 0
  }

}, {
  timestamps: true
});

const BlogView = mongoose.model('BlogView', blogViewSchema);

module.exports = BlogView;
