// ============================================
// "Needs help" list + journey reminders + admin appointment search (no DB)
// ============================================
const { test } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const push = require('../utils/push');
const pushed = [];
push.sendPushToUser = (to, payload) => { pushed.push({ to: String(to), ...payload }); };
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { slotWindowMs } = require('../utils/slots');
const { classify } = require('../utils/needsHelp');
const { needsConfirmReminder, needsPayReminder, runJourneyReminders } = require('../utils/journeyReminders');
const admin = require('../controllers/adminController');
const pay = require('../controllers/paymentController');

const H = 60 * 60 * 1000;
const q = (val) => { const p = Promise.resolve(val); for (const k of ['select', 'populate', 'limit', 'sort', 'skip']) p[k] = () => q(val); return p; };

// Build an appointment whose slot starts `inMs` from `now` (IST-aware).
function aptAt(now, inMs, extra = {}) {
  const startIST = new Date(now + inMs + 330 * 60000); // shift to IST wall clock
  const y = startIST.getUTCFullYear(); const m = startIST.getUTCMonth(); const d = startIST.getUTCDate();
  let h = startIST.getUTCHours(); const min = startIST.getUTCMinutes() < 30 ? 0 : 30;
  const fmt = (hh, mm) => `${String(hh % 12 === 0 ? 12 : hh % 12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${hh % 24 >= 12 ? 'PM' : 'AM'}`;
  const endH = min === 30 ? h + 1 : h; const endM = min === 30 ? 0 : 30;
  return {
    _id: Math.random().toString(36).slice(2), status: 'pending', paymentStatus: 'pending',
    date: new Date(Date.UTC(y, m, d)), timeSlot: `${fmt(h, min)} - ${fmt(endH, endM)}`,
    createdAt: new Date(now - 10 * 60000), updatedAt: new Date(now - 10 * 60000),
    ...extra,
  };
}

test('slot window: IST slot → absolute time', () => {
  const w = slotWindowMs(new Date('2026-08-06'), '10:30 AM - 11:00 AM');
  assert.strictEqual(new Date(w.start).toISOString(), '2026-08-06T05:00:00.000Z');
  assert.strictEqual(w.end - w.start, 30 * 60000);
  const late = slotWindowMs(new Date('2026-08-06'), '11:30 PM - 12:00 AM');
  assert.strictEqual(late.end - late.start, 30 * 60000);
  assert.strictEqual(slotWindowMs(new Date('2026-08-06'), 'whenever'), null);
});

test('classify: each stuck case lands in the right group', () => {
  const now = Date.now();
  const g = classify([
    aptAt(now, 3 * H),                                                     // pending, slot in 3h → notConfirmed
    aptAt(now, 3 * 24 * H, { createdAt: new Date(now - 5 * H) }),          // pending 5h old → notConfirmed
    aptAt(now, 3 * 24 * H),                                                // pending, fresh, far slot → fine
    aptAt(now, 60 * 60000, { status: 'confirmed' }),                       // unpaid, 1h away → unpaidSoon
    aptAt(now, 60 * 60000, { status: 'confirmed', isFollowUp: true, paymentStatus: 'paid' }), // free follow-up → fine
    aptAt(now, 24 * H, { status: 'confirmed', paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(now - 4 * H) }), // → paymentWaiting
    aptAt(now, 24 * H, { status: 'confirmed', paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(now - 1 * H) }), // too fresh
    aptAt(now, -5 * H, { status: 'confirmed' }),                           // slot over → slotPassedOpen
    aptAt(now, -5 * H, { status: 'completed' }),                           // done → fine
    aptAt(now, -5 * H, { status: 'cancelled', paymentStatus: 'paid' }),    // → paidCancelled
    aptAt(now, -5 * H, { status: 'cancelled', paymentStatus: 'paid', refundCheckedAt: new Date() }), // checked → fine
    aptAt(now, -5 * H, { status: 'cancelled' }),                           // unpaid cancel → fine
  ], now);
  assert.deepStrictEqual(
    Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length])),
    { notConfirmed: 2, paymentWaiting: 1, unpaidSoon: 1, slotPassedOpen: 1, paidCancelled: 1 }
  );
  assert.ok(slotWindowMs(g.notConfirmed[0].date, g.notConfirmed[0].timeSlot).start
    <= slotWindowMs(g.notConfirmed[1].date, g.notConfirmed[1].timeSlot).start, 'most urgent first');
});

