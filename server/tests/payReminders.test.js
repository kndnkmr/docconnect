// Payment reminders for confirmed-but-unpaid appointments. No database.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const Appointment = require('../models/Appointment');
const push = require('../utils/push');
const pushes = [];
push.sendPushToUser = async (id, m) => { pushes.push({ id, ...m }); };
const { dueReminder, reminderText } = require('../utils/payReminders');
const admin = require('../controllers/adminController');
const q = (val) => { const p = Promise.resolve(val); for (const k of ['select', 'populate', 'limit', 'sort', 'skip']) p[k] = () => q(val); return p; };
const run = async (handler, { params = {}, body = {}, user = {} } = {}) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ params, body, user, headers: {}, ip: '1.1.1.1', app: { get: () => null } }, res);
  return res;
};
const H = 3600 * 1000;
const day = (d) => new Date(`${new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)}T00:00:00Z`);
const now = Date.now();
const apt = (extra = {}) => ({ status: 'confirmed', paymentStatus: 'pending', date: day(3), timeSlot: '10:00 AM - 10:30 AM', confirmedAt: new Date(now - 2 * H), payRemindCount: 0, ...extra });
beforeEach(() => { pushes.length = 0; });
test('ladder: 1st at 1h, 2nd at 6h, 3rd at 24h after confirming, then stops', () => {
  assert.strictEqual(dueReminder(apt({ confirmedAt: new Date(now - 30 * 60000) }), 300, now), 0, 'too early');
  assert.strictEqual(dueReminder(apt(), 300, now), 1);
  assert.strictEqual(dueReminder(apt({ payRemindCount: 1, confirmedAt: new Date(now - 5 * H), payRemindLastAt: new Date(now - 4 * H) }), 300, now), 0, 'not yet 6h');
  assert.strictEqual(dueReminder(apt({ payRemindCount: 1, confirmedAt: new Date(now - 7 * H), payRemindLastAt: new Date(now - 6 * H) }), 300, now), 2);
  assert.strictEqual(dueReminder(apt({ payRemindCount: 2, confirmedAt: new Date(now - 25 * H), payRemindLastAt: new Date(now - 18 * H) }), 300, now), 3);
  assert.strictEqual(dueReminder(apt({ payRemindCount: 3, confirmedAt: new Date(now - 90 * H) }), 300, now), 0, 'at most 3');
});
test('ladder: at least 3 hours apart, so an old booking does not get a burst', () => {
  assert.strictEqual(dueReminder(apt({ payRemindCount: 1, confirmedAt: new Date(now - 30 * H), payRemindLastAt: new Date(now - 1 * H) }), 300, now), 0);
});
test('ladder: never for paid / started paying / free / follow-up / cancelled / late-confirmed / slot imminent or past', () => {
  assert.strictEqual(dueReminder(apt({ paymentStatus: 'patient_claimed' }), 300, now), 0);
  assert.strictEqual(dueReminder(apt({ paymentStatus: 'paid' }), 300, now), 0);
  assert.strictEqual(dueReminder(apt(), 0, now), 0, 'free consultation');
  assert.strictEqual(dueReminder(apt({ isFollowUp: true }), 300, now), 0);
  assert.strictEqual(dueReminder(apt({ status: 'cancelled' }), 300, now), 0);
  assert.strictEqual(dueReminder(apt({ status: 'pending' }), 300, now), 0);
  assert.strictEqual(dueReminder(apt({ confirmedLate: true }), 300, now), 0, 'they must pick a new time first');
  assert.strictEqual(dueReminder(apt({ date: day(-1) }), 300, now), 0, 'slot already over');
  assert.strictEqual(dueReminder(apt({ confirmedAt: null, updatedAt: new Date(now - 3 * H) }), 300, now), 1, 'older bookings use their last update');
});
test('reminder wording: plain, includes doctor, date and amount, no threats', () => {
  for (const n of [1, 2, 3]) {
    const t = reminderText(n, apt(), 'Pooja Singh', 300);
    assert.match(t.body, /Pooja Singh/);
    assert.ok(/300/.test(t.title + t.body));
    assert.ok(!/cancel|release|lose/i.test(t.title + t.body), 'no threats we do not enforce');
  }
});
const unpaid = (extra = {}) => ({
  _id: 'a1', status: 'confirmed', paymentStatus: 'pending', date: day(3), timeSlot: '10:00 AM - 10:30 AM',
  doctor: { name: 'Pooja', consultationFee: 300 }, patient: { _id: 'p1', name: 'Usha' },
  markModified() {}, async save() {}, ...extra,
});
test('admin "remind now": sends the push, logs it, and limits to once per 2 hours', async () => {
  const a = unpaid();
  Appointment.findById = () => q(a);
  const r = await run(admin.remindPaymentAsAdmin, { params: { id: 'a1' }, user: { _id: 'adm' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.match(pushes[0].body, /Pooja/);
  assert.strictEqual(a.events[0].action, 'pay_reminder');
  assert.strictEqual(a.events[0].role, 'admin');
  pushes.length = 0;
  const again = await run(admin.remindPaymentAsAdmin, { params: { id: 'a1' }, user: { _id: 'adm' } });
  assert.strictEqual(again.statusCode, 429);
  assert.strictEqual(pushes.length, 0);
});
test('admin "remind now": refused when nothing is due', async () => {
  const call = (extra) => { Appointment.findById = () => q(unpaid(extra)); return run(admin.remindPaymentAsAdmin, { params: { id: 'a1' }, user: { _id: 'adm' } }); };
  assert.strictEqual((await call({ status: 'pending' })).statusCode, 400);
  assert.strictEqual((await call({ paymentStatus: 'patient_claimed' })).statusCode, 400);
  assert.strictEqual((await call({ isFollowUp: true })).statusCode, 400);
  assert.strictEqual((await call({ confirmedLate: true })).statusCode, 400);
  assert.strictEqual((await call({ doctor: { name: 'X', consultationFee: 0 } })).statusCode, 400);
  Appointment.findById = () => q(null);
  assert.strictEqual((await run(admin.remindPaymentAsAdmin, { params: { id: 'zz' }, user: { _id: 'adm' } })).statusCode, 404);
});
