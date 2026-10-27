// ============================================
// Payment flow — every state has a way forward (no database required)
// ============================================
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const push = require('../utils/push');
const pushed = [];
push.sendPushToUser = (to, payload) => { pushed.push({ to: String(to), ...payload }); };
const upload = require('../utils/uploadFile');
upload.uploadFile = async () => 'https://res.cloudinary.com/x/receipt.jpg';
const mail = require('../utils/sendEmail');
const emails = [];
mail.sendEmail = async (m) => { emails.push(m); return { success: true }; };
const pay = require('../controllers/paymentController');
const { runPaymentFollowUp } = require('../utils/paymentFollowUp');

const q = (val) => { const p = Promise.resolve(val); p.select = () => q(val); p.populate = () => q(val); p.limit = () => q(val); return p; };
const H = 60 * 60 * 1000;

const makeApt = (extra = {}) => ({
  _id: 'a1', patient: 'pat1', doctor: 'doc1', status: 'confirmed', paymentStatus: 'pending',
  date: new Date('2099-01-01'), timeSlot: '10:30 AM - 11:00 AM',
  paymentScreenshot: '', paymentUTR: '', paymentClaimedAt: null, paymentReminderSentAt: null,
  saved: 0, async save() { this.saved += 1; },
  ...extra,
});

let apt; let emitted;
beforeEach(() => {
  apt = makeApt(); pushed.length = 0; emitted = [];
  Appointment.findById = () => q(apt);
});

const run = async (handler, { body = {}, user = { _id: 'pat1', role: 'patient' }, file } = {}) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const io = { to: (room) => ({ emit: (ev, data) => emitted.push({ room, ev, data }) }) };
  await handler({ params: { id: 'a1' }, body, user, file, app: { get: () => io } }, res);
  return res;
};

test('"I\'ve paid" really notifies the doctor (push + live refresh)', async () => {
  const r = await run(pay.notifyPayment);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(apt.paymentStatus, 'patient_claimed');
  assert.ok(apt.paymentClaimedAt instanceof Date);
  assert.strictEqual(pushed[0].to, 'doc1');
  assert.ok(!pushed[0].body.includes('pat1'));
  assert.deepStrictEqual(emitted[0], { room: 'user:doc1', ev: 'appointment-updated', data: { appointmentId: 'a1' } });
});

