// ============================================
// Login messages (no database required)
// ============================================
// The login page relies on these exact codes to tell a new patient
// "this number is not registered — create an account" instead of a vague
// "invalid email or password". The DB lookup is stubbed.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const User = require('../models/User');
const { login } = require('../controllers/authController');

// Minimal Express-like response recorder.
const call = async (body) => {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  await login({ body, headers: {}, ip: '127.0.0.1' }, res);
  return res;
};

const fakeUser = (role, passwordOk) => ({
  _id: 'u1', name: 'Test', role, isDeleted: false, isSuspended: false,
  comparePassword: async () => passwordOk,
  save: async () => {},
});

let found = null;
beforeEach(() => { User.findOne = async () => found; });

test('phone not registered → NOT_REGISTERED', async () => {
  found = null;
  const r = await call({ phone: '9876543210', password: 'whatever' });
  assert.strictEqual(r.statusCode, 401);
  assert.strictEqual(r.body.code, 'NOT_REGISTERED');
});

test('email not registered → generic message, no code', async () => {
  found = null;
  const r = await call({ email: 'nobody@example.com', password: 'whatever' });
  assert.strictEqual(r.statusCode, 401);
  assert.strictEqual(r.body.code, undefined);
  assert.strictEqual(r.body.message, 'Invalid email or password');
});

test('patient phone, wrong password → WRONG_PASSWORD', async () => {
  found = fakeUser('patient', false);
  const r = await call({ phone: '9876543210', password: 'wrong1' });
  assert.strictEqual(r.statusCode, 401);
  assert.strictEqual(r.body.code, 'WRONG_PASSWORD');
});

test('doctor phone, wrong password → generic message, no code', async () => {
  found = fakeUser('doctor', false);
  const r = await call({ phone: '9876543210', password: 'wrong1' });
  assert.strictEqual(r.statusCode, 401);
  assert.strictEqual(r.body.code, undefined);
});

test('patient email, wrong password → generic message, no code', async () => {
  found = fakeUser('patient', false);
  const r = await call({ email: 'p@example.com', password: 'wrong1' });
  assert.strictEqual(r.body.code, undefined);
});

test('correct password still logs in with a token', async () => {
  found = fakeUser('patient', true);
  const r = await call({ phone: '9876543210', password: 'right1' });
  assert.strictEqual(r.statusCode, 200);
  assert.ok(r.body.token);
});
