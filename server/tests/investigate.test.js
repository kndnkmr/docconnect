// ============================================
// Admin Investigate: steps for both sides, event log, doctor "not received",
// timeline, warnings, suspension reason. No database required.
// ============================================
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const push = require('../utils/push');
const pushes = [];
push.sendPushToUser = async (id, m) => { pushes.push({ id, ...m }); };
const pay = require('../controllers/paymentController');
const admin = require('../controllers/adminController');
const { stepsFor } = require('../utils/appointmentSteps');
const { logEvent, MAX_EVENTS } = require('../utils/appointmentEvents');
const { buildTimeline, evidenceHistory, maskUpi } = require('../utils/investigate');
const q = (val) => { const p = Promise.resolve(val); for (const k of ['select', 'populate', 'limit', 'sort', 'skip']) p[k] = () => q(val); return p; };
const run = async (handler, { params = {}, body = {}, user = {} } = {}) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ params, body, user, headers: {}, ip: '1.1.1.1', app: { get: () => null } }, res);
  return res;
};
const H = 3600 * 1000;
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const apt = (extra = {}) => ({
  _id: 'a1', status: 'confirmed', paymentStatus: 'pending', doctor: { consultationFee: 300 },
  date: new Date(`${day(3)}T00:00:00Z`), timeSlot: '10:00 AM - 10:30 AM', createdAt: new Date(), updatedAt: new Date(), ...extra,
});
beforeEach(() => { pushes.length = 0; });

