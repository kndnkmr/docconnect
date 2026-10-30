// ============================================
// Payment details: UPI ID format, QR must be an image, UPI ID read from QR
// ============================================
// No database: User calls are stubbed. uploadFile falls back to a base64
// data URL when Cloudinary isn't configured (as in tests).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
delete process.env.CLOUDINARY_CLOUD_NAME;
const User = require('../models/User');
const push = require('../utils/push');
const mail = require('../utils/sendEmail');
const { validateDoctorUpdates, updateDoctorProfile } = require('../controllers/doctorController');
const manage = require('../controllers/adminDoctorController');

const q = (val) => { const p = Promise.resolve(val); p.select = async () => val; return p; };
const ID = '0123456789abcdef01234567';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
let doctor; let pushes;
beforeEach(() => {
  doctor = { _id: ID, name: 'Test Doc', role: 'doctor', upiId: '', upiQrCode: '', adminEdits: [], isDeleted: false, isModified() { return false; }, async save() {} };
  pushes = [];
  User.findById = (id) => q(String(id) === ID ? doctor : null);
  User.findOne = () => q(null);
  push.sendPushToUser = async (id, msg) => { pushes.push(msg); };
  mail.sendEmail = async () => ({ success: true });
});
const run = async (handler, req) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ params: {}, body: {}, ...req }, res);
  return res;
};

test('UPI ID: empty or a real-looking ID only', () => {
  for (const ok of ['', 'drname@okicici', '9876543210@ybl', ' a.b-c@paytm ']) assert.strictEqual(validateDoctorUpdates({ upiId: ok }), null, ok);
  for (const bad of ['drname', 'dr name@ybl', '@ybl', 'https://pay.me/x', '98765@1bank']) assert.match(validateDoctorUpdates({ upiId: bad }) || '', /UPI ID/, bad);
});

test('doctor QR upload: a PDF is refused with a clear message', async () => {
  const r = await run(updateDoctorProfile, { user: { _id: ID }, body: { fieldName: 'upiQrCode' }, file: { buffer: Buffer.from('%PDF'), mimetype: 'application/pdf' } });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /picture of your UPI QR/);
});

test('doctor QR upload with the UPI ID read from it saves both (trimmed)', async () => {
  const r = await run(updateDoctorProfile, { user: { _id: ID }, body: { fieldName: 'upiQrCode', upiId: ' drtest@okicici ' }, file: { buffer: PNG, mimetype: 'image/png' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.match(doctor.upiQrCode, /^data:image\/png;base64,/);
  assert.strictEqual(doctor.upiId, 'drtest@okicici');
});

test('admin QR upload fills an EMPTY UPI ID from the QR, never overwrites one', async () => {
  let r = await run(manage.uploadDoctorImage, { user: { _id: 'admin1' }, params: { id: ID }, body: { fieldName: 'upiQrCode', upiId: 'drtest@okicici' }, file: { buffer: PNG, mimetype: 'image/png' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.strictEqual(doctor.upiId, 'drtest@okicici');
  assert.deepStrictEqual(doctor.adminEdits.at(-1).fields, ['upiQrCode', 'upiId']);
  assert.match(r.body.message, /saved from the QR/);
  assert.strictEqual(pushes.length, 1, 'doctor is told about the payment change');

  doctor.upiId = 'own@ybl';
  r = await run(manage.uploadDoctorImage, { user: { _id: 'admin1' }, params: { id: ID }, body: { fieldName: 'upiQrCode', upiId: 'other@okicici' }, file: { buffer: PNG, mimetype: 'image/png' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(doctor.upiId, 'own@ybl', 'typed UPI ID kept');

  r = await run(manage.uploadDoctorImage, { user: { _id: 'admin1' }, params: { id: ID }, body: { fieldName: 'upiQrCode', upiId: 'not valid' }, file: { buffer: PNG, mimetype: 'image/png' } });
  assert.strictEqual(r.statusCode, 400);
});
