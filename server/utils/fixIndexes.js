// ============================================
// One-time, idempotent index migration
// ============================================
// Background: the User.email field is meant to be a UNIQUE + SPARSE index
// (many patients register with phone only and no email). But an older
// deployment created the email index as unique WITHOUT sparse, and also
// stored missing emails as '' (empty string) instead of leaving them absent.
//
// A non-sparse unique index treats absent/null as a real value and allows
// only ONE such document — so the SECOND phone-only patient (no email) always
// failed with a duplicate-key 500, blocking new patient signups.
//
// Changing the Mongoose schema (default: undefined, sparse: true) does NOT
// rebuild an index that already exists in the database. This migration does:
//   1. Unset '' / null emails so those docs have NO email value at all
//      (done FIRST, so neither the old index nor the rebuild can trip over
//      duplicate empty strings).
//   2. Drop the old email index (removes the stale constraint).
//   3. Recreate the schema indexes (email becomes sparse unique).
//
// Idempotent + defensive: if the email index is already sparse it still makes
// sure no '' / null emails remain, but otherwise does nothing destructive.
// Safe to run on every startup AND on demand via the admin endpoint.

const User = require('../models/User');

async function fixEmailIndex() {
  const report = { changed: false, steps: [] };
  try {
    const before = await User.collection.indexes();
    const emailIdx = before.find((i) => i.key && i.key.email === 1);
    report.emailIndexBefore = emailIdx ? { name: emailIdx.name, unique: !!emailIdx.unique, sparse: !!emailIdx.sparse } : null;

    // 1. ALWAYS normalise empty/null emails to ABSENT first. A sparse index
    //    only exempts documents where the field is missing — an empty string
    //    or null is a real value and still collides. (Phone-only patients
    //    have no real email, so nothing meaningful is lost.) Doing this first
    //    means a later syncIndexes won't fail on duplicate '' values.
    const cleanup = await User.updateMany(
      { $or: [{ email: '' }, { email: null }] },
      { $unset: { email: 1 } }
    );
    const cleaned = cleanup.modifiedCount || cleanup.nModified || 0;
    if (cleaned > 0) { report.steps.push(`unset ${cleaned} empty/null email(s)`); report.changed = true; }

    // 2/3. If the email index is missing or NOT sparse, drop + rebuild it as
    //    the schema's sparse-unique index.
    if (!emailIdx || !emailIdx.sparse) {
      if (emailIdx) {
        await User.collection.dropIndex(emailIdx.name);
        report.steps.push(`dropped stale index "${emailIdx.name}"`);
      }
      await User.syncIndexes();
      report.steps.push('rebuilt indexes from schema (email = sparse unique)');
      report.changed = true;
    }

    const after = await User.collection.indexes();
    const emailIdxAfter = after.find((i) => i.key && i.key.email === 1);
    report.emailIndexAfter = emailIdxAfter ? { name: emailIdxAfter.name, unique: !!emailIdxAfter.unique, sparse: !!emailIdxAfter.sparse } : null;

    if (report.changed) {
      console.log('[migration] fixEmailIndex:', JSON.stringify(report));
    }
    return report;
  } catch (error) {
    // Never crash startup over this — log and continue.
    console.error('[migration] fixEmailIndex failed:', error.message);
    return { ...report, ok: false, error: error.message };
  }
}

module.exports = { fixEmailIndex };
