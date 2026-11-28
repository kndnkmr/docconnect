// ============================================
// Old appointments that nobody closed
// ============================================
// Problem: a doctor's list kept showing requests and visits from weeks or
// months ago as "pending" / "confirmed", next to today's patients.
//
// Rules (pure, unit-tested in tests/oldAppointments.test.js):
//   pending, time passed 3+ days ago           → expire (cancelled, "not confirmed in time")
//   confirmed, time ended 14+ days ago:
//        paid, free, follow-up, or call held   → complete (it happened)
//        unpaid and no call                    → close as cancelled (probably did not happen)
//
// Two ways it runs:
//   * autoExpireRecent(): every 10 min, ONLY pending requests that lapsed 3 to
//     14 days ago (the patient is told once and can book again).
//   * the admin "Tidy old appointments" button: the older backlog, with a
//     preview first and nothing changed until the admin confirms. Backlog
//     items are closed silently (no pushes about months-old visits).
// Every change is written to the appointment's event log.
const Appointment = require('../models/Appointment');
const CallLog = require('../models/CallLog');
const { slotWindowMs } = require('./slots');
const { logEvent } = require('./appointmentEvents');
const { sendPushToUser } = require('./push');
const DAY = 24 * 3600 * 1000;
const PENDING_GRACE_MS = 3 * DAY;
const CONFIRMED_GRACE_MS = 14 * DAY;
// 'expire-pending' | 'complete' | 'close-unpaid' | null
function oldAction(apt, now, { callHeld = false, fee = 0 } = {}) {
  if (!apt) return null;
  const w = slotWindowMs(apt.date, apt.timeSlot);
  if (!w) return null;
  if (apt.status === 'pending') return now - w.start >= PENDING_GRACE_MS ? 'expire-pending' : null;
  if (apt.status === 'confirmed') {
    if (now - w.end < CONFIRMED_GRACE_MS) return null;
    const happened = callHeld || apt.paymentStatus === 'paid' || apt.isFollowUp || !(Number(fee) > 0);
    return happened ? 'complete' : 'close-unpaid';
  }
  return null;
}
const when = (apt) => `${new Date(apt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })} at ${apt.timeSlot}`;
async function load(filter, now) {
  const apts = await Appointment.find({ ...filter, noShow: { $ne: true } })
    .select('doctor patient date timeSlot status paymentStatus isFollowUp events completedAt')
    .populate('doctor', 'name consultationFee')
    .limit(2000);
  const held = new Set((await CallLog.distinct('appointment', { appointment: { $in: apts.map((a) => a._id) } })).map(String));
  return apts.map((a) => ({
    apt: a,
    action: oldAction(a, now, { callHeld: held.has(String(a._id)), fee: a.doctor && a.doctor.consultationFee }),
  })).filter((x) => x.action);
}
// Counts for the admin preview (changes nothing).
async function previewOld(now = Date.now()) {
  const items = await load({ status: { $in: ['pending', 'confirmed'] }, date: { $lt: new Date(now - PENDING_GRACE_MS) } }, now);
  const counts = { 'expire-pending': 0, complete: 0, 'close-unpaid': 0 };
  const byDoctor = {};
  for (const { apt, action } of items) {
    counts[action] += 1;
    const n = (apt.doctor && apt.doctor.name) || 'Unknown';
    byDoctor[n] = (byDoctor[n] || 0) + 1;
  }
  return { total: items.length, counts, byDoctor, generatedAt: new Date(now) };
}
async function apply(item, now, by, { notify }) {
  const { apt, action } = item;
  const w = slotWindowMs(apt.date, apt.timeSlot);
  if (action === 'complete') {
    apt.status = 'completed';
    apt.completedAt = new Date(w ? w.end : now); // original time, so no "please rate" request
    apt.completedBy = 'auto-3days';
    logEvent(apt, { role: 'system', by, action: 'completed', note: 'Closed automatically: the visit time was over 14 days ago' });
  } else {
    const pending = action === 'expire-pending';
    apt.status = 'cancelled';
    apt.cancellationReason = pending ? 'Expired: the doctor did not confirm in time' : 'Closed automatically: time passed and no payment was made';
    logEvent(apt, { role: 'system', by, action: pending ? 'expired' : 'auto_closed', note: apt.cancellationReason });
    if (notify && pending) {
      sendPushToUser(String(apt.patient), {
        title: 'Your appointment request expired',
        body: `Dr. ${(apt.doctor && apt.doctor.name) || ''} could not confirm ${when(apt)}. Tap to book a new time.`,
        url: apt.doctor && apt.doctor._id ? `/book-appointment/${apt.doctor._id}` : '/doctors',
        tag: `expired-${apt._id}`,
      });
    }
  }
  await apt.save({ validateModifiedOnly: true });
}
// Admin: tidy the whole backlog (silent). Returns what was changed.
async function tidyOld(adminId, now = Date.now()) {
  const items = await load({ status: { $in: ['pending', 'confirmed'] }, date: { $lt: new Date(now - PENDING_GRACE_MS) } }, now);
  const done = { 'expire-pending': 0, complete: 0, 'close-unpaid': 0 };
  for (const it of items) {
    try { await apply(it, now, adminId, { notify: false }); done[it.action] += 1; } catch (e) { console.error('[old-appointments]', e.message); }
  }
  return { total: Object.values(done).reduce((a, b) => a + b, 0), counts: done };
}
// Every 10 min: pending requests that lapsed 3 to 14 days ago (patient told once).
async function autoExpireRecent(now = Date.now()) {
  let n = 0;
  try {
    const items = (await load({
      status: 'pending',
      date: { $gte: new Date(now - CONFIRMED_GRACE_MS - DAY), $lt: new Date(now - PENDING_GRACE_MS) },
    }, now)).filter((x) => {
      const w = slotWindowMs(x.apt.date, x.apt.timeSlot);
      return x.action === 'expire-pending' && w && now - w.start < CONFIRMED_GRACE_MS;
    });
    for (const it of items) { await apply(it, now, null, { notify: true }); n += 1; }
  } catch (e) {
    console.error('[old-appointments] auto-expire error:', e.message);
  }
  return n;
}
module.exports = { oldAction, previewOld, tidyOld, autoExpireRecent, PENDING_GRACE_MS, CONFIRMED_GRACE_MS };
