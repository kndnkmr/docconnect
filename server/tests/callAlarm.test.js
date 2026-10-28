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

test('test alarm: rings own devices; 400 if none; rate-limited', async () => {
  const run = async (user) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await pushCtl.testAlarm({ user }, res);
    return res;
  };
  const ok = await run({ _id: 'u-test-1' });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(pushed[0].payload.kind, 'call');
  assert.strictEqual((await run({ _id: 'u-test-1' })).statusCode, 429);
});
