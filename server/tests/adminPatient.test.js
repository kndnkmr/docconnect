// ============================================
// Admin "Help patient" + shared booking rules (no database required)
// ============================================
// Covers: editing details, family members, booking on the patient's behalf
// (and that the patient's own booking still behaves exactly as before), and
// creating an account for someone who can't register. DB calls are stubbed.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const Counter = require('../models/Counter');
Counter.getNextSequence = async () => 7; // before the controllers load it
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const help = require('../controllers/adminPatientController');
const { bookAppointment } = require('../controllers/appointmentController');

// A query result that can be awaited directly OR via .select(...).
const q = (val) => { const p = Promise.resolve(val); p.select = async () => val; return p; };

const ADMIN = { _id: 'admin1', role: 'admin' };
const DOCTOR = { _id: 'doc1', name: 'Anjali Mehta', role: 'doctor', blockedDates: [{ date: '2099-01-02' }] };

const makePatient = (extra = {}) => {
  const members = [];
  members.id = (id) => members.find((m) => String(m._id) === String(id)) || null;
  return {
    _id: 'pat1', name: 'Usha Rana', role: 'patient', phone: '', email: 'usha@example.com',
    bloodGroup: '', allergies: '', familyMembers: members, adminEdits: [], isDeleted: false, isSuspended: false,
    saved: 0, async save() { this.saved += 1; },
    ...extra,
  };
};

let patient; let clash; let slotTaken; let created; let newUser;
beforeEach(() => {
  patient = makePatient(); clash = null; slotTaken = null; created = null; newUser = null;
  User.findById = (id) => q(String(id) === 'pat1' ? patient : null);
  User.findOne = (query) => {
    if (query && query.role === 'doctor') return q(DOCTOR);
    if (query && query.isDeleted === true) return q(null); // no deleted account to move aside
    return q(clash);
  };
  User.create = async (data) => { newUser = { ...data, async save() {} }; return newUser; };
  Appointment.findOne = () => q(slotTaken);
  Appointment.create = async (data) => { created = data; return { ...data, _id: 'apt1', async populate() {} }; };
});

const run = async (handler, { params = {}, body = {}, user = ADMIN } = {}) => {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  await handler({ params, body, user, headers: {}, ip: '10.0.0.1' }, res);
  return res;
};

