// ============================================
// Fixes from the Oct 2026 review — no database required (stubs)
// ============================================
// 1 doctor Complete only after the slot starts; cancel says what happened
// 3 a password reset signs out every other device
// 4 the reset link is never in the reply outside a developer's machine
// 5 a free follow-up visit must be inside its free window (book + reschedule)
// 7 reviews: whole stars, comment ≤ 500 with a clear message
// 8 no call room for a cancelled / unconfirmed appointment
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
process.env.DAILY_API_KEY = 'x'; process.env.DAILY_DOMAIN = 'example.daily.co';
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const push = require('../utils/push');
// Stub before the controllers load (they keep their own reference).
const pushes = [];
push.sendPushToUser = async (id, m) => { pushes.push(m); };
const { protect } = require('../middleware/auth');
const appt = require('../controllers/appointmentController');
const reviews = require('../controllers/reviewController');
const { followUpDateOk, createBooking } = require('../utils/booking');

const q = (val) => { const p = Promise.resolve(val); p.select = () => q(val); p.populate = () => q(val); return p; };
const run = async (handler, { params = {}, body = {}, user = {}, headers = {} } = {}) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  let nexted = false;
  await handler({ params, body, user, headers, ip: '1.1.1.1', app: { get: () => null } }, res, () => { nexted = true; });
  return { ...res, nexted };
};
beforeEach(() => { pushes.length = 0; });

const futureDay = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

// ---------- 3: password reset signs out other devices ----------
test('old login tokens stop working after a password reset; the new one works', async () => {
  const issuedAt = Math.floor(Date.now() / 1000) - 3600; // an hour ago
  const oldToken = jwt.sign({ id: 'u1', iat: issuedAt }, process.env.JWT_SECRET);
  const changedAt = new Date(Date.now() - 1000);
  User.findById = () => q({ _id: 'u1', role: 'patient', passwordChangedAt: changedAt });
  const before = await run(protect, { headers: { authorization: `Bearer ${oldToken}` } });
  assert.strictEqual(before.statusCode, 401);
  assert.match(before.body.message, /password was changed/);
  const fresh = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET); // issued "now", like after reset
  const after = await run(protect, { headers: { authorization: `Bearer ${fresh}` } });
  assert.ok(after.nexted, 'new token accepted');
  // Accounts that never reset are unaffected
  User.findById = () => q({ _id: 'u1', role: 'patient' });
  assert.ok((await run(protect, { headers: { authorization: `Bearer ${oldToken}` } })).nexted);
});

// ---------- 4: reset link never in the reply on a server ----------
test('forgot-password never returns the reset link unless on a local dev machine', async () => {
  const auth = require('../controllers/authController');
  const mail = require('../utils/sendEmail');
  mail.sendEmail = async () => ({ success: true });
  const user = { _id: 'u1', email: 'a@example.com', name: 'A', async save() {} };
  User.findOne = () => q(user);
  const saved = { NODE_ENV: process.env.NODE_ENV, RENDER: process.env.RENDER };
  try {
    for (const [env, render, expect] of [[undefined, undefined, false], ['staging', undefined, false], ['production', undefined, false], ['development', 'true', false], ['development', undefined, true]]) {
      if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
      if (render === undefined) delete process.env.RENDER; else process.env.RENDER = render;
      const r = await run(auth.forgotPassword, { body: { email: 'a@example.com' } });
      assert.strictEqual('resetUrl' in (r.body || {}), expect, `NODE_ENV=${env} RENDER=${render}`);
    }
  } finally {
    if (saved.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.NODE_ENV;
    if (saved.RENDER === undefined) delete process.env.RENDER; else process.env.RENDER = saved.RENDER;
  }
});

// ---------- 1 / 2: doctor status changes ----------
const makeApt = (extra = {}) => ({
  _id: 'a1', doctor: 'd1', patient: { _id: 'p1', toString: () => 'p1' }, status: 'confirmed', paymentStatus: 'paid',
  date: new Date(`${futureDay(3)}T00:00:00Z`), timeSlot: '10:00 AM - 10:30 AM',
  markModified() {}, async save() {}, async populate() { this.doctor = { _id: 'd1', name: 'Pooja Singh', consultationFee: 300, toString: () => 'd1' }; },
  ...extra,
});
test('Complete is refused before the consultation starts, allowed after', async () => {
  let apt = makeApt();
  Appointment.findById = () => q(apt);
  const early = await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'completed' }, user: { _id: 'd1' } });
  assert.strictEqual(early.statusCode, 400);
  assert.match(early.body.message, /once it has started/);
  assert.strictEqual(apt.status, 'confirmed', 'not changed');
  apt = makeApt({ date: new Date(`${futureDay(-1)}T00:00:00Z`) });
  Appointment.findById = () => q(apt);
  const ok = await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'completed' }, user: { _id: 'd1' } });
  assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.strictEqual(apt.status, 'completed');
});

