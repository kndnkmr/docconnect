// ============================================
// Admin "Edit Contact" (doctors only) — no database required
// ============================================
// Patients' phone/details are edited through "Help patient"
// (adminPatient.test.js). The DB lookups are stubbed.

const { test } = require('node:test');
const assert = require('node:assert');

const User = require('../models/User');
const { updateDoctorContact } = require('../controllers/adminController');

const makeUser = (role) => ({
  _id: 'u1', name: 'Test', role, phone: '', whatsappNumber: '', saved: false,
  async save() { this.saved = true; },
});

let target = null;
let clash = null;
User.findById = async () => target;
User.findOne = () => ({ select: async () => clash });

const call = async (body) => {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  await updateDoctorContact({ params: { id: 'u1' }, body }, res);
  return res;
};

test('doctor: phone + WhatsApp work', async () => {
  target = makeUser('doctor'); clash = null;
  const r = await call({ phone: '9876543210', whatsappNumber: '9876543210' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(target.phone, '+919876543210');
  assert.strictEqual(target.whatsappNumber, '+919876543210');
});

test('doctor: a number used by another account is refused', async () => {
  target = makeUser('doctor'); clash = { _id: 'u2', name: 'Someone', role: 'patient' };
  const r = await call({ phone: '9876543210' });
  assert.strictEqual(r.statusCode, 400);
  assert.strictEqual(target.saved, false);
});

test('patient accounts are pointed to "Help patient"', async () => {
  target = makeUser('patient'); clash = null;
  const r = await call({ phone: '8679532261' });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /Help patient/);
  assert.strictEqual(target.saved, false);
});
