// ============================================
// Upload helper - Cloudinary with base64 fallback
// ============================================
// Uploads an in-memory file (from multer memoryStorage) and returns a string to
// store in MongoDB:
//   - If Cloudinary is configured → a hosted https URL (keeps the DB small)
//   - Otherwise → a base64 data URI (the previous behaviour, so nothing breaks
//     before Cloudinary credentials are set, and as a safety fallback)
//
// Configure with environment variables:
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

const cloudinary = require('cloudinary').v2;

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return false; // not configured → caller falls back to base64
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
  configured = true;
  return true;
}

// Convert a buffer to a base64 data URI (the fallback / legacy format).
function toBase64(buffer, mimetype) {
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

// Upload a file buffer. Returns a URL (Cloudinary) or a base64 data URI (fallback).
// folder: logical folder in Cloudinary, e.g. 'promedicoz/reports'
async function uploadFile(buffer, mimetype, folder = 'promedicoz') {
  // If Cloudinary isn't set up, keep the existing base64 behaviour.
  if (!ensureConfigured()) {
    return toBase64(buffer, mimetype);
  }

  try {
    const dataUri = toBase64(buffer, mimetype);
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: 'auto', // handles images and PDFs
      // Keep originals reasonable in size for images (no-op for PDFs)
      transformation: mimetype.startsWith('image/')
        ? [{ width: 1600, height: 1600, crop: 'limit' }]
        : undefined
    });
    return result.secure_url;
  } catch (error) {
    // If Cloudinary fails for any reason, fall back to base64 so the upload
    // never fails for the user.
    console.error('Cloudinary upload failed, falling back to base64:', error.message);
    return toBase64(buffer, mimetype);
  }
}

module.exports = { uploadFile };
