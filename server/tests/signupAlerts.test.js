// ============================================
// Admin sign-up alerts: new doctor at once, new patients in one daily list
// ============================================
// No database: User / Appointment calls are stubbed.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
process.env.ADMIN_NOTIFY_EMAIL = 'admin@example.com';
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const mail = require('../utils/sendEmail');

let sent; let found; let marked; let lastQuery; let sendResult;
beforeEach(() => {
  sent = []; marked = null; lastQuery = null; sendResult = { success: true };
  mail.sendEmail = async (m) => { sent.push(m); return sendResult; };
  found = [];
  User.find = (q) => { lastQuery = q; const chain = { select: () => chain, sort: () => chain, limit: () => chain, lean: async () => found }; return chain; };
  User.updateMany = async (filter, update) => { marked = { filter, update }; return {}; };
  Appointment.distinct = async () => ['p2'];
});
// Fresh copy each test (the module remembers its last run).
const fresh = () => { delete require.cache[require.resolve('../utils/signupAlerts')]; return require('../utils/signupAlerts'); };
// 2026-08-06 20:00 IST = 14:30 UTC (after 7 PM); 18:00 IST = 12:30 UTC (before).
const EVENING = new Date('2026-08-06T14:30:00Z');
const AFTERNOON = new Date('2026-08-06T12:30:00Z');

test('new doctor: one email to the admin, names escaped', async () => {
  const { notifyAdminNewDoctor } = fresh();
  notifyAdminNewDoctor({ name: 'Ravi <b>X</b>', email: 'ravi@example.com', phone: '+919876500001', createdAt: EVENING });
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'admin@example.com');
  assert.match(sent[0].subject, /new doctor signed up/);
  assert.ok(sent[0].html.includes('Ravi &lt;b&gt;X&lt;/b&gt;') && !sent[0].html.includes('<b>X</b>'));
  assert.match(sent[0].html, /promedicoz\.in\/admin"/);
});

test('patient list: only after 7 PM IST, says who has not booked, marks them', async () => {
  const { runPatientSignupDigest } = fresh();
  found = [{ _id: 'p1', name: 'Asha', patientId: 'PT000024', createdAt: EVENING }, { _id: 'p2', name: 'Bina', patientId: 'PT000025', createdAt: EVENING }];
  assert.deepStrictEqual(await runPatientSignupDigest(AFTERNOON), { skipped: true });
  assert.strictEqual(sent.length, 0);

  const r = await runPatientSignupDigest(EVENING);
  assert.deepStrictEqual(r, { sent: 2 });
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].subject, /2 new patients today \(1 not booked yet\)/);
  assert.ok(sent[0].html.includes('PT000024') && sent[0].html.includes('⏳ Not yet') && sent[0].html.includes('✅ Booked'));
  // Skips admin-made accounts and anyone already sent; marks this batch.
  assert.strictEqual(lastQuery.createdByAdmin, null);
  assert.deepStrictEqual(lastQuery.signupNotifiedAt, { $exists: false });
  assert.deepStrictEqual(marked.filter._id.$in, ['p1', 'p2']);

  // Same evening again (every 10 min): nothing more.
  assert.deepStrictEqual(await runPatientSignupDigest(new Date(EVENING.getTime() + 20 * 60000)), { skipped: true });
  assert.strictEqual(sent.length, 1);
});

test('patient list: nobody new → no email; failed send → not marked (retried)', async () => {
  let m = fresh();
  assert.deepStrictEqual(await m.runPatientSignupDigest(EVENING), { sent: 0 });
  assert.strictEqual(sent.length, 0);

  m = fresh();
  found = [{ _id: 'p1', name: 'Asha', patientId: 'PT000024', createdAt: EVENING }];
  sendResult = { success: false, error: 'rate limit' };
  assert.deepStrictEqual(await m.runPatientSignupDigest(EVENING), { sent: 0, failed: true });
  assert.strictEqual(marked, null, 'not marked, so the next run includes them');
});
