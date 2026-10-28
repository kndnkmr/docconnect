// ============================================
// Call alarm: pre-alert, ring x3, stop on join, snooze, test alarm (no DB)
// ============================================
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
process.env.PUBLIC_API_URL = 'https://api.example.test';
const push = require('../utils/push');
const pushed = [];
push.sendPushToUser = async (to, payload, opts) => { pushed.push({ to: String(to), payload, opts }); return 1; };
const Appointment = require('../models/Appointment');
const { slotWindowMs } = require('../utils/slots');
const { planFor, sendCallStartReminders, snoozeRing } = require('../utils/callReminder');
const { makeRingToken, readRingToken } = require('../utils/ringToken');
const pushCtl = require('../controllers/pushController');

const S = 1000; const MIN = 60 * S;
const q = (val) => { const p = Promise.resolve(val); for (const k of ['select', 'populate', 'limit']) p[k] = () => q(val); return p; };

// A confirmed+paid video appointment on 2099-01-01 at 10:30 IST.
const DATE = new Date('2099-01-01');
const SLOT = '10:30 AM - 11:00 AM';
const START = slotWindowMs(DATE, SLOT).start;
const apt = (extra = {}) => ({
  _id: 'a1', doctor: { _id: 'doc1', name: 'Sharma' }, patient: 'pat1', date: DATE, timeSlot: SLOT,
  consultationType: 'video', callStartedAt: null, callPreAlertSentAt: null, callRingCount: 0, callLastRingAt: null, ringSnoozes: [],
  ...extra,
});

let updates;
beforeEach(() => { pushed.length = 0; updates = []; Appointment.updateOne = async (f, u) => { updates.push(u); }; });

test('plan: "in 10 min" only between 10 and 6 minutes before', () => {
  assert.strictEqual(planFor(apt(), START - 11 * MIN).preAlert, false);
  assert.strictEqual(planFor(apt(), START - 9 * MIN).preAlert, true);
  assert.strictEqual(planFor(apt(), START - 5 * MIN).preAlert, false);
  assert.strictEqual(planFor(apt({ callPreAlertSentAt: new Date() }), START - 9 * MIN).preAlert, false);
});

test('plan: ring at start, again after 40 s, max 3, stops when someone joins', () => {
  assert.strictEqual(planFor(apt(), START - 30 * S).ring, false);
  assert.strictEqual(planFor(apt(), START + 5 * S).ring, true);
  const after1 = apt({ callRingCount: 1, callLastRingAt: new Date(START + 5 * S) });
  assert.strictEqual(planFor(after1, START + 30 * S).ring, false);      // too soon
  assert.strictEqual(planFor(after1, START + 46 * S).ring, true);       // 40 s later
  assert.strictEqual(planFor(apt({ callRingCount: 3, callLastRingAt: new Date(START) }), START + 5 * MIN).ring, false);
  assert.strictEqual(planFor(apt({ callStartedAt: new Date(START + 10 * S) }), START + 60 * S).ring, false); // joined
  assert.strictEqual(planFor(apt(), START + 6 * MIN).ring, false);      // first ring missed its window
});

test('job: rings both people alarm-style with Join + snooze; doctor text has no patient name', async () => {
  Appointment.find = () => q([apt()]);
  const r = await sendCallStartReminders(START + 5 * S);
  assert.strictEqual(r.rings, 1);
  assert.strictEqual(pushed.length, 2);
  const toDoctor = pushed.find((p) => p.to === 'doc1');
  const toPatient = pushed.find((p) => p.to === 'pat1');
  for (const p of [toDoctor, toPatient]) {
    assert.strictEqual(p.payload.kind, 'call');
    assert.strictEqual(p.payload.url, '/dashboard?join=a1');
    assert.strictEqual(p.opts.urgency, 'high');
    assert.ok(p.payload.snoozeUrl.endsWith('/api/push/snooze'));
    assert.ok(readRingToken(p.payload.snoozeToken, START));
  }
  assert.match(toPatient.payload.body, /Dr\. Sharma/);
  assert.ok(!/pat1/.test(toDoctor.payload.body));
  assert.strictEqual(updates[0].$set.callRingCount, 1);
});

test('job: pre-alert once to both', async () => {
  Appointment.find = () => q([apt()]);
  const r = await sendCallStartReminders(START - 9 * MIN);
  assert.strictEqual(r.preAlerts, 1);
  assert.strictEqual(pushed.length, 2);
  assert.match(pushed[0].payload.title, /10 min/);
  assert.ok(updates[0].$set.callPreAlertSentAt);
});

