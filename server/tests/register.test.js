// ============================================
// Registration rules (no database required)
// ============================================
// Patients must always give a phone number (email is optional). These
// requests are rejected before any database write; the lookups are stubbed.

const { test } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const User = require('../models/User');
const { register } = require('../controllers/authController');

let created = false;
User.findOne = async () => null;
User.create = async () => { created = true; throw new Error('should not create'); };

const call = async (body) => {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  await register({ body, headers: {}, ip: '127.0.0.1' }, res);
  return res;
};

test('patient with email but NO phone is rejected', async () => {
  created = false;
  const r = await call({ name: 'Usha', email: 'usha@example.com', password: 'secret1', role: 'patient' });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /mobile number/);
  assert.strictEqual(created, false);
});

test('patient with blank phone (spaces) is rejected', async () => {
  const r = await call({ name: 'Usha', email: 'usha@example.com', phone: '   ', password: 'secret1', role: 'patient' });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /mobile number/);
});

test('patient with an invalid phone is rejected', async () => {
  const r = await call({ name: 'Usha', phone: '12345', password: 'secret1', role: 'patient' });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /valid 10-digit/);
});

test('doctor without phone is NOT blocked by the patient phone rule', async () => {
  // Gets past the phone rule and reaches account creation (stubbed to throw).
  created = false;
  await call({ name: 'Dr X', email: 'drx@example.com', password: 'secret1', role: 'doctor' });
  assert.strictEqual(created, true);
});
