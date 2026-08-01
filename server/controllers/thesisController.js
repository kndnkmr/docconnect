// ============================================
// Thesis Controller - Publication Management Logic
// ============================================
// This handles all thesis/publication operations:
// - Doctor creates/uploads a thesis
// - Doctor updates or deletes their thesis
// - Anyone browses public publications
// - Anyone views a thesis via share link (slug)
// - Doctor views their own publications (including private ones)
//
// KEY CONCEPT: Public vs Private
// Public thesis = anyone can see (no login needed)
// Private thesis = only the author can see (like a draft)

const Thesis = require('../models/Thesis');

// ============================================
// CREATE THESIS - Doctor uploads a publication
// ============================================
// Endpoint: POST /api/thesis
// Body: { title, abstract, content, tags, visibility, publicationDate, coAuthors, institution }
// Optional file: PDF document

const createThesis = async (req, res) => {
  try {
    const {
      title,
      abstract,
      content,
      tags,
      visibility,
      publicationDate,
      coAuthors,
      institution
    } = req.body;

    // Validate required fields
    if (!title || !abstract) {
      return res.status(400).json({
        message: 'Title and abstract are required'
      });
    }

    // Build the thesis object
    const thesisData = {
      author: req.user._id,
      title,
      abstract,
      content: content || '',
      visibility: visibility || 'public',
      institution: institution || ''
    };

    // Handle tags — could come as comma-separated string or array
    if (tags) {
      // If it's a string like "cardiology, research, prevention"
      // Split by comma and trim each tag
      thesisData.tags = Array.isArray(tags)
        ? tags
        : tags.split(',').map(tag => tag.trim().toLowerCase());
      // .map() transforms each item: "  Cardiology  " → "cardiology"
    }

    // Handle co-authors — same logic
    if (coAuthors) {
      thesisData.coAuthors = Array.isArray(coAuthors)
        ? coAuthors
        : coAuthors.split(',').map(name => name.trim());
    }

    // Handle publication date
    if (publicationDate) {
      thesisData.publicationDate = new Date(publicationDate);
    }

    // Handle PDF file upload (if a file was attached)
    if (req.file) {
      thesisData.pdfFile = `/uploads/thesis/${req.file.filename}`;
    }

    // Create in database
    // The slug is generated automatically by the pre-save hook in the model
    const thesis = await Thesis.create(thesisData);

    // Populate author info before responding
    await thesis.populate('author', 'name specialization profilePhoto');

    res.status(201).json({
      message: 'Thesis published successfully!',
      thesis,
      shareLink: `/api/thesis/share/${thesis.slug}`
      // The public link others can use to view this thesis
    });

  } catch (error) {
    console.error('Create thesis error:', error.message);
    res.status(500).json({
      message: 'Error publishing thesis'
    });
  }
};

// ============================================
// GET ALL PUBLIC THESIS - Anyone can browse
// ============================================
// Endpoint: GET /api/thesis
// Query params: ?tag=cardiology&author=doctorId&page=1&limit=10&search=heart
//
// Only shows PUBLIC publications (visibility: 'public')

const getAllPublicThesis = async (req, res) => {
  try {
    // Base filter: only public thesis
    const filter = { visibility: 'public' };

    // Filter by tag
    if (req.query.tag) {
      filter.tags = req.query.tag.toLowerCase();
      // MongoDB can match a single value against an array field
      // If tags = ["cardiology", "research"] and we search for "cardiology", it matches!
    }

    // Filter by author (doctor ID)
    if (req.query.author) {
      filter.author = req.query.author;
    }

    // Search by title or abstract
    if (req.query.search) {
      // $or = "match if ANY of these conditions is true"
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { title: searchRegex },
        { abstract: searchRegex }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sorting options
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (req.query.sort === 'popular') {
      sortOption = { viewCount: -1 }; // Most viewed first
    } else if (req.query.sort === 'oldest') {
      sortOption = { createdAt: 1 };
    }

    const publications = await Thesis.find(filter)
      .populate('author', 'name specialization profilePhoto')
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .select('-content');
      // ^ Exclude full content from listing (it could be very long)
      // We only show title + abstract in the list. Full content on detail page.

    const total = await Thesis.countDocuments(filter);

    res.json({
      publications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalPublications: total
      }
    });

  } catch (error) {
    console.error('Get all thesis error:', error.message);
    res.status(500).json({
      message: 'Error fetching publications'
    });
  }
};

