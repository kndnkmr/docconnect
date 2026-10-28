// ============================================
// Doctor registration: fast path (no waiting on email, one write)
// ============================================
const { test } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const mail = require('../utils/sendEmail');
let emailDone = false;
let emailTo = '';
// A slow email service: 3 s to "send".
mail.sendEmail = ({ to }) => new Promise((r) => setTimeout(() => { emailDone = true; emailTo = to; r({ success: true }); }, 3000));
const User = require('../models/User');
const { register } = require('../controllers/authController');

const lookups = [];
User.findOne = async (q) => { lookups.push(q); return null; };
let createdWith = null;
let saves = 0;
User.create = async (data) => {
  createdWith = data;
  return { ...data, _id: 'doc1', async save() { saves += 1; } };
};

test('doctor registration answers without waiting for the email, in one write', async () => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const t0 = Date.now();
  await register({ body: { name: 'Dr Asha', email: 'Asha@Example.com', phone: '9876543210', password: 'secret1', role: 'doctor' }, headers: {}, ip: '1.2.3.4' }, res);
  const took = Date.now() - t0;
  assert.strictEqual(res.statusCode, 201);
  assert.ok(took < 1000, `took ${took} ms — should not wait for the 3 s email`);
  assert.strictEqual(emailDone, false); // still sending in the background
  assert.ok(createdWith.verificationToken && createdWith.verificationTokenExpire > Date.now());
  assert.strictEqual(saves, 0); // no second save for the token
  assert.ok(res.body.token);
  // both duplicate checks ran (email lowercased, phone formatted)
  assert.ok(lookups.some((q) => q.email === 'asha@example.com'));
  assert.ok(lookups.some((q) => q.phone === '+919876543210'));
  await new Promise((r) => setTimeout(r, 3100));
  assert.strictEqual(emailDone, true); // the email still goes out
  assert.strictEqual(emailTo, 'Asha@Example.com');
});
