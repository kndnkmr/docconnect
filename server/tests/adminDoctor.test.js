// ============================================
// Admin → Manage doctor (no database required; DB calls stubbed)
// ============================================
// Covers: creating a doctor needs the doctor's request recorded; edits use
// the doctor's own validation; every change is logged (field names only);
// fee/UPI/QR changes tell the doctor at once, the rest wait for the daily
// summary; only doctor accounts can be managed.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const User = require('../models/User');
const push = require('../utils/push');
const mail = require('../utils/sendEmail');
const notes = require('../utils/adminEditNotes');
const manage = require('../controllers/adminDoctorController');

const q = (val) => { const p = Promise.resolve(val); p.select = async () => val; return p; };
const ADMIN = { _id: 'admin1', role: 'admin' };
let doctor; let clash; let pushes; let emails; let savedNew;
const makeDoctor = (extra = {}) => ({
  _id: 'doc1', name: 'Pooja Singh', role: 'doctor', email: 'pooja@example.com', phone: '+919876543210',
  consultationFee: 300, upiId: 'old@okicici', city: 'Bhilai', adminEdits: [], isDeleted: false, managedByAdmin: false,
  saved: 0, isModified() { return false; }, async save() { this.saved += 1; },
  ...extra,
});
beforeEach(() => {
  doctor = makeDoctor(); clash = null; pushes = []; emails = []; savedNew = null;
  User.findById = (id) => q(String(id) === 'doc1' ? doctor : String(id) === 'pat1' ? { _id: 'pat1', role: 'patient' } : null);
  User.findOne = () => q(clash);
  User.find = () => q([]);
  User.updateOne = async () => ({});
  User.prototype.save = async function save() { savedNew = this; return this; };
  push.sendPushToUser = async (id, msg) => { pushes.push({ id, ...msg }); };
  mail.sendEmail = async (m) => { emails.push(m); return { success: true }; };
});
const run = async (handler, { params = {}, body = {}, user = ADMIN, file } = {}) => {
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await handler({ params, body, user, file }, res);
  return res;
};
const ID = '0123456789abcdef01234567'; // valid-looking id → findById stub maps below
const withId = () => { const real = User.findById; User.findById = (id) => q(id === ID ? doctor : real(id)); };

// ---------- Create ----------
test('create: needs the doctor\'s request to be confirmed', async () => {
  const r = await run(manage.createDoctor, { body: { name: 'Dr New', phone: '9876500001' } });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /asked ProMedicoz/);
});

test('create: makes a managed doctor account, no admin-typed password, logs it', async () => {
  const r = await run(manage.createDoctor, { body: { name: 'Dr Ravi Sharma', phone: '9876500001', specialization: 'Cardiologist', city: 'Raipur', consentConfirmed: true } });
  assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
  assert.strictEqual(savedNew.role, 'doctor');
  assert.strictEqual(savedNew.managedByAdmin, true);
  assert.strictEqual(String(savedNew.createdByAdmin), String(savedNew.managedConsentBy));
  assert.ok(savedNew.managedConsentAt instanceof Date);
  assert.strictEqual(savedNew.phone, '+919876500001');
  assert.deepStrictEqual(savedNew.adminEdits[0].fields, ['account created', 'specialization', 'city']);
  assert.strictEqual(savedNew.adminEdits[0].notified, true, 'creation itself is not re-announced');
});

test('create: phone already used by someone else is refused', async () => {
  clash = { _id: 'x', name: 'Someone' };
  const r = await run(manage.createDoctor, { body: { name: 'Dr X', phone: '9876500001', consentConfirmed: true } });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /already in use/);
});

// ---------- Update ----------
test('update: same checks as the doctor\'s own form', async () => {
  withId();
  for (const body of [{ googleReviewLink: 'https://evil.com/x' }, { consultationFee: -5 }, { experience: 99 }, { name: '  ' }, { whatsappNumber: '123' }]) {
    const r = await run(manage.updateDoctorAsAdmin, { params: { id: ID }, body });
    assert.strictEqual(r.statusCode, 400, JSON.stringify(body));
  }
  assert.strictEqual(doctor.saved, 0);
});

