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

// ============================================
// Double-booking guard (Appointment unique_active_slot)
// ============================================
// The unique index that stops two ACTIVE bookings for the same doctor +
// date + timeSlot was defined with `status: { $ne: 'cancelled' }`, which
// MongoDB rejects for partial indexes, so it was never created. A plain
// index on the same keys can also block it. This:
//   1. Reports the current state (on/off).
//   2. Refuses to build if real duplicate active bookings exist (lists them),
//      since building would fail anyway and they need a human decision.
//   3. Drops the old plain doctor_1_date_1_timeSlot_1 index and any old
//      unique_active_slot with a different filter.
//   4. Creates unique_active_slot with the schema's filter.
// Idempotent; never throws (startup must not crash over this).
const SLOT_KEY = { doctor: 1, date: 1, timeSlot: 1 };
const sameKey = (k) => k && Object.keys(k).join(',') === 'doctor,date,timeSlot' && k.doctor === 1 && k.date === 1 && k.timeSlot === 1;

function describeSlotGuard(indexes, wantedFilter) {
  const idx = (indexes || []).find((i) => i.name === 'unique_active_slot');
  const on = !!(idx && idx.unique && sameKey(idx.key)
    && JSON.stringify(idx.partialFilterExpression || null) === JSON.stringify(wantedFilter));
  return { on, index: idx ? { name: idx.name, unique: !!idx.unique, partialFilterExpression: idx.partialFilterExpression || null } : null };
}

async function getSlotGuardStatus() {
  // Required lazily so the email migration above doesn't load this model.
  const Appointment = require('../models/Appointment');
  const indexes = await Appointment.collection.indexes();
  return { ...describeSlotGuard(indexes, Appointment.ACTIVE_SLOT_FILTER), indexNames: indexes.map((i) => i.name) };
}

async function fixSlotIndex() {
  const Appointment = require('../models/Appointment');
  const report = { changed: false, steps: [] };
  try {
    const wanted = Appointment.ACTIVE_SLOT_FILTER;
    const before = await Appointment.collection.indexes();
    report.before = before.map((i) => i.name);
    if (describeSlotGuard(before, wanted).on) {
      return { ...report, ok: true, on: true };
    }

    // Real duplicates? (two active bookings in one slot)
    const dups = await Appointment.aggregate([
      { $match: wanted },
      { $group: { _id: { doctor: '$doctor', date: '$date', timeSlot: '$timeSlot' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ]);
    if (dups.length) {
      report.duplicates = dups.map((d) => ({ doctor: String(d._id.doctor), date: d._id.date, timeSlot: d._id.timeSlot, appointmentIds: d.ids.map(String) }));
      console.error('[migration] fixSlotIndex: duplicate active bookings found, guard not built:', JSON.stringify(report.duplicates));
      return { ...report, ok: false, on: false, error: 'Duplicate active bookings exist for the same slot. Cancel or move one of each pair, then run this again.' };
    }

    // Drop anything on the same keys that would block it.
    for (const i of before) {
      if (i.name === '_id_') continue;
      if (sameKey(i.key) && (i.name === 'unique_active_slot' || !i.unique)) {
        await Appointment.collection.dropIndex(i.name);
        report.steps.push(`dropped "${i.name}"`);
        report.changed = true;
      }
    }

    await Appointment.collection.createIndex(SLOT_KEY, { unique: true, partialFilterExpression: wanted, name: 'unique_active_slot' });
    report.steps.push('created "unique_active_slot"');
    report.changed = true;

    const status = await getSlotGuardStatus();
    console.log('[migration] fixSlotIndex:', JSON.stringify({ ...report, on: status.on }));
    return { ...report, ok: status.on, on: status.on, after: status.indexNames };
  } catch (error) {
    console.error('[migration] fixSlotIndex failed:', error.message);
    return { ...report, ok: false, on: false, error: error.message };
  }
}

module.exports = { fixEmailIndex, fixSlotIndex, getSlotGuardStatus, describeSlotGuard };