test('snooze token: signed, per person, expires; tampering refused', () => {
  const t = makeRingToken('a1', 'pat1', START + 30 * MIN);
  assert.deepStrictEqual(readRingToken(t, START), { appointmentId: 'a1', userId: 'pat1' });
  assert.strictEqual(readRingToken(t, START + 31 * MIN), null);
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ a: 'a1', u: 'doc1', e: START + 30 * MIN })).toString('base64url');
  assert.strictEqual(readRingToken(`${forged}.${sig}`, START), null);
  assert.strictEqual(readRingToken('junk', START), null);
  assert.ok(body);
});

test('snooze: rings that person again 5 min later unless someone joined', async () => {
  Appointment.findById = () => q({ _id: 'a1', patient: 'pat1', doctor: 'doc1', date: DATE, timeSlot: SLOT, status: 'confirmed', ringSnoozes: [] });
  const r = await snoozeRing('a1', 'pat1', START + MIN);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(new Date(r.at).getTime(), START + 6 * MIN);
  assert.ok(updates[0].$push.ringSnoozes);
  assert.strictEqual((await snoozeRing('a1', 'stranger', START + MIN)).ok, false);
  updates = [];

  Appointment.find = () => q([apt({ callRingCount: 3, callLastRingAt: new Date(START), ringSnoozes: [{ user: 'pat1', at: new Date(START + 6 * MIN) }] })]);
  const due = await sendCallStartReminders(START + 6 * MIN + 5 * S);
  assert.strictEqual(due.snoozeRings, 1);
  assert.strictEqual(pushed[0].to, 'pat1');
  assert.ok(updates[0].$pull);

  pushed.length = 0;
  Appointment.find = () => q([apt({ callStartedAt: new Date(START + 2 * MIN), callRingCount: 3, ringSnoozes: [{ user: 'pat1', at: new Date(START + 6 * MIN) }] })]);
  const joined = await sendCallStartReminders(START + 6 * MIN + 5 * S);
  assert.strictEqual(joined.snoozeRings, 0); // someone joined → no ring, snooze cleared
  assert.strictEqual(pushed.length, 0);
});

// ---- users (stubbed) for test alarm / readiness / receipts ----
const User = require('../models/User');
const users = {};
let userUpdates = [];
User.findById = (id) => q(users[String(id)] || null);
User.updateOne = async (f, u) => { userUpdates.push({ f, u }); };
const runCtl = async (handler, req) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler(req, res);
  return res;
};

test('test alarm: rings own devices; 400 if none; rate-limited', async () => {
  users['u-test-1'] = { pushSubscriptions: [{ endpoint: 'x' }] };
  const ok = await runCtl(pushCtl.testAlarm, { user: { _id: 'u-test-1' }, body: {} });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(pushed[0].payload.kind, 'call');
  assert.ok(pushed[0].payload.ackToken, 'test alarm carries a receipt token');
  assert.strictEqual((await runCtl(pushCtl.testAlarm, { user: { _id: 'u-test-1' }, body: {} })).statusCode, 429);
  users['u-none'] = { pushSubscriptions: [] };
  assert.strictEqual((await runCtl(pushCtl.testAlarm, { user: { _id: 'u-none' }, body: {} })).statusCode, 400);
});

test('locked-screen test: answers at once, rings ~15 s later, records the test', async (t) => {
  try { t.mock.timers.enable({ apis: ['setTimeout'] }); } catch { t.mock.timers.enable(['setTimeout']); } // Node 20 vs older
  users['u-lock'] = { pushSubscriptions: [{ endpoint: 'x' }] };
  userUpdates = [];
  const r = await runCtl(pushCtl.testAlarm, { user: { _id: 'u-lock' }, body: { locked: true } });
  assert.strictEqual(r.statusCode, 200);
  assert.match(r.body.message, /Lock your phone now/);
  assert.strictEqual(pushed.length, 0, 'not sent yet');
  assert.strictEqual(userUpdates[0].u.$set.alarmTest.locked, true);
  t.mock.timers.tick(15 * S);
  await new Promise((res) => setImmediate(res));
  assert.strictEqual(pushed.length, 1);
  assert.match(pushed[0].payload.title, /Locked-screen test/);
});