test('doctor cancel: reason stored; patient told honestly (+ refund help if paid)', async () => {
  let apt = makeApt();
  Appointment.findById = () => q(apt);
  await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'cancelled' }, user: { _id: 'd1' } });
  assert.strictEqual(apt.cancellationReason, 'Cancelled by the doctor');
  assert.match(pushes[0].title, /cancelled by the doctor/);
  assert.match(pushes[0].body, /had to cancel.*refund/);
  assert.strictEqual(pushes[0].url, '/cancellation-refund');
  pushes.length = 0;
  apt = makeApt({ status: 'pending', paymentStatus: 'pending' });
  Appointment.findById = () => q(apt);
  await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'cancelled' }, user: { _id: 'd1' } });
  assert.strictEqual(apt.cancellationReason, 'Declined by the doctor');
  assert.match(pushes[0].title, /not confirmed/);
  assert.ok(!/refund/.test(pushes[0].body));
});

// ---------- 5: follow-up window ----------
test('follow-up visit must be on/before the free-till day (IST)', () => {
  const deadline = new Date('2026-11-12T10:00:00Z'); // 12 Nov IST
  assert.ok(followUpDateOk('2026-11-12', deadline));
  assert.ok(followUpDateOk('2026-11-05', deadline));
  assert.ok(!followUpDateOk('2026-11-13', deadline));
  assert.ok(!followUpDateOk('2026-12-20', deadline));
  assert.ok(!followUpDateOk('2026-11-05', null));
  // 11 Nov 20:00 UTC = 12 Nov 01:30 IST → last free day is 12 Nov
  assert.ok(followUpDateOk('2026-11-12', new Date('2026-11-11T20:00:00Z')));
});

test('booking a free follow-up far after its window is refused', async () => {
  const day = futureDay(40);
  const weekday = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  User.findById = () => q({ _id: 'p1', role: 'patient', familyMembers: [] });
  User.findOne = () => q({ _id: 'd1', name: 'Doc', role: 'doctor', blockedDates: [], blockedPatients: [], availability: [{ day: weekday, startTime: '09:00', endTime: '13:00' }], slotDuration: 30, consultationModes: ['video'] });
  Appointment.findOne = () => q(null);
  Appointment.findById = () => q({ _id: 'o1', patient: 'p1', doctor: 'd1', status: 'completed', followUpDeadline: new Date(Date.now() + 7 * 864e5) });
  Appointment.create = async (d) => ({ ...d, _id: 'n1', async populate() {} });
  await assert.rejects(
    createBooking({ patientId: 'p1', body: { doctorId: 'd1', date: day, timeSlot: '10:00 AM - 10:30 AM', consultationType: 'video', consentGiven: true, isFollowUp: true, originalAppointmentId: 'o1' } }),
    (e) => e.status === 400 && /valid till/.test(e.message),
  );
});

test('rescheduling a free follow-up outside its window is refused', async () => {
  const followUp = { _id: 'f1', patient: 'p1', doctor: 'd1', status: 'confirmed', isFollowUp: true, originalAppointment: 'o1' };
  Appointment.findById = (id) => q(id === 'f1' ? followUp : { _id: 'o1', followUpDeadline: new Date(Date.now() + 5 * 864e5) });
  const r = await run(appt.rescheduleAppointment, { params: { id: 'f1' }, body: { date: futureDay(30), timeSlot: '10:00 AM - 10:30 AM' }, user: { _id: 'p1' } });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /valid till/);
});

// ---------- 7: reviews ----------
test('reviews: whole stars only, clear message for a long comment', async () => {
  Appointment.findById = () => q({ _id: 'a1', patient: 'p1', doctor: 'd1', status: 'completed' });
  Review.findOne = () => q(null);
  let created = null;
  Review.create = async (d) => { created = d; return d; };
  const u = { _id: 'p1' };
  assert.strictEqual((await run(reviews.createReview, { body: { appointmentId: 'a1', rating: 4.5 }, user: u })).statusCode, 400);
  assert.strictEqual((await run(reviews.createReview, { body: { appointmentId: 'a1', rating: 'abc' }, user: u })).statusCode, 400);
  const long = await run(reviews.createReview, { body: { appointmentId: 'a1', rating: 5, comment: 'x'.repeat(600) }, user: u });
  assert.strictEqual(long.statusCode, 400);
  assert.match(long.body.message, /600 characters.*under 500/);
  const ok = await run(reviews.createReview, { body: { appointmentId: 'a1', rating: '4', comment: '  Very kind  ' }, user: u });
  assert.strictEqual(ok.statusCode, 201);
  assert.deepStrictEqual([created.rating, created.comment], [4, 'Very kind']);
});

// ---------- 8: call room ----------
test('no call room for a cancelled or unconfirmed appointment', async () => {
  for (const status of ['cancelled', 'pending']) {
    Appointment.findById = () => q({ _id: 'a1', status, doctor: { _id: 'd1', name: 'D' }, patient: { _id: 'p1', name: 'P' }, date: new Date(), timeSlot: '12:00 AM - 11:30 PM' });
    const r = await run(appt.getVideoToken, { params: { id: 'a1' }, user: { _id: 'p1' } });
    assert.strictEqual(r.statusCode, 403, status);
  }
});
