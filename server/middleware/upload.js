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

// ---- Configure WHERE and HOW files are saved ----
// "diskStorage" = save files to the hard drive (as opposed to memory)

const storage = multer.diskStorage({

  // WHERE to save the file
  destination: function (req, file, cb) {
    // cb = callback. Format: cb(error, destinationFolder)
    // Put PDFs in uploads/thesis/, images in uploads/
    const folder = file.mimetype === 'application/pdf' ? 'uploads/thesis/' : 'uploads/';
    cb(null, folder);
    // This folder must exist! We created them earlier.
  },

  // WHAT to name the file
  filename: function (req, file, cb) {
    // We create a unique filename to avoid overwriting existing files.
    // Format: userId-timestamp.extension
    // Example: 65a1b2c3-1705312000000.jpg

    const uniqueName = `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`;
    // req.user._id = the logged-in user's ID (set by auth middleware)
    // Date.now() = current timestamp in milliseconds (always unique)
    // path.extname() = extracts the file extension (.jpg, .png, etc.)
    // file.originalname = the original filename the user uploaded

    cb(null, uniqueName);
  }
});

// ---- Configure WHAT files are allowed ----
// We allow images (for profile photos) AND PDFs (for thesis uploads)

const fileFilter = (req, file, cb) => {
  // Check the file's MIME type (the file's actual type, not just extension)
  // Someone could rename "virus.exe" to "virus.jpg" — MIME type catches this
  const allowedTypes = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf'
    // PDF added for thesis/publication uploads
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
    // null = no error, true = accept the file
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) and PDF files are allowed'), false);
    // Error message, false = reject the file
  }
};

// ---- Create the multer instance with our configuration ----
const upload = multer({
  storage: storage,
  // ^ Use our custom storage config (where & how to save)

  fileFilter: fileFilter,
  // ^ Use our custom filter (only allow images)

  limits: {
    fileSize: 10 * 1024 * 1024
    // ^ Maximum file size: 10MB
    // Calculation: 10 MB × 1024 KB/MB × 1024 bytes/KB = 10,485,760 bytes
    // Increased from 5MB to support PDF thesis uploads
    // This prevents someone from uploading a 2GB file and crashing your server
  }
});

// ---- Export ----
module.exports = { upload };

// ============================================
// HOW THIS IS USED (in routes/doctor.js):
// ============================================
//
// router.put('/profile', protect, authorize('doctor'), upload.single('profilePhoto'), controller)
//
// upload.single('profilePhoto') means:
// - Expect ONE file
// - The form field name should be "profilePhoto"
// - After processing, the file info is available at req.file:
//   {
//     fieldname: 'profilePhoto',
//     originalname: 'my-photo.jpg',
//     filename: '65a1b2c3-1705312000000.jpg',
//     path: 'uploads/65a1b2c3-1705312000000.jpg',
//     size: 234567
//   }
//
// Other multer methods:
// upload.array('photos', 5)  → accept up to 5 files
// upload.none()              → no files expected (form data only)
// ============================================