test('doctor confirm reminder: 3h after booking or within 4h of slot, not in the first 30 min', () => {
  const now = Date.now();
  assert.strictEqual(needsConfirmReminder(aptAt(now, 3 * H, { createdAt: new Date(now - 10 * 60000) }), now), false); // too fresh
  assert.strictEqual(needsConfirmReminder(aptAt(now, 3 * H, { createdAt: new Date(now - 40 * 60000) }), now), true);   // slot soon
  assert.strictEqual(needsConfirmReminder(aptAt(now, 48 * H, { createdAt: new Date(now - 2 * H) }), now), false);
  assert.strictEqual(needsConfirmReminder(aptAt(now, 48 * H, { createdAt: new Date(now - 4 * H) }), now), true);       // 3h+ old
  assert.strictEqual(needsConfirmReminder(aptAt(now, 48 * H, { createdAt: new Date(now - 4 * H), confirmReminderSentAt: new Date() }), now), false);
  assert.strictEqual(needsConfirmReminder(aptAt(now, -H, { createdAt: new Date(now - 4 * H) }), now), false);          // slot started
});

test('patient pay reminder: confirmed, unpaid, within 2h, once, not follow-ups', () => {
  const now = Date.now();
  assert.strictEqual(needsPayReminder(aptAt(now, 90 * 60000, { status: 'confirmed' }), now), true);
  assert.strictEqual(needsPayReminder(aptAt(now, 5 * H, { status: 'confirmed' }), now), false);
  assert.strictEqual(needsPayReminder(aptAt(now, 90 * 60000, { status: 'confirmed', paymentStatus: 'patient_claimed' }), now), false);
  assert.strictEqual(needsPayReminder(aptAt(now, 90 * 60000, { status: 'confirmed', isFollowUp: true }), now), false);
  assert.strictEqual(needsPayReminder(aptAt(now, 90 * 60000, { status: 'confirmed', payReminderSentAt: new Date() }), now), false);
});

test('reminder job pushes once and records it', async () => {
  const now = Date.now();
  const pend = aptAt(now, 3 * H, { doctor: 'doc1', createdAt: new Date(now - H) });
  const unpaid = aptAt(now, 90 * 60000, { status: 'confirmed', patient: 'pat1' });
  const sets = [];
  Appointment.find = (query) => q(query.status === 'pending' ? [pend] : [unpaid]);
  Appointment.updateOne = async (f, u) => { sets.push(u.$set); };
  pushed.length = 0;
  const r = await runJourneyReminders(now);
  assert.deepStrictEqual(r, { doctors: 1, patients: 1 });
  assert.strictEqual(pushed[0].to, 'doc1');
  assert.ok(!/pat1/.test(pushed[0].body));
  assert.strictEqual(pushed[1].to, 'pat1');
  assert.ok(sets[0].confirmReminderSentAt && sets[1].payReminderSentAt);
});

test('admin appointment search: by Patient ID across all appointments + payment filter', async () => {
  let userQuery = null; let aptFilter = null;
  User.find = (query) => { userQuery = query; return q([{ _id: 'pat10' }]); };
  Appointment.find = (filter) => { aptFilter = filter; return q([]); };
  Appointment.countDocuments = async () => 0;
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await admin.getAllAppointments({ query: { search: 'PT000010', paymentStatus: 'patient_claimed' } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(userQuery.$or.some((c) => c.patientId));
  assert.deepStrictEqual(aptFilter.$or, [{ patient: { $in: ['pat10'] } }, { doctor: { $in: ['pat10'] } }]);
  assert.strictEqual(aptFilter.paymentStatus, 'patient_claimed');
  const bad = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await admin.getAllAppointments({ query: { paymentStatus: { $ne: 'x' } } }, bad);
  assert.strictEqual(bad.statusCode, 400);
});

test('refund checked: only cancelled appointments; records admin + note', async () => {
  const apt = { _id: 'a1', status: 'cancelled', async save() {} };
  Appointment.findById = () => q(apt);
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await pay.adminRefundChecked({ params: { id: 'a1' }, body: { note: 'Doctor refunded by UPI' }, user: { _id: 'admin1' } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(apt.refundNote, 'Doctor refunded by UPI');
  assert.strictEqual(apt.refundCheckedBy, 'admin1');
  apt.status = 'confirmed';
  const res2 = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await pay.adminRefundChecked({ params: { id: 'a1' }, body: {}, user: { _id: 'admin1' } }, res2);
  assert.strictEqual(res2.statusCode, 400);
});
