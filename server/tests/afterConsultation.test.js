// ============================================
// After the consultation: the prescription finishes the visit; patients can ask;
// doctors get a list and one nudge. No database required.
// ============================================
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const push = require('../utils/push');
const pushes = [];
push.sendPushToUser = async (id, m) => { pushes.push({ id, ...m }); };
const rx = require('../controllers/prescriptionController');
const appt = require('../controllers/appointmentController');
const follow = require('../controllers/prescriptionFollowUpController');
const { toNudge } = require('../utils/prescriptionNudge');
const q = (val) => { const p = Promise.resolve(val); for (const k of ['select', 'populate', 'limit', 'sort', 'skip']) p[k] = () => q(val); return p; };
const run = async (handler, { params = {}, body = {}, user = {} } = {}) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ params, body, user, headers: {}, ip: '1.1.1.1', app: { get: () => null } }, res);
  return res;
};
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
beforeEach(() => { pushes.length = 0; });
const makeApt = (extra = {}) => ({
  _id: 'a1', doctor: { toString: () => 'd1' }, patient: { toString: () => 'p1' }, status: 'confirmed',
  date: new Date(`${day(-1)}T00:00:00Z`), timeSlot: '10:00 AM - 10:30 AM', paymentStatus: 'paid',
  markModified() {}, async save() {}, ...extra,
});
const BODY = { appointmentId: 'a1', diagnosis: 'Viral fever', medicines: [{ name: 'Paracetamol', dosage: '500 mg', frequency: 'Twice a day', duration: '3 days' }] };
test('writing a prescription for a visit that has started also finishes the visit', async () => {
  const a = makeApt();
  Appointment.findById = () => q(a);
  Prescription.findOne = () => q(null);
  Prescription.create = async (d) => ({ ...d, _id: 'rx1' });
  const r = await run(rx.createPrescription, { body: BODY, user: { _id: 'd1' } });
  assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
  assert.strictEqual(a.status, 'completed');
  assert.strictEqual(a.completedBy, 'doctor');
  assert.ok(a.completedAt);
  assert.strictEqual(r.body.completed, true);
  assert.strictEqual(a.events[0].action, 'completed');
  assert.match(a.events[0].note, /writing the prescription/);
});
test('a prescription for an appointment that has not started leaves it confirmed', async () => {
  const a = makeApt({ date: new Date(`${day(3)}T00:00:00Z`) });
  Appointment.findById = () => q(a);
  Prescription.findOne = () => q(null);
  Prescription.create = async (d) => ({ ...d, _id: 'rx1' });
  const r = await run(rx.createPrescription, { body: BODY, user: { _id: 'd1' } });
  assert.strictEqual(r.statusCode, 201);
  assert.strictEqual(a.status, 'confirmed');
  assert.strictEqual(r.body.completed, false);
});
test('updating an existing prescription on an already completed visit changes nothing about the status', async () => {
  const a = makeApt({ status: 'completed' });
  Appointment.findById = () => q(a);
  Prescription.findOne = () => q({ diagnosis: 'old', medicines: [], testsRecommended: [], async save() {} });
  const r = await run(rx.createPrescription, { body: BODY, user: { _id: 'd1' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.completed, false);
  assert.strictEqual(a.status, 'completed');
  assert.strictEqual(a.events, undefined);
});
test('"just finish" (no prescription needed) is remembered so nobody nags about it', async () => {
  const a = makeApt({ doctor: 'd1', patient: { _id: 'p1', toString: () => 'p1' }, async populate() { this.doctor = { _id: 'd1', name: 'Pooja', consultationFee: 300, toString: () => 'd1' }; } });
  Appointment.findById = () => q(a);
  const r = await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'completed', noPrescription: true }, user: { _id: 'd1' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.strictEqual(a.status, 'completed');
  assert.strictEqual(a.rxNotNeeded, true);
  // plain completion does not set it
  const b = makeApt({ doctor: 'd1', patient: { _id: 'p1', toString: () => 'p1' }, async populate() { this.doctor = { _id: 'd1', name: 'Pooja', consultationFee: 300, toString: () => 'd1' }; } });
  Appointment.findById = () => q(b);
  await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'completed' }, user: { _id: 'd1' } });
  assert.notStrictEqual(b.rxNotNeeded, true);
});
test('patient "ask for prescription": only the patient, only when completed, no prescription yet, once a day', async () => {
  const a = makeApt({ status: 'completed' });
  Appointment.findById = () => q(a);
  Prescription.exists = async () => null;
  const call = (user = { _id: 'p1' }) => run(follow.askForPrescription, { params: { id: 'a1' }, user });
  assert.strictEqual((await call({ _id: 'other' })).statusCode, 403);
  const ok = await call();
  assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.ok(a.rxAskedAt);
  assert.match(pushes[0].title, /waiting for a prescription/);
  assert.ok(!/Usha|Manya/.test(pushes[0].body), 'no patient name on the lock screen');
  pushes.length = 0;
  const again = await call();
  assert.strictEqual(again.statusCode, 429);
  assert.strictEqual(pushes.length, 0);
  a.rxAskedAt = new Date(Date.now() - 25 * 3600 * 1000);
  assert.strictEqual((await call()).statusCode, 200);
  // not finished / already written / marked not needed
  Appointment.findById = () => q(makeApt({ status: 'confirmed' }));
  assert.strictEqual((await call()).statusCode, 400);
  Appointment.findById = () => q(makeApt({ status: 'completed', rxNotNeeded: true }));
  assert.strictEqual((await call()).statusCode, 400);
  Appointment.findById = () => q(makeApt({ status: 'completed' }));
  Prescription.exists = async () => ({ _id: 'rx' });
  assert.match((await call()).body.message, /already there/);
});
test('doctor "no prescription needed": only the doctor, only completed', async () => {
  const a = makeApt({ status: 'completed' });
  Appointment.findById = () => q(a);
  const call = (user) => run(follow.markNoPrescription, { params: { id: 'a1' }, user });
  assert.strictEqual((await call({ _id: 'someone' })).statusCode, 403);
  assert.strictEqual((await call({ _id: 'd1' })).statusCode, 200);
  assert.strictEqual(a.rxNotNeeded, true);
  Appointment.findById = () => q(makeApt({ status: 'confirmed' }));
  assert.strictEqual((await call({ _id: 'd1' })).statusCode, 400);
});
test('nudge: only 2h to 24h after completion, only once', () => {
  const now = Date.now();
  const h = (n) => new Date(now - n * 3600 * 1000);
  const list = [
    { id: 'fresh', completedAt: h(1) }, { id: 'due', completedAt: h(3) }, { id: 'old', completedAt: h(30) },
    { id: 'done', completedAt: h(3), rxNudgedAt: h(1) }, { id: 'none' },
  ];
  assert.deepStrictEqual(toNudge(list, now).map((a) => a.id), ['due']);
});