test('UTR: 12 digits accepted (spaces ok) and shown to the doctor; bad UTR refused', async () => {
  assert.strictEqual((await run(pay.notifyPayment, { body: { utr: '1234' } })).statusCode, 400);
  assert.strictEqual(apt.paymentStatus, 'pending');
  const r = await run(pay.notifyPayment, { body: { utr: '4321 0987 6543' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(apt.paymentUTR, '432109876543');
  assert.match(pushed[0].body, /432109876543/);
});

test('screenshot upload counts as "I\'ve paid"; can be replaced while waiting', async () => {
  const file = { buffer: Buffer.from('x'), mimetype: 'image/png' };
  const r = await run(pay.uploadPaymentScreenshot, { file });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(apt.paymentStatus, 'patient_claimed');
  assert.ok(apt.paymentScreenshot);
  const again = await run(pay.uploadPaymentScreenshot, { file });
  assert.strictEqual(again.body.message, 'Screenshot replaced');
  assert.strictEqual((await run(pay.uploadPaymentScreenshot, {})).statusCode, 400); // no file
});

test('"I haven\'t paid yet" brings the pay screen back (Bharti/Usha case)', async () => {
  apt = makeApt({ paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(), paymentUTR: '432109876543' });
  const r = await run(pay.undoPaymentClaim);
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(apt.paymentStatus, 'pending');
  assert.strictEqual(apt.paymentUTR, '');
  assert.strictEqual(apt.paymentClaimedAt, null);
});

test('nothing changes once paid or cancelled; other patients refused', async () => {
  apt = makeApt({ paymentStatus: 'paid' });
  for (const h of [pay.notifyPayment, pay.undoPaymentClaim, pay.remindDoctorAboutPayment]) {
    assert.strictEqual((await run(h)).statusCode, 400);
  }
  assert.strictEqual((await run(pay.uploadPaymentScreenshot, { file: { buffer: Buffer.from('x'), mimetype: 'image/png' } })).statusCode, 400);
  assert.strictEqual(apt.paymentStatus, 'paid');
  apt = makeApt({ status: 'cancelled' });
  assert.strictEqual((await run(pay.notifyPayment)).statusCode, 400);
  apt = makeApt();
  assert.strictEqual((await run(pay.notifyPayment, { user: { _id: 'someoneElse' } })).statusCode, 403);
});

test('remind doctor: after 2h, then at most every 6h', async () => {
  apt = makeApt({ paymentStatus: 'patient_claimed', paymentClaimedAt: new Date(Date.now() - 30 * 60 * 1000) });
  assert.strictEqual((await run(pay.remindDoctorAboutPayment)).statusCode, 429);
  apt.paymentClaimedAt = new Date(Date.now() - 3 * H);
  const ok = await run(pay.remindDoctorAboutPayment);
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(pushed.length, 1);
  assert.strictEqual((await run(pay.remindDoctorAboutPayment)).statusCode, 429);
  apt.paymentReminderSentAt = new Date(Date.now() - 7 * H);
  assert.strictEqual((await run(pay.remindDoctorAboutPayment)).statusCode, 200);
});

test('admin payment help: mark paid (records admin) and reset', async () => {
  const admin = { _id: 'admin1', role: 'admin' };
  apt = makeApt({ paymentStatus: 'patient_claimed', doctor: { _id: 'doc1', name: 'Anjali', consultationFee: 500 } });
  const paid = await run(pay.adminPaymentAction, { body: { action: 'mark_paid', note: 'Doctor confirmed on call' }, user: admin });
  assert.strictEqual(paid.statusCode, 200);
  assert.strictEqual(apt.paymentStatus, 'paid');
  assert.strictEqual(apt.amountCollected, 500);
  assert.strictEqual(apt.paymentMarkedByRole, 'admin');
  assert.strictEqual(apt.paymentMarkedBy, 'admin1');
  assert.strictEqual(pushed.at(-1).to, 'pat1');

  // Resetting a PAID appointment needs a note.
  assert.strictEqual((await run(pay.adminPaymentAction, { body: { action: 'reset' }, user: admin })).statusCode, 400);
  const reset = await run(pay.adminPaymentAction, { body: { action: 'reset', note: 'Marked by mistake' }, user: admin });
  assert.strictEqual(reset.statusCode, 200);
  assert.strictEqual(apt.paymentStatus, 'pending');
  assert.strictEqual(apt.amountCollected, 0);
  assert.strictEqual((await run(pay.adminPaymentAction, { body: { action: 'nonsense' }, user: admin })).statusCode, 400);
});

test('follow-up job: nudges doctor (3h) and alerts admin (24h), once each', async () => {
  const updates = [];
  const old = { _id: 'a9', doctor: 'doc1', date: new Date('2099-01-01'), timeSlot: '10:30 AM - 11:00 AM' };
  let calls = 0;
  Appointment.find = (query) => {
    calls += 1;
    // Legacy claims (no paymentClaimedAt) are covered via updatedAt.
    assert.ok(query.$or && query.$or.some((c) => c.paymentClaimedAt === null && c.updatedAt));
    return q(calls === 1 ? [old] : [{ ...old, patient: { name: 'Bharti', patientId: 'PT000010' }, doctor: { name: 'Anjali' } }]);
  };
  Appointment.updateOne = async (f, u) => { updates.push(u.$set); };
  Appointment.updateMany = async (f, u) => { updates.push(u.$set); };
  User.find = () => q([{ _id: 'admin1' }]);
  const r = await runPaymentFollowUp(Date.now());
  assert.deepStrictEqual(r, { doctors: 1, admin: 1 });
  assert.ok(updates[0].paymentDoctorNudgedAt);
  assert.ok(updates[1].paymentAdminAlertedAt);
  assert.ok(pushed.some((p) => p.to === 'doc1'));
  assert.ok(pushed.some((p) => p.to === 'admin1'));
});
