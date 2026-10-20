// ============================================
// One-time, idempotent doctor-slug backfill
// ============================================
// The vanity-URL feature adds a `slug` to each doctor (e.g. "pooja-singh" →
// promedicoz.in/dr/pooja-singh). New doctors get one automatically from the
// User pre-save hook, but doctors who registered BEFORE this feature have no
// slug yet. This assigns one to each of them, uniquely.
//
// Idempotent + safe to run on every startup: it only touches doctors that are
// still missing a slug, and never changes a slug that already exists (so
// already-shared links stay stable). Never throws out of this function — a
// failure here must never block server startup.

const User = require('../models/User');

async function backfillDoctorSlugs() {
  const report = { assigned: 0, skipped: 0 };
  try {
    // Only doctors with no slug yet. (Patients/admins never get one.)
    const doctors = await User.find({
      role: 'doctor',
      $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }]
    }).select('_id name slug');

    for (const doc of doctors) {
      try {
        const slug = await User.generateUniqueSlug(doc.name, doc._id);
        // Write the slug directly (updateOne) so we don't run the full save
        // validation/hooks on an otherwise-untouched legacy document.
        await User.updateOne({ _id: doc._id }, { $set: { slug } });
        report.assigned += 1;
      } catch (e) {
        report.skipped += 1;
        console.error(`[migration] backfillDoctorSlugs: could not slug ${doc._id}:`, e.message);
      }
    }

    if (report.assigned > 0) {
      console.log('[migration] backfillDoctorSlugs:', JSON.stringify(report));
    }
    return report;
  } catch (error) {
    // Never crash startup over this — log and continue.
    console.error('[migration] backfillDoctorSlugs failed:', error.message);
    return { ...report, ok: false, error: error.message };
  }
}

module.exports = { backfillDoctorSlugs };