// ---------- Details ----------
test('details: adds a missing phone, formats it, logs the edit (field names only)', async () => {
  const r = await run(help.updatePatientDetails, { params: { id: 'pat1' }, body: { phone: '8679532261', allergies: 'Penicillin' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(patient.phone, '+918679532261');
  assert.strictEqual(patient.allergies, 'Penicillin');
  assert.deepStrictEqual(patient.adminEdits[0].fields, ['phone', 'allergies']);
  assert.strictEqual(patient.adminEdits[0].by, 'admin1');
  assert.ok(!JSON.stringify(patient.adminEdits).includes('Penicillin')); // values not copied
});

test('details: phone already used by another account is refused', async () => {
  clash = { _id: 'other', name: 'Someone Else', role: 'patient' };
  const r = await run(help.updatePatientDetails, { params: { id: 'pat1' }, body: { phone: '8679532261' } });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /already in use/);
  assert.strictEqual(patient.saved, 0);
});

test('details: phone cannot be blanked; invalid blood group refused', async () => {
  assert.strictEqual((await run(help.updatePatientDetails, { params: { id: 'pat1' }, body: { phone: ' ' } })).statusCode, 400);
  assert.strictEqual((await run(help.updatePatientDetails, { params: { id: 'pat1' }, body: { bloodGroup: 'Z+' } })).statusCode, 400);
  assert.strictEqual(patient.saved, 0);
});

test('details: clearing email stores it as absent (sparse index safe)', async () => {
  const r = await run(help.updatePatientDetails, { params: { id: 'pat1' }, body: { email: '' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(patient.email, undefined);
});

test('details: nothing changed → nothing saved', async () => {
  const r = await run(help.updatePatientDetails, { params: { id: 'pat1' }, body: { name: 'Usha Rana' } });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(patient.saved, 0);
});

test('details: doctor or unknown accounts are refused', async () => {
  User.findById = () => q({ ...makePatient(), role: 'doctor' });
  assert.strictEqual((await run(help.updatePatientDetails, { params: { id: 'pat1' }, body: { name: 'X' } })).statusCode, 400);
  User.findById = () => q(null);
  assert.strictEqual((await run(help.updatePatientDetails, { params: { id: 'nope' }, body: { name: 'X' } })).statusCode, 404);
});

// ---------- Family ----------
test('family: add uses the same rules and is logged', async () => {
  patient.familyMembers.push = function push(m) { Array.prototype.push.call(this, { _id: `m${this.length}`, ...m }); };
  const r = await run(help.addPatientFamilyMember, { params: { id: 'pat1' }, body: { name: 'Mummy', relationship: 'parent', gender: 'female' } });
  assert.strictEqual(r.statusCode, 201);
  assert.strictEqual(patient.familyMembers[0].name, 'Mummy');
  assert.deepStrictEqual(patient.adminEdits[0].fields, ['familyMembers']);
  const bad = await run(help.addPatientFamilyMember, { params: { id: 'pat1' }, body: { name: 'X', relationship: 'friend' } });
  assert.strictEqual(bad.statusCode, 400);
});

// ---------- Booking on behalf ----------
const BOOKING = { doctorId: 'doc1', date: '2099-01-01', timeSlot: '10:30 AM - 11:00 AM', reason: 'Thyroid follow-up', consultationType: 'phone' };

test('book: refused without the admin confirming the patient\'s consent', async () => {
  const r = await run(help.bookForPatient, { params: { id: 'pat1' }, body: { ...BOOKING } });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /agreed/);
  assert.strictEqual(created, null);
});

test('book: records consent-by-admin and which admin booked it', async () => {
  const r = await run(help.bookForPatient, { params: { id: 'pat1' }, body: { ...BOOKING, consentConfirmed: true } });
  assert.strictEqual(r.statusCode, 201);
  assert.strictEqual(created.patient, 'pat1');
  assert.strictEqual(created.consentBy, 'admin');
  assert.strictEqual(created.bookedByAdmin, 'admin1');
  assert.strictEqual(created.consentGiven, true);
  assert.strictEqual(created.status, 'pending');
  assert.strictEqual(created.paymentStatus, 'pending');
});

test('book: family member must exist on the account', async () => {
  const r = await run(help.bookForPatient, { params: { id: 'pat1' }, body: { ...BOOKING, consentConfirmed: true, bookedFor: 'family', familyMemberName: 'Unknown' } });
  assert.strictEqual(r.statusCode, 400);
  patient.familyMembers.push({ _id: 'm1', name: 'Mummy', relationship: 'parent' });
  const ok = await run(help.bookForPatient, { params: { id: 'pat1' }, body: { ...BOOKING, consentConfirmed: true, bookedFor: 'family', familyMemberName: 'mummy' } });
  assert.strictEqual(ok.statusCode, 201);
  assert.strictEqual(created.familyMemberName, 'Mummy');
});

test('book: same rules as the patient — taken slot, blocked date, past date', async () => {
  slotTaken = { _id: 'x' };
  assert.strictEqual((await run(help.bookForPatient, { params: { id: 'pat1' }, body: { ...BOOKING, consentConfirmed: true } })).statusCode, 400);
  slotTaken = null;
  assert.strictEqual((await run(help.bookForPatient, { params: { id: 'pat1' }, body: { ...BOOKING, date: '2099-01-02', consentConfirmed: true } })).statusCode, 400);
  assert.strictEqual((await run(help.bookForPatient, { params: { id: 'pat1' }, body: { ...BOOKING, date: '2020-01-01', consentConfirmed: true } })).statusCode, 400);
});

test('book: deactivated accounts are refused', async () => {
  patient.isSuspended = true;
  assert.strictEqual((await run(help.bookForPatient, { params: { id: 'pat1' }, body: { ...BOOKING, consentConfirmed: true } })).statusCode, 400);
});

// ---------- The patient's own booking is unchanged ----------
test('patient booking: still consentBy patient, no admin, same validations', async () => {
  const me = { _id: 'pat1', role: 'patient' };
  const r = await run(bookAppointment, { body: { ...BOOKING, consentGiven: true }, user: me });
  assert.strictEqual(r.statusCode, 201);
  assert.strictEqual(created.consentBy, 'patient');
  assert.strictEqual(created.bookedByAdmin, null);
  assert.strictEqual((await run(bookAppointment, { body: { ...BOOKING }, user: me })).statusCode, 400); // no consent
  slotTaken = { _id: 'x' };
  assert.strictEqual((await run(bookAppointment, { body: { ...BOOKING, consentGiven: true }, user: me })).statusCode, 400);
});

test('patient booking: race on the same slot (duplicate key) → friendly 400', async () => {
  Appointment.create = async () => { const e = new Error('dup'); e.code = 11000; throw e; };
  const r = await run(bookAppointment, { body: { ...BOOKING, consentGiven: true }, user: { _id: 'pat1', role: 'patient' } });
  assert.strictEqual(r.statusCode, 400);
  assert.match(r.body.message, /just booked/);
});

// ---------- New patient ----------
test('new patient: phone and consent are required', async () => {
  assert.strictEqual((await run(help.createPatient, { body: { name: 'Ramesh', consentConfirmed: true } })).statusCode, 400);
  assert.strictEqual((await run(help.createPatient, { body: { name: 'Ramesh', phone: '9876543210' } })).statusCode, 400);
  assert.strictEqual(newUser, null);
});

test('new patient: created with a random password, Patient ID and a 48-hour set-password link', async () => {
  const before = Date.now();
  const r = await run(help.createPatient, { body: { name: 'Ramesh Kumar', phone: '9876543210', consentConfirmed: true } });
  assert.strictEqual(r.statusCode, 201);
  assert.strictEqual(newUser.role, 'patient');
  assert.strictEqual(newUser.phone, '+919876543210');
  assert.strictEqual(newUser.email, undefined);
  assert.strictEqual(newUser.createdByAdmin, 'admin1');
  assert.strictEqual(newUser.patientId, 'PT000007');
  assert.ok(newUser.password.length >= 32);
  assert.ok(!JSON.stringify(r.body).includes(newUser.password)); // never shown
  assert.match(r.body.setPasswordUrl, /\/reset-password\/[a-f0-9]{64}$/);
  const hours = (newUser.resetPasswordExpire - before) / 3600000;
  assert.ok(hours > 47.9 && hours <= 48.01);
});

test('new patient: an existing number is refused and points to that account', async () => {
  clash = { _id: 'pat9', name: 'Ramesh K', role: 'patient' };
  const r = await run(help.createPatient, { body: { name: 'Ramesh', phone: '9876543210', consentConfirmed: true } });
  assert.strictEqual(r.statusCode, 400);
  assert.strictEqual(r.body.existingUserId, 'pat9');
});