test('steps: every state says where the patient and the doctor are', () => {
  const now = Date.now();
  const t = (a) => stepsFor(apt(a), now);
  assert.match(t({ status: 'pending' }).patient.label, /Waiting for the doctor to confirm/);
  assert.match(t({ status: 'pending' }).doctor.label, /Needs to confirm/);
  assert.match(t({ status: 'pending', date: new Date(`${day(-1)}T00:00:00Z`) }).doctor.label, /Did not confirm in time/);
  assert.strictEqual(t({ status: 'pending', date: new Date(`${day(-1)}T00:00:00Z`) }).flag, 'stuck');
  assert.match(t({ confirmedLate: true }).patient.label, /pick a new time/);
  assert.match(t({}).patient.label, /Needs to pay/);
  assert.match(t({}).doctor.label, /Waiting for the patient to pay/);
  assert.match(t({ paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(now - H) }).doctor.label, /Needs to check the payment/);
  assert.strictEqual(t({ paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(now - 4 * H) }).doctor.tone, 'bad');
  const d = t({ paymentStatus: 'patient_claimed', paymentDisputedAt: new Date() });
  assert.strictEqual(d.flag, 'dispute');
  assert.match(d.patient.label, /Says paid\. Doctor says not received/);
  assert.match(d.doctor.label, /NOT received/);
  assert.match(t({ paymentStatus: 'paid' }).doctor.label, /Payment received/);
  assert.match(t({ status: 'completed' }).patient.label, /Consultation done/);
  assert.match(t({ status: 'cancelled' }).patient.label, /Cancelled/);
  assert.match(t({ isFollowUp: true, paymentStatus: 'paid' }).patient.label, /Ready/);
});
test('event log: appends with who/what, and stays capped', () => {
  const a = {};
  logEvent(a, { role: 'patient', by: 'p1', action: 'paid_claimed', note: 'x'.repeat(500) });
  assert.strictEqual(a.events.length, 1);
  assert.strictEqual(a.events[0].role, 'patient');
  assert.strictEqual(a.events[0].note.length, 300);
  for (let i = 0; i < MAX_EVENTS + 10; i += 1) logEvent(a, { role: 'system', action: `e${i}` });
  assert.strictEqual(a.events.length, MAX_EVENTS);
  assert.strictEqual(a.events[a.events.length - 1].action, `e${MAX_EVENTS + 9}`);
});
const claimed = (extra = {}) => ({
  _id: 'a1', doctor: { toString: () => 'd1' }, patient: 'p1', status: 'confirmed', paymentStatus: 'patient_claimed',
  paymentUTR: '412345678901', paymentScreenshot: 'https://x/shot.jpg', paymentClaimedAt: new Date(), date: new Date(`${day(1)}T00:00:00Z`), timeSlot: '10:00 AM - 10:30 AM',
  async save() {}, ...extra,
});
test('doctor "not received": flags it, tells the patient, logs it; only the doctor, only after a claim', async () => {
  const a = claimed();
  Appointment.findById = () => q(a);
  const r = await run(pay.doctorPaymentNotReceived, { params: { id: 'a1' }, body: { note: 'no money in my UPI' }, user: { _id: 'd1' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.ok(a.paymentDisputedAt);
  assert.strictEqual(a.paymentDisputeNote, 'no money in my UPI');
  assert.strictEqual(a.events[0].action, 'not_received');
  assert.strictEqual(a.events[0].role, 'doctor');
  assert.match(pushes[0].title, /could not find your payment/);
  assert.match(pushes[0].body, /UPI reference|screenshot/);
  // asking twice does not notify twice
  pushes.length = 0;
  await run(pay.doctorPaymentNotReceived, { params: { id: 'a1' }, body: {}, user: { _id: 'd1' } });
  assert.strictEqual(pushes.length, 0);
  // someone else's appointment
  assert.strictEqual((await run(pay.doctorPaymentNotReceived, { params: { id: 'a1' }, body: {}, user: { _id: 'd2' } })).statusCode, 403);
  // no claim yet
  Appointment.findById = () => q(claimed({ paymentStatus: 'pending' }));
  assert.strictEqual((await run(pay.doctorPaymentNotReceived, { params: { id: 'a1' }, body: {}, user: { _id: 'd1' } })).statusCode, 400);
});
test('evidence survives: undoing a claim and an admin reset keep the screenshot and UTR in the log', async () => {
  const a = claimed({ patient: { toString: () => 'p1' } });
  Appointment.findById = () => q(a);
  const r = await run(pay.undoPaymentClaim, { params: { id: 'a1' }, user: { _id: 'p1' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.strictEqual(a.paymentUTR, '');
  const kept = evidenceHistory(a);
  assert.strictEqual(kept.length, 1);
  assert.strictEqual(kept[0].utr, '412345678901');
  assert.strictEqual(kept[0].screenshot, 'https://x/shot.jpg');
  // admin reset
  const b = claimed({ doctor: { _id: 'd1', name: 'D', consultationFee: 300 } });
  Appointment.findById = () => q(b);
  const r2 = await run(pay.adminPaymentAction, { params: { id: 'a1' }, body: { action: 'reset', note: 'checked with doctor' }, user: { _id: 'adm' } });
  assert.strictEqual(r2.statusCode, 200, JSON.stringify(r2.body));
  assert.strictEqual(b.paymentScreenshot, '');
  assert.strictEqual(evidenceHistory(b)[0].utr, '412345678901');
  assert.strictEqual(b.events[0].action, 'admin_reset');
});
test('timeline: logged events plus the old timestamps, in time order', () => {
  const t0 = Date.now() - 5 * H;
  const a = {
    createdAt: new Date(t0), paymentClaimedAt: new Date(t0 + H), paymentReminderSentAt: new Date(t0 + 2 * H), paidAt: new Date(t0 + 3 * H), paymentMarkedByRole: 'doctor',
    events: [{ at: new Date(t0 + 4 * H), role: 'admin', action: 'admin_note', note: 'called both' }],
  };
  const tl = buildTimeline(a);
  assert.deepStrictEqual(tl.map((e) => e.action), ['booked', 'paid_claimed', 'reminded_doctor', 'marked_paid', 'admin_note']);
  assert.strictEqual(tl[0].derived, true);
  // a logged event is not doubled by its old timestamp
  const b = { createdAt: new Date(t0), events: [{ at: new Date(t0), role: 'patient', action: 'booked' }] };
  assert.strictEqual(buildTimeline(b).length, 1);
});
test('maskUpi hides most of the doctor UPI id', () => {
  assert.strictEqual(maskUpi('9433347933@ybl'), '943***@ybl');
  assert.strictEqual(maskUpi(''), '');
});
test('admin warn: needs a reason, tells the person, keeps it on their record', async () => {
  const u = { _id: 'u1', name: 'Usha', role: 'patient', warnings: [], async save() {} };
  User.findById = () => q(u);
  Appointment.findById = () => q(null);
  assert.strictEqual((await run(admin.warnUser, { params: { id: 'u1' }, body: {}, user: { _id: 'adm' } })).statusCode, 400);
  const r = await run(admin.warnUser, { params: { id: 'u1' }, body: { reason: 'Please do not claim a payment you have not made.' }, user: { _id: 'adm' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(u.warnings.length, 1);
  assert.strictEqual(u.warnings[0].by, 'adm');
  assert.match(pushes[0].body, /do not claim a payment/);
  User.findById = () => q({ _id: 'x', role: 'admin', warnings: [] });
  assert.strictEqual((await run(admin.warnUser, { params: { id: 'x' }, body: { reason: 'r' }, user: { _id: 'adm' } })).statusCode, 400);
});
test('admin suspend: reason required, records who, tells the person; reactivate clears it', async () => {
  const u = { _id: 'u1', name: 'Dr X', role: 'doctor', async save() {} };
  User.findById = () => q(u);
  assert.strictEqual((await run(admin.setUserSuspension, { params: { id: 'u1' }, body: { suspend: true }, user: { _id: 'adm' } })).statusCode, 400);
  const r = await run(admin.setUserSuspension, { params: { id: 'u1' }, body: { suspend: true, reason: 'Said payment not received but money was paid' }, user: { _id: 'adm' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(u.isSuspended, true);
  assert.strictEqual(u.suspendedBy, 'adm');
  assert.match(pushes[0].body, /Said payment not received/);
  await run(admin.setUserSuspension, { params: { id: 'u1' }, body: { suspend: false }, user: { _id: 'adm' } });
  assert.strictEqual(u.isSuspended, false);
  assert.strictEqual(u.suspendedReason, '');
  assert.strictEqual(u.suspendedBy, null);
});
test('privacy: the event log and the doctor\'s dispute note are never sent to patients or doctors', () => {
  const a = new Appointment({
    patient: '64b000000000000000000001', doctor: '64b000000000000000000002', date: new Date(), timeSlot: '10:00 AM - 10:30 AM', reason: 'x',
    paymentDisputeNote: 'patient is lying', events: [{ role: 'admin', action: 'admin_note', note: 'secret' }],
  });
  const json = JSON.parse(JSON.stringify(a));
  assert.strictEqual(json.events, undefined);
  assert.strictEqual(json.paymentDisputeNote, undefined);
  // admin's Investigate reads them with toObject, which is not stripped
  assert.strictEqual(a.toObject().events.length, 1);
});
