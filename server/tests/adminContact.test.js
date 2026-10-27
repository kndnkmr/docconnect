// ============================================
// Admin "Edit Contact" / "Add Phone" rules (no database required)
// ============================================
// The admin can set a doctor's phone/WhatsApp, and a patient's phone only.
// The DB lookups are stubbed.

const { test } = require('node:test');
const assert = require('node:assert');

const User = require('../models/User');
const { updateDoctorContact } = require('../controllers/adminController');

const makeUser = (role, extra = {}) => ({
  _id: 'u1', name: 'Usha Rana', role, phone: '', whatsappNumber: '',
  saved: false,
  async save() { this.saved = true; },
  ...extra,
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

test('patient: phone is added and formatted', async () => {
  target = makeUser('patient'); clash = null;
  const r = await call({ phone: '8679532261' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(target.phone, '+918679532261');
  assert.strictEqual(target.saved, true);
});

test('patient: WhatsApp is not allowed', async () => {
  target = makeUser('patient'); clash = null;
  const r = await call({ phone: '8679532261', whatsappNumber: '8679532261' });
  assert.strictEqual(r.statusCode, 400);
  assert.strictEqual(target.saved, false);
});

test('patient: a number already used by another account is refused', async () => {
  target = makeUser('patient'); clash = { _id: 'u2', name: 'Someone Else', role: 'patient' };
  const r = await call({ phone: '8679532261' });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /already in use/);
  assert.strictEqual(target.saved, false);
});

test('patient: invalid or empty number is refused', async () => {
  target = makeUser('patient'); clash = null;
  assert.strictEqual((await call({ phone: '12345' })).statusCode, 400);
  assert.strictEqual((await call({ phone: '   ' })).statusCode, 400);
  assert.strictEqual(target.saved, false);
});

test('admin accounts cannot be edited here', async () => {
  target = makeUser('admin'); clash = null;
  const r = await call({ phone: '8679532261' });
  assert.strictEqual(r.statusCode, 400);
  assert.strictEqual(target.saved, false);
});

test('doctor: phone + WhatsApp still work', async () => {
  target = makeUser('doctor'); clash = null;
  const r = await call({ phone: '9876543210', whatsappNumber: '9876543210' });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(target.phone, '+919876543210');
  assert.strictEqual(target.whatsappNumber, '+919876543210');
});
