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
//   1. Drop the old email index (removes the constraint temporarily).
//   2. Unset '' / null emails so those docs have NO email value at all.
//   3. Recreate the schema indexes (email becomes sparse unique).
//
// Idempotent: if the email index is already sparse, it does nothing. Safe to
// run on every startup.

const User = require('../models/User');

async function fixEmailIndex() {
  try {
    const indexes = await User.collection.indexes();
    const emailIdx = indexes.find((i) => i.key && i.key.email === 1);

    // Already correct (sparse) — nothing to do.
    if (emailIdx && emailIdx.sparse) return { changed: false };

    // 1. Drop the old non-sparse email index if it exists, so the next steps
    //    aren't blocked by its uniqueness constraint.
    if (emailIdx) {
      await User.collection.dropIndex(emailIdx.name);
    }

    // 2. Make empty/null emails truly absent — a sparse index only exempts
    //    ABSENT fields, not empty strings. (Phone-only patients have no real
    //    email, so nothing meaningful is lost.)
    await User.updateMany(
      { $or: [{ email: '' }, { email: null }] },
      { $unset: { email: 1 } }
    );

    // 3. Rebuild indexes to match the current schema (email = sparse unique).
    await User.syncIndexes();

    console.log('[migration] User email index rebuilt as sparse unique');
    return { changed: true };
  } catch (error) {
    // Never crash startup over this — log and continue. Registration of NEW
    // phone-only users still can't be worse than before if this fails.
    console.error('[migration] fixEmailIndex failed:', error.message);
    return { changed: false, error: error.message };
  }
}

module.exports = { fixEmailIndex };