// ============================================
// GET THESIS BY SLUG - Public share link
// ============================================
// Endpoint: GET /api/thesis/share/:slug
// This is the "share link" — anyone with the link can view it
// Example: /api/thesis/share/heart-disease-prevention-methods-a3f7b2

const getThesisBySlug = async (req, res) => {
  try {
    const thesis = await Thesis.findOne({
      slug: req.params.slug,
      visibility: 'public'
      // Only allow viewing if it's public
    }).populate('author', 'name specialization profilePhoto institution');

    if (!thesis) {
      return res.status(404).json({
        message: 'Publication not found or is private'
      });
    }

    // Increment view count
    // $inc = "increment this field by this amount"
    await Thesis.findByIdAndUpdate(thesis._id, { $inc: { viewCount: 1 } });
    thesis.viewCount += 1; // Update the local copy too

    res.json({ thesis });

  } catch (error) {
    console.error('Get thesis by slug error:', error.message);
    res.status(500).json({
      message: 'Error fetching publication'
    });
  }
};

// ============================================
// GET MY THESIS - Doctor views their own publications
// ============================================
// Endpoint: GET /api/thesis/my
// Shows ALL publications (both public and private) for the logged-in doctor

const getMyThesis = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { author: req.user._id };

    // Optionally filter by visibility
    if (req.query.visibility) {
      filter.visibility = req.query.visibility;
    }

    const publications = await Thesis.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Thesis.countDocuments(filter);

    res.json({
      publications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalPublications: total
      }
    });

  } catch (error) {
    console.error('Get my thesis error:', error.message);
    res.status(500).json({
      message: 'Error fetching your publications'
    });
  }
};

// ============================================
// UPDATE THESIS - Doctor edits their publication
// ============================================
// Endpoint: PUT /api/thesis/:id
// Body: { title, abstract, content, tags, visibility, ... }

const updateThesis = async (req, res) => {
  try {
    const thesis = await Thesis.findById(req.params.id);

    if (!thesis) {
      return res.status(404).json({
        message: 'Thesis not found'
      });
    }

    // Verify ownership — only the author can edit
    if (thesis.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only edit your own publications'
      });
    }

    // Allowed fields to update
    const allowedUpdates = [
      'title', 'abstract', 'content', 'tags',
      'visibility', 'coAuthors', 'institution', 'publicationDate'
    ];

    // Apply updates
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        // Handle tags formatting
        if (field === 'tags' && typeof req.body[field] === 'string') {
          thesis[field] = req.body[field].split(',').map(t => t.trim().toLowerCase());
        }
        // Handle coAuthors formatting
        else if (field === 'coAuthors' && typeof req.body[field] === 'string') {
          thesis[field] = req.body[field].split(',').map(n => n.trim());
        }
        else {
          thesis[field] = req.body[field];
        }
      }
    });

    // Handle new PDF upload
    if (req.file) {
      thesis.pdfFile = `/uploads/thesis/${req.file.filename}`;
    }

    await thesis.save();
    // .save() triggers the slug regeneration if title changed

    await thesis.populate('author', 'name specialization profilePhoto');

    res.json({
      message: 'Thesis updated successfully!',
      thesis,
      shareLink: `/api/thesis/share/${thesis.slug}`
    });

  } catch (error) {
    console.error('Update thesis error:', error.message);
    res.status(500).json({
      message: 'Error updating thesis'
    });
  }
};

// ============================================
// DELETE THESIS - Doctor removes their publication
// ============================================
// Endpoint: DELETE /api/thesis/:id

const deleteThesis = async (req, res) => {
  try {
    const thesis = await Thesis.findById(req.params.id);

    if (!thesis) {
      return res.status(404).json({
        message: 'Thesis not found'
      });
    }

    // Verify ownership
    if (thesis.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only delete your own publications'
      });
    }

    await Thesis.findByIdAndDelete(req.params.id);
    // Note: This doesn't delete the PDF file from disk.
    // In a production app, you'd also delete the file.
    // For learning purposes, we'll keep it simple.

    res.json({
      message: 'Thesis deleted successfully'
    });

  } catch (error) {
    console.error('Delete thesis error:', error.message);
    res.status(500).json({
      message: 'Error deleting thesis'
    });
  }
};

// ---- Export all controller functions ----
module.exports = {
  createThesis,
  getAllPublicThesis,
  getThesisBySlug,
  getMyThesis,
  updateThesis,
  deleteThesis
};