test('receipt: phone confirms → seenAt recorded once; bad/forged tokens refused', async () => {
  userUpdates = [];
  // test-alarm receipt
  const testTok = makeRingToken('test', 'u-lock', Date.now() + MIN);
  assert.strictEqual((await runCtl(pushCtl.ack, { body: { token: testTok } })).statusCode, 200);
  assert.ok(userUpdates[0].u.$set['alarmTest.seenAt'] instanceof Date);
  // appointment receipt
  Appointment.findById = () => q({ _id: 'a1', doctor: 'doc1', patient: 'pat1', callAlerts: {} });
  const tok = makeRingToken('a1', 'pat1', Date.now() + MIN);
  const r = await runCtl(pushCtl.ack, { body: { token: tok }, app: { get: () => null } });
  assert.strictEqual(r.statusCode, 200);
  assert.ok(updates[0].$set['callAlerts.patient.seenAt'] instanceof Date);
  // someone else's token for this appointment
  const stranger = makeRingToken('a1', 'someone', Date.now() + MIN);
  assert.strictEqual((await runCtl(pushCtl.ack, { body: { token: stranger }, app: { get: () => null } })).statusCode, 400);
  assert.strictEqual((await runCtl(pushCtl.ack, { body: { token: tok.slice(0, -2) + 'xx' } })).statusCode, 400);
  // already seen → not overwritten
  updates.length = 0;
  Appointment.findById = () => q({ _id: 'a1', doctor: 'doc1', patient: 'pat1', callAlerts: { patient: { seenAt: new Date() } } });
  await runCtl(pushCtl.ack, { body: { token: tok }, app: { get: () => null } });
  assert.strictEqual(updates.length, 0);
});

test('ring carries a receipt token and records sentAt + devices once', async () => {
  Appointment.find = () => q([apt({ callPreAlertSentAt: new Date(), callReadyCheckSentAt: new Date() })]);
  await sendCallStartReminders(START + 5 * S);
  const ring = pushed.find((p) => p.payload.kind === 'call');
  assert.ok(ring.payload.ackUrl && ring.payload.ackToken);
  assert.deepStrictEqual(readRingToken(ring.payload.ackToken).appointmentId, 'a1');
  const set = updates[0].$set;
  assert.ok(set['callAlerts.doctor.sentAt'] && set['callAlerts.patient.sentAt']);
  assert.strictEqual(set['callAlerts.patient.devices'], 1);
});

test('readiness: no alerts / not tested / tested on a locked screen in last 60 days', () => {
  const { readiness } = require('../utils/callReminder');
  const now = Date.now();
  assert.strictEqual(readiness({ pushSubscriptions: [] }, now), 'no-alerts');
  assert.strictEqual(readiness({ pushSubscriptions: [{}] }, now), 'not-tested');
  assert.strictEqual(readiness({ pushSubscriptions: [{}], alarmTest: { locked: false, seenAt: new Date(now) } }, now), 'not-tested');
  assert.strictEqual(readiness({ pushSubscriptions: [{}], alarmTest: { locked: true, seenAt: new Date(now - 10 * 864e5) } }, now), 'ok');
  assert.strictEqual(readiness({ pushSubscriptions: [{}], alarmTest: { locked: true, seenAt: new Date(now - 61 * 864e5) } }, now), 'not-tested');
});

test('30 min before: checks both, nudges the one not ready, records results', async () => {
  users.doc1 = { name: 'Sharma', pushSubscriptions: [{}], alarmTest: { locked: true, seenAt: new Date(START - 2 * 864e5) } };
  users.pat1 = { name: 'Asha', email: '', pushSubscriptions: [{}], alarmTest: {} };
  Appointment.find = () => q([apt()]);
  assert.strictEqual(planFor(apt(), START - 40 * MIN).readyCheck, false);
  assert.strictEqual(planFor(apt(), START - 30 * MIN).readyCheck, true);
  assert.strictEqual(planFor(apt({ callReadyCheckSentAt: new Date() }), START - 30 * MIN).readyCheck, false);
  await sendCallStartReminders(START - 30 * MIN);
  const set = updates[0].$set;
  assert.strictEqual(set['callAlerts.doctor.ready'], 'ok');
  assert.strictEqual(set['callAlerts.patient.ready'], 'not-tested');
  assert.ok(set.callReadyCheckSentAt);
  assert.deepStrictEqual(pushed.map((p) => p.to), ['pat1'], 'only the patient is nudged');
  assert.match(pushed[0].payload.title, /15-second test/);
});