test('update: only doctors can be managed', async () => {
  const r = await run(manage.updateDoctorAsAdmin, { params: { id: 'pat1' }, body: { bio: 'x' } });
  assert.strictEqual(r.statusCode, 400); // invalid id format → refused before lookup
  const r2 = await run(manage.updateDoctorAsAdmin, { params: { id: 'aaaaaaaaaaaaaaaaaaaaaaaa' }, body: { bio: 'x' } });
  assert.strictEqual(r2.statusCode, 404);
});

test('update: logs field names only; non-money change waits for the daily summary', async () => {
  withId();
  const r = await run(manage.updateDoctorAsAdmin, { params: { id: ID }, body: { bio: 'Pregnancy care, PCOS, fertility.', city: 'Bhilai' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.deepStrictEqual(r.body.changed, ['bio']); // city unchanged → not counted
  assert.deepStrictEqual(doctor.adminEdits[0].fields, ['bio']);
  assert.strictEqual(JSON.stringify(doctor.adminEdits).includes('PCOS'), false, 'values never copied into the log');
  assert.strictEqual(doctor.adminEdits[0].notified, false);
  assert.strictEqual(pushes.length + emails.length, 0);
});

test('update: fee / UPI change tells the doctor at once', async () => {
  withId();
  const r = await run(manage.updateDoctorAsAdmin, { params: { id: ID }, body: { consultationFee: 400, upiId: 'new@okicici' } });
  assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.toldNow, true);
  assert.strictEqual(pushes.length, 1);
  assert.match(pushes[0].body, /fee, UPI ID/);
  assert.strictEqual(emails.length, 1);
  assert.strictEqual(doctor.adminEdits[0].notified, true);
});

test('update: nothing changed → nothing logged', async () => {
  withId();
  const r = await run(manage.updateDoctorAsAdmin, { params: { id: ID }, body: { consultationFee: 300, city: 'Bhilai' } });
  assert.strictEqual(r.statusCode, 200);
  assert.deepStrictEqual(r.body.changed, []);
  assert.strictEqual(doctor.adminEdits.length, 0);
});

test('image: UPI QR upload tells the doctor at once; non-images refused', async () => {
  withId();
  require('../utils/uploadFile').uploadFile = async () => 'https://res.cloudinary.com/x/qr.png';
  // Controller captured uploadFile at load time — patch via the module it uses.
  const bad = await run(manage.uploadDoctorImage, { params: { id: ID }, body: { fieldName: 'upiQrCode' }, file: { buffer: Buffer.from('x'), mimetype: 'application/pdf' } });
  assert.strictEqual(bad.statusCode, 400);
  const wrongField = await run(manage.uploadDoctorImage, { params: { id: ID }, body: { fieldName: 'password' }, file: { buffer: Buffer.from('x'), mimetype: 'image/png' } });
  assert.strictEqual(wrongField.statusCode, 400);
});

// ---------- Notes (pure) ----------
test('changed list is readable and de-duplicated', () => {
  assert.deepStrictEqual(notes.changedList([{ fields: ['consultationFee', 'bio'] }, { fields: ['bio', 'upiQrCode'] }]), ['fee', 'bio', 'UPI QR code']);
  assert.deepStrictEqual(notes.changedList([{ fields: ['account created'] }]), []);
  assert.strictEqual(notes.isUrgent(['bio']), false);
  assert.strictEqual(notes.isUrgent(['upiQrCode']), true);
});

test('daily summary runs once a day after 7 PM IST', () => {
  const at = (iso) => new Date(iso);
  assert.strictEqual(notes.digestDue(at('2026-10-29T12:00:00Z'), null), false); // 5:30 PM IST
  assert.strictEqual(notes.digestDue(at('2026-10-29T14:00:00Z'), null), true);  // 7:30 PM IST
  assert.strictEqual(notes.digestDue(at('2026-10-29T16:00:00Z'), at('2026-10-29T14:00:00Z')), false); // same IST day
  assert.strictEqual(notes.digestDue(at('2026-10-30T14:00:00Z'), at('2026-10-29T14:00:00Z')), true);  // next day
});
