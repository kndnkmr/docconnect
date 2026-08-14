// ============================================
// Upload Middleware - Handling File Uploads
// ============================================
// This file configures "multer" — a library that handles file uploads.
//
// PROBLEM IT SOLVES:
// When a user submits a form with a file (like a profile photo),
// the data comes as "multipart/form-data" (not JSON).
// Express can't parse this by default. Multer does it for us.
//
// WHAT MULTER DOES:
// 1. Receives the file from the request
// 2. Validates it (is it an image? is it too big?)
// 3. Saves it to a folder on the server
// 4. Makes file info available via req.file in the controller

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists (for legacy/report uploads)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ---- Memory storage for base64 conversion (profile photos, QR codes) ----
const memoryStorage = multer.memoryStorage();

// ---- Disk storage for larger files (reports, documents) ----
const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// ---- Configure WHAT files are allowed ----
// We allow images (for profile photos) AND PDFs (for document uploads)

const fileFilter = (req, file, cb) => {
  // Check the file's MIME type (the file's actual type, not just extension)
  // Someone could rename "virus.exe" to "virus.jpg" — MIME type catches this
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf'
    // PDF added for document uploads
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
    // null = no error, true = accept the file
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) and PDF files are allowed'), false);
    // Error message, false = reject the file
  }
};

// ---- Create multer instances ----

// For profile photos and QR codes (stored as base64 in MongoDB)
const upload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max for images (phone photos can be large)
});

// For documents/reports (stored on disk — will migrate to cloud later)
const uploadDisk = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max for documents
});

module.exports = { upload, uploadDisk };
