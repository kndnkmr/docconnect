// ============================================
// Thesis Model - Research publications schema
// ============================================
// This defines what a thesis/publication looks like in the database.
// Doctors can upload their research papers, make them public,
// and share them with a unique link.
//
// KEY CONCEPTS:
// - "slug" = a URL-friendly version of the title (for shareable links)
//   Example: "Heart Disease Prevention Methods" → "heart-disease-prevention-methods"
// - "visibility" = public (anyone can read) or private (only the author)
// - "tags" = categories for filtering (like hashtags)

const mongoose = require('mongoose');

const thesisSchema = new mongoose.Schema({

  // ---- WHO wrote it? ----
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Author is required']
    // References the doctor who uploaded this thesis
  },

  // ---- Title of the publication ----
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },

  // ---- URL-friendly slug (for shareable links) ----
  slug: {
    type: String,
    unique: true
    // Example URL: /api/thesis/share/heart-disease-prevention-methods
    // Much nicer than: /api/thesis/65a1b2c3d4e5f6789...
  },

  // ---- Abstract / Summary ----
  abstract: {
    type: String,
    required: [true, 'Abstract is required'],
    maxlength: [2000, 'Abstract cannot exceed 2000 characters']
    // A brief summary of the thesis — shown in listings
  },

  // ---- Full content ----
  content: {
    type: String,
    default: ''
    // The full thesis text (if typed in directly instead of uploading PDF)
  },

  // ---- Uploaded PDF file ----
  pdfFile: {
    type: String,
    default: ''
    // File path to the uploaded PDF: "/uploads/thesis/filename.pdf"
  },

  // ---- Tags (for categorization and search) ----
  tags: {
    type: [String],
    // [String] = an array of strings
    // Example: ["cardiology", "prevention", "research"]
    default: []
  },

  // ---- Visibility ----
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
    // public = anyone can view via the share link or browse listings
    // private = only the author can see it (draft mode)
  },

  // ---- Publication date (when the actual paper was published) ----
  publicationDate: {
    type: Date,
    default: Date.now
    // When the research was originally published (may differ from upload date)
  },

  // ---- Co-authors (optional) ----
  coAuthors: {
    type: [String],
    default: []
    // Array of names: ["Dr. Jane Smith", "Dr. Alex Johnson"]
    // We store as strings since co-authors may not be users on our platform
  },

  // ---- Institution / Journal ----
  institution: {
    type: String,
    default: ''
    // Where it was published: "Harvard Medical School", "The Lancet", etc.
  },

  // ---- View count ----
  viewCount: {
    type: Number,
    default: 0
    // Track how many times this thesis has been viewed
    // Useful for showing "popular publications"
  }

}, {
  timestamps: true
  // createdAt = when uploaded to our platform
  // updatedAt = when last edited
});

// ---- Generate slug before saving ----
// "pre" hook runs before every save operation

thesisSchema.pre('save', function (next) {
  // Only generate slug if title changed (or is new)
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()                    // "Heart Disease" → "heart disease"
      .replace(/[^a-z0-9\s-]/g, '')    // Remove special characters
      .replace(/\s+/g, '-')            // Replace spaces with hyphens
      .replace(/-+/g, '-')             // Replace multiple hyphens with single
      .trim();                          // Remove leading/trailing spaces

    // Add a random suffix to avoid duplicates
    // "heart-disease" → "heart-disease-a3f7b2"
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    this.slug = `${this.slug}-${randomSuffix}`;
  }
  next();
});

// ---- Indexes for performance ----
thesisSchema.index({ author: 1, createdAt: -1 });
// ^ Fast lookup: "all thesis by this doctor, newest first"

thesisSchema.index({ visibility: 1, createdAt: -1 });
// ^ Fast lookup: "all public thesis, newest first"

thesisSchema.index({ tags: 1 });
// ^ Fast lookup: "all thesis with this tag"

thesisSchema.index({ slug: 1 });
// ^ Fast lookup by slug (for share links)

const Thesis = mongoose.model('Thesis', thesisSchema);

module.exports = Thesis;
