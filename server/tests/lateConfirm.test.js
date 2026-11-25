// ============================================
// Doctor confirms after the booked time has passed: the patient picks a new
// time on the SAME appointment and goes straight to payment. No database.
// ============================================
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const push = require('../utils/push');
const pushes = [];
push.sendPushToUser = async (id, m) => { pushes.push(m); };
const appt = require('../controllers/appointmentController');
const pay = require('../controllers/paymentController');
const { needsSlotPassedNudge } = require('../utils/journeyReminders');
const q = (val) => { const p = Promise.resolve(val); p.select = () => q(val); p.populate = () => q(val); return p; };
const run = async (handler, { params = {}, body = {}, user = {} } = {}) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ params, body, user, headers: {}, ip: '1.1.1.1', app: { get: () => null } }, res, () => {});
  return res;
};
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
beforeEach(() => { pushes.length = 0; });
const makeApt = (extra = {}) => ({
  _id: 'a1', doctor: 'd1', patient: { _id: 'p1', name: 'Usha', toString: () => 'p1' }, status: 'pending', paymentStatus: 'pending',
  date: new Date(`${day(-1)}T00:00:00Z`), timeSlot: '10:00 AM - 10:30 AM', confirmedLate: false,
  markModified() {}, async save() {},
  async populate() { this.doctor = { _id: 'd1', name: 'Pooja Singh', consultationFee: 300, toString: () => 'd1' }; },
  ...extra,
});
test('confirming a booking whose time has passed marks it confirmedLate and asks for a new time', async () => {
  const apt = makeApt();
  Appointment.findById = () => q(apt);
  const r = await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'confirmed' }, user: { _id: 'd1' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(apt.status, 'confirmed');
  assert.strictEqual(apt.confirmedLate, true);
  assert.strictEqual(r.body.confirmedLate, true);
  assert.match(r.body.message, /pick a new time/);
  assert.match(pushes[0].title, /Pick a new time/);
  assert.ok(!/pay/i.test(pushes[0].title), 'must not tell the patient to pay for a past slot');
});
test('confirming a future booking is unchanged (not late, asks to pay)', async () => {
  const apt = makeApt({ date: new Date(`${day(3)}T00:00:00Z`) });
  Appointment.findById = () => q(apt);
  const r = await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'confirmed' }, user: { _id: 'd1' } });
  assert.strictEqual(apt.confirmedLate, false);
  assert.strictEqual(r.body.confirmedLate, false);
  assert.match(pushes[0].title, /pay Rs\. 300/);
});
// A Thursday far ahead keeps the doctor's hours simple.
const DATE = '2099-01-01';
const SLOT = '10:30 AM - 11:00 AM';
const doctor = { _id: 'd1', name: 'Pooja Singh', role: 'doctor', blockedDates: [], blockedPatients: [], availability: [{ day: 'Thursday', startTime: '09:00', endTime: '13:00' }], slotDuration: 30 };
const resched = (apt) => {
  Appointment.findById = () => q(apt);
  Appointment.findOne = () => q(null);
  User.findOne = () => q(doctor);
  User.findById = () => q({ _id: 'p1', name: 'Usha' });
  return run(appt.rescheduleAppointment, { params: { id: 'a1' }, body: { date: DATE, timeSlot: SLOT }, user: { _id: 'p1', name: 'Usha' } });
};
test('rescheduling a late-confirmed appointment keeps it confirmed (straight to payment)', async () => {
  const apt = makeApt({ status: 'confirmed', confirmedLate: true });
  const r = await resched(apt);
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.strictEqual(apt.status, 'confirmed');
  assert.strictEqual(apt.confirmedLate, false);
  assert.strictEqual(r.body.keepConfirmed, true);
  assert.match(r.body.message, /payment/);
  assert.match(pushes[0].body, /No action needed/);
});
test('rescheduling a normal confirmed appointment still goes back to pending', async () => {
  const apt = makeApt({ status: 'confirmed', confirmedLate: false, date: new Date(`${day(3)}T00:00:00Z`) });
  const r = await resched(apt);
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.strictEqual(apt.status, 'pending');
  assert.strictEqual(r.body.keepConfirmed, false);
  assert.match(pushes[0].body, /re-confirm/);
});
test('rescheduling a still-pending (never confirmed) appointment stays pending', async () => {
  const apt = makeApt({ status: 'pending' });
  const r = await resched(apt);
  assert.strictEqual(apt.status, 'pending');
  assert.strictEqual(r.body.keepConfirmed, false);
});
test('paying is refused while the booked time has passed and no new time is chosen', async () => {
  const apt = makeApt({ status: 'confirmed', confirmedLate: true });
  Appointment.findById = () => q(apt);
  const r = await run(pay.notifyPayment || pay.uploadPaymentScreenshot || Object.values(pay).find((f) => typeof f === 'function'), { params: { id: 'a1' }, body: {}, user: { _id: 'p1' } });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /pick a new time/);
});
test('patient is nudged once when a pending booking time has passed (not future, not old, not twice)', () => {
  const now = Date.now();
  const mk = (d, extra = {}) => ({ status: 'pending', slotPassedNudgeAt: null, date: new Date(`${day(d)}T00:00:00Z`), timeSlot: '12:00 AM - 12:30 AM', ...extra });
  assert.ok(needsSlotPassedNudge(mk(-1), now));
  assert.ok(!needsSlotPassedNudge(mk(2), now), 'future');
  assert.ok(!needsSlotPassedNudge(mk(-10), now), 'too old');
  assert.ok(!needsSlotPassedNudge(mk(-1, { slotPassedNudgeAt: new Date() }), now), 'already nudged');
  assert.ok(!needsSlotPassedNudge(mk(-1, { status: 'confirmed' }), now), 'not pending');
});
