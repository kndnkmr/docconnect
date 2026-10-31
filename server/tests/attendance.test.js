// ============================================
// "Did the patient come?" — auto-complete + ask the doctor (no database)
// ============================================
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const push = require('../utils/push');
const pushes = [];
push.sendPushToUser = async (id, m) => { pushes.push({ id: String(id), ...m }); };
const Appointment = require('../models/Appointment');
const CallLog = require('../models/CallLog');
const User = require('../models/User');
const { attendanceAction, isDaytimeIST, runAttendance } = require('../utils/attendance');
const { markNoShow, getAttendanceDue } = require('../controllers/attendanceController');

// Slot "10:00 AM - 10:30 AM" IST on 2026-11-02 ends at 05:00 UTC.
const DAY = '2026-11-02';
const END = Date.parse('2026-11-02T05:00:00Z');
const H = 3600e3;
const apt = (x = {}) => ({ _id: 'a1', doctor: 'd1', patient: 'p1', status: 'confirmed', consultationType: 'video', paymentStatus: 'paid', date: new Date(`${DAY}T00:00:00Z`), timeSlot: '10:00 AM - 10:30 AM', noShow: false, attendanceNudgedAt: null, ...x });

test('planner: call joined → complete 1 h after; else ask; paid → complete after 3 days', () => {
  assert.strictEqual(attendanceAction(apt(), END - 60e3), 'wait', 'not ended');
  assert.strictEqual(attendanceAction(apt(), END + 30 * 60e3, { doctorJoinedCall: true }), 'wait', 'call: within the hour');
  assert.strictEqual(attendanceAction(apt(), END + H, { doctorJoinedCall: true }), 'complete-call');
  assert.strictEqual(attendanceAction(apt(), END + H), 'ask', 'no call log → ask the doctor');
  assert.strictEqual(attendanceAction(apt({ consultationType: 'in-person' }), END + H, { doctorJoinedCall: true }), 'ask', 'clinic visit: always ask');
  assert.strictEqual(attendanceAction(apt(), END + 72 * H), 'complete-timeout');
  assert.strictEqual(attendanceAction(apt({ paymentStatus: 'pending' }), END + 72 * H), 'ask', 'unpaid: never auto-completed');
  assert.strictEqual(attendanceAction(apt({ paymentStatus: 'patient_claimed' }), END + 72 * H), 'ask');
  assert.strictEqual(attendanceAction(apt(), END + 15 * 24 * H), 'ignore', 'older than 14 days');
  assert.strictEqual(attendanceAction(apt({ status: 'completed' }), END + H), 'ignore');
  assert.strictEqual(attendanceAction(apt({ noShow: true }), END + H), 'ignore');
});

test('daytime only for asking (IST 9 AM–9 PM)', () => {
  assert.ok(isDaytimeIST(Date.parse('2026-11-03T04:00:00Z')));   // 9:30 AM IST
  assert.ok(!isDaytimeIST(Date.parse('2026-11-02T20:00:00Z')));  // 1:30 AM IST
});

beforeEach(() => { pushes.length = 0; });

test('job: completes, asks each doctor once (daytime), leaves the rest', async () => {
  const saved = []; let marked = null;
  const mk = (x) => ({ ...apt(x), async save() { saved.push(this); } });
  const list = [
    mk({ _id: 'call' }),                                        // doctor joined → complete
    mk({ _id: 'old-paid', date: new Date('2026-10-29T00:00:00Z') }), // ended 4 days ago, paid → complete
    mk({ _id: 'clinic', consultationType: 'in-person' }),       // ask
    mk({ _id: 'asked', consultationType: 'in-person', attendanceNudgedAt: new Date() }), // already asked
  ];
  Appointment.find = () => ({ select: async () => list });
  Appointment.updateMany = async (f) => { marked = f._id.$in; return {}; };
  CallLog.distinct = async () => ['call'];
  User.find = () => ({ select: () => ({ lean: async () => [{ name: 'Asha Verma' }] }) });
  const now = END + 2 * H + 3 * H; // 3:30 PM IST on 2 Nov
  const r = await runAttendance(now);
  assert.deepStrictEqual(r, { completedCall: 1, completedTimeout: 1, asked: 1 });
  assert.deepStrictEqual(saved.map((a) => [a._id, a.status, a.completedBy]), [['call', 'completed', 'auto-call'], ['old-paid', 'completed', 'auto-3days']]);
  assert.ok(saved.every((a) => a.completedAt instanceof Date), 'completedAt set → rating request follows');
  assert.strictEqual(pushes.length, 1);
  assert.match(pushes[0].title, /Did your patient come/);
  assert.match(pushes[0].body, /Asha/);
  assert.strictEqual(pushes[0].url, '/dashboard?attendance=1');
  assert.deepStrictEqual(marked, ['clinic']);
  // At night: completes still happen, but nobody is woken up
  list.splice(0, list.length, mk({ _id: 'clinic2', consultationType: 'in-person' }));
  const night = await runAttendance(Date.parse('2026-11-02T20:00:00Z'));
  assert.strictEqual(night.asked, 0);
  assert.strictEqual(pushes.length, 1);
});

const run = async (handler, { params = {}, user = {} } = {}) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ params, user, body: {}, app: { get: () => null } }, res);
  return res;
};

test('"Didn\'t come": doctor-only, only after the visit started, no rating request', async () => {
  let a = { ...apt({ date: new Date('2026-10-01T00:00:00Z') }), async save() {} };
  Appointment.findById = async () => a;
  assert.strictEqual((await run(markNoShow, { params: { id: 'a1' }, user: { _id: 'other' } })).statusCode, 403);
  const ok = await run(markNoShow, { params: { id: 'a1' }, user: { _id: 'd1' } });
  assert.strictEqual(ok.statusCode, 200);
  assert.deepStrictEqual([a.status, a.noShow, a.cancellationReason, a.completedAt], ['cancelled', true, 'Did not attend', undefined]);
  assert.strictEqual(pushes.length, 0, 'patient is not notified or asked to rate');
  a = { ...apt({ date: new Date(Date.now() + 5 * 864e5) }), async save() {} };
  assert.strictEqual((await run(markNoShow, { params: { id: 'a1' }, user: { _id: 'd1' } })).statusCode, 400, 'future visit');
});

test('doctor list shows only visits that need an answer', async () => {
  const now = Date.now();
  const ended = new Date(new Date(now - 2 * 864e5).toISOString().slice(0, 10) + 'T00:00:00Z');
  const rows = [apt({ _id: 'need', consultationType: 'in-person', date: ended }), apt({ _id: 'future', date: new Date(now + 864e5) })];
  Appointment.find = () => ({ select() { return this; }, populate() { return this; }, sort() { return this; }, lean: async () => rows });
  CallLog.distinct = async () => [];
  const r = await run(getAttendanceDue, { user: { _id: 'd1' } });
  assert.deepStrictEqual(r.body.appointments.map((a) => a._id), ['need']);
  assert.ok(r.body.appointments[0].autoCompletesAt instanceof Date);
});
