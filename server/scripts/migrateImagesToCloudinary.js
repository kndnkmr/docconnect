// ============================================
// One-time migration: base64 images → Cloudinary
// ============================================
// Moves any existing base64-stored images (doctor QR codes, profile photos,
// payment screenshots, medical reports) to Cloudinary and replaces the stored
// value with the hosted URL. Safe to run multiple times (idempotent): it only
// touches values that still start with "data:".
//
// PREREQUISITES (in server/.env or your shell):
//   MONGODB_URI, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
//
// RUN (from the server/ folder):
//   node scripts/migrateImagesToCloudinary.js

require('dotenv').config();
const mongoose = require('mongoose');
const { uploadFile } = require('../utils/uploadFile');

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const MedicalReport = require('../models/MedicalReport');

// Parse a data URI ("data:<mime>;base64,<data>") into { buffer, mimetype }.
function parseDataUri(dataUri) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUri || '');
  if (!match) return null;
  return { mimetype: match[1], buffer: Buffer.from(match[2], 'base64') };
}

const isBase64 = (v) => typeof v === 'string' && v.startsWith('data:');

async function migrateField(doc, field, folder, counters) {
  const val = doc[field];
  if (!isBase64(val)) return; // already a URL or empty → skip
  const parsed = parseDataUri(val);
  if (!parsed) { counters.skipped++; return; }
  const url = await uploadFile(parsed.buffer, parsed.mimetype, folder);
  if (url && url.startsWith('http')) {
    doc[field] = url;
    await doc.save({ validateBeforeSave: false });
    counters.migrated++;
    console.log(`  ✓ ${doc.constructor.modelName}#${doc._id} ${field} → ${url}`);
  } else {
    counters.failed++;
    console.log(`  ✗ ${doc.constructor.modelName}#${doc._id} ${field} — upload did not return a URL (kept base64)`);
  }
}

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Add it to server/.env');
    process.exit(1);
  }
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Cloudinary env vars are not set. Add CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET to server/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB. Starting migration...\n');

  const counters = { migrated: 0, skipped: 0, failed: 0 };

  // Doctors: QR codes + profile photos
  const doctors = await User.find({
    $or: [{ upiQrCode: /^data:/ }, { profilePhoto: /^data:/ }]
  });
  console.log(`Doctors with base64 images: ${doctors.length}`);
  for (const d of doctors) {
    await migrateField(d, 'upiQrCode', 'promedicoz/qr', counters);
    await migrateField(d, 'profilePhoto', 'promedicoz/profile', counters);
  }

  // Appointments: payment screenshots
  const appts = await Appointment.find({ paymentScreenshot: /^data:/ });
  console.log(`Appointments with base64 screenshots: ${appts.length}`);
  for (const a of appts) {
    await migrateField(a, 'paymentScreenshot', 'promedicoz/payments', counters);
  }

  // Medical reports
  const reports = await MedicalReport.find({ filePath: /^data:/ });
  console.log(`Reports with base64 files: ${reports.length}`);
  for (const r of reports) {
    await migrateField(r, 'filePath', 'promedicoz/reports', counters);
  }

  console.log(`\nDone. Migrated: ${counters.migrated}, skipped: ${counters.skipped}, failed: ${counters.failed}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error('Migration error:', e);
  process.exit(1);
});
