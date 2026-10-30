// ============================================
// Validation / authorization gaps (audit fixes) — no database required
// ============================================
// Each block covers one fix: slot rules, booking rules, follow-ups, blocked
// patients, suspended/deleted tokens, payment + call guards, meeting links,
// prescriptions, account/medical/doctor-profile contact checks, push
// subscriptions, and private fields on public doctor endpoints.
// Mongoose statics are stubbed per test.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const slots = require('../utils/slots');
const { createBooking } = require('../utils/booking');
const appt = require('../controllers/appointmentController');
const { protect } = require('../middleware/auth');
const rx = require('../controllers/prescriptionController');
const auth = require('../controllers/authController');
const doctors = require('../controllers/doctorController');
const push = require('../controllers/pushController');
const pay = require('../controllers/paymentController');

// A query result usable as `await X`, `await X.select()`, `await X.populate()`.
const q = (val) => {
  const p = Promise.resolve(val);
  p.select = () => q(val);
  p.populate = () => q(val);
  return p;
};

const run = async (handler, { params = {}, body = {}, user = {}, file } = {}) => {
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  const req = { params, body, user, headers: {}, ip: '10.0.0.1', file, app: { get: () => null } };
  await handler(req, res);
  return res;
};

// 2099-01-01 is a Thursday.
const DATE = '2099-01-01';
const SLOT = '10:30 AM - 11:00 AM';
const makeDoctor = (extra = {}) => ({
  _id: 'doc1', name: 'Anjali Mehta', role: 'doctor', blockedDates: [], blockedPatients: [],
  availability: [{ day: 'Thursday', startTime: '09:00', endTime: '13:00' }], slotDuration: 30,
  ...extra,
});
const makePatient = () => ({ _id: 'pat1', name: 'Usha Rana', role: 'patient', familyMembers: [{ name: 'Mummy' }] });
const BODY = { doctorId: 'doc1', date: DATE, timeSlot: SLOT, reason: 'Fever', consultationType: 'video', consentGiven: true };

let doctor; let doctorQuery; let original; let created;
beforeEach(() => {
  doctor = makeDoctor(); doctorQuery = null; original = null; created = null;
  User.findById = () => q(makePatient());
  User.findOne = (query) => { doctorQuery = query; return q(doctor); };
  Appointment.findOne = () => q(null);
  Appointment.findById = () => q(original);
  Appointment.create = async (data) => { created = data; return { ...data, _id: 'apt1', async populate() {} }; };
});

const bookErr = async (body) => {
  try {
    await createBooking({ patientId: 'pat1', body: { ...BODY, ...body } });
    return null;
  } catch (e) {
    return e;
  }
};

// ---------- Slot rules ----------
test('slots: real YYYY-MM-DD dates only', () => {
  assert.ok(slots.isValidDateString('2099-01-01'));
  assert.ok(!slots.isValidDateString('2099-02-31'));
  assert.ok(!slots.isValidDateString('01-01-2099'));
  assert.ok(!slots.isValidDateString({ $gt: '' }));
});

test('slots: labels match the free-slot endpoint format', () => {
  const s = slots.slotsForDate(makeDoctor(), DATE);
  assert.strictEqual(s[0], '09:00 AM - 09:30 AM');
  assert.ok(s.includes(SLOT));
  assert.strictEqual(s.length, 8);
  assert.deepStrictEqual(slots.slotsForDate(makeDoctor(), '2099-01-02'), []); // Friday: no hours
});

test('slots: a slot that already started today is refused', () => {
  const today = slots.nowIST().date;
  const day = slots.dayNameOf(today);
  const d = makeDoctor({ availability: [{ day, startTime: '00:00', endTime: '00:00' }] });
  assert.match(slots.slotProblem(d, today, '12:00 AM - 12:30 AM'), /already started/);
});

// ---------- Booking ----------
test('booking: a time not in the doctor\'s schedule is refused', async () => {
  const e = await bookErr({ timeSlot: '03:00 AM - 03:30 AM' });
  assert.strictEqual(e.status, 400);
  assert.match(e.message, /not available/);
  assert.strictEqual(created, null);
});

test('booking: bad date format is refused', async () => {
  assert.strictEqual((await bookErr({ date: '2099/01/01' })).status, 400);
});

test('booking: only bookable doctors (not suspended/deleted/unverified)', async () => {
  await createBooking({ patientId: 'pat1', body: BODY });
  assert.deepStrictEqual(doctorQuery.isSuspended, { $ne: true });
  assert.deepStrictEqual(doctorQuery.isDeleted, { $ne: true });
  assert.deepStrictEqual(doctorQuery.isVerified, { $ne: false });
  assert.ok(created);
});

test('booking: a patient the doctor blocked cannot book', async () => {
  doctor = makeDoctor({ blockedPatients: ['pat1'] });
  const e = await bookErr({});
  assert.strictEqual(e.status, 403);
});

test('booking: free follow-up needs the original appointment', async () => {
  const e = await bookErr({ isFollowUp: true });
  assert.strictEqual(e.status, 400);
  assert.strictEqual(created, null);
});

test('booking: follow-up from someone else\'s appointment is refused', async () => {
  original = { patient: 'someoneElse', doctor: 'doc1', status: 'completed', followUpDeadline: new Date(Date.now() + 86400000) };
  assert.strictEqual((await bookErr({ isFollowUp: true, originalAppointmentId: 'o1' })).status, 400);
  original = { patient: 'pat1', doctor: 'otherDoc', status: 'completed', followUpDeadline: new Date(Date.now() + 86400000) };
  assert.strictEqual((await bookErr({ isFollowUp: true, originalAppointmentId: 'o1' })).status, 400);
});

test('booking: valid follow-up is free (paid) and linked', async () => {
  original = { patient: 'pat1', doctor: 'doc1', status: 'completed', followUpDeadline: new Date(Date.now() + 86400000) };
  await createBooking({ patientId: 'pat1', body: { ...BODY, isFollowUp: true, originalAppointmentId: 'o1' } });
  assert.strictEqual(created.paymentStatus, 'paid');
  assert.strictEqual(created.originalAppointment, 'o1');
});

test('booking: expired follow-up window is refused', async () => {
  original = { patient: 'pat1', doctor: 'doc1', status: 'completed', followUpDeadline: new Date(Date.now() - 1000) };
  assert.match((await bookErr({ isFollowUp: true, originalAppointmentId: 'o1' })).message, /expired/);
});

test('booking: family member must be saved on the account; saved spelling used', async () => {
  assert.strictEqual((await bookErr({ bookedFor: 'family', familyMemberName: 'Stranger' })).status, 400);
  await createBooking({ patientId: 'pat1', body: { ...BODY, bookedFor: 'family', familyMemberName: ' mummy ' } });
  assert.strictEqual(created.familyMemberName, 'Mummy');
});

test('booking: reason length, consultation type and bookedFor are checked', async () => {
  assert.strictEqual((await bookErr({ reason: 'x'.repeat(1001) })).status, 400);
  assert.strictEqual((await bookErr({ reason: { $gt: '' } })).status, 400);
  assert.strictEqual((await bookErr({ consultationType: 'teleport' })).status, 400);
  assert.strictEqual((await bookErr({ bookedFor: 'neighbour' })).status, 400);
});

test('booking: the note is optional — chips, or "Not specified", fill the reason', async () => {
  // Chips only, no note
  assert.strictEqual(await bookErr({ reason: '', symptoms: ['Fever', 'Cough'] }), null);
  assert.strictEqual(created.reason, 'Fever, Cough');
  // Nothing at all (field left out)
  const { reason, ...noReason } = BODY; // eslint-disable-line no-unused-vars
  await createBooking({ patientId: 'pat1', body: noReason });
  assert.strictEqual(created.reason, 'Not specified');
  // A typed note still wins, trimmed
  assert.strictEqual(await bookErr({ reason: '  Pain for 3 days ', symptoms: ['Fever'] }), null);
  assert.strictEqual(created.reason, 'Pain for 3 days');
  // Pure helper
  const { reasonFor } = require('../utils/booking');
  assert.strictEqual(reasonFor('   ', []), 'Not specified');
  assert.strictEqual(reasonFor(undefined, ['Headache']), 'Headache');
});

test('booking emails escape what people typed (names, reason)', () => {
  const { esc } = require('../utils/sendEmail');
  assert.strictEqual(esc('<script>x</script> & "Dr\'s"'), '&lt;script&gt;x&lt;/script&gt; &amp; &quot;Dr&#39;s&quot;');
  assert.strictEqual(esc(undefined), '');
  // No template puts a typed field into the HTML body unescaped.
  const src = require('fs').readFileSync(require.resolve('../utils/sendEmail'), 'utf8');
  const body = src.split('\n').filter((l) => !/^\s*const subject = /.test(l)).join('\n');
  for (const f of ['patient.name', 'doctor.name', 'appointment.reason', 'doctor.specialization']) {
    assert.ok(!body.includes('${' + f + '}'), `${f} must be wrapped in esc()`);
  }
});

// ---------- Reschedule ----------
test('reschedule: same slot rules as booking', async () => {
  Appointment.findById = () => q({ _id: 'a1', patient: 'pat1', doctor: 'doc1', status: 'confirmed' });
  const bad = await run(appt.rescheduleAppointment, { params: { id: 'a1' }, body: { date: DATE, timeSlot: '03:00 AM - 03:30 AM' }, user: { _id: 'pat1' } });
  assert.strictEqual(bad.statusCode, 400);
  const past = await run(appt.rescheduleAppointment, { params: { id: 'a1' }, body: { date: '2020-01-01', timeSlot: SLOT }, user: { _id: 'pat1' } });
  assert.match(past.body.message, /past/);
  assert.deepStrictEqual(doctorQuery.isSuspended, { $ne: true });
  doctor = makeDoctor({ blockedPatients: ['pat1'] });
  const blocked = await run(appt.rescheduleAppointment, { params: { id: 'a1' }, body: { date: DATE, timeSlot: SLOT }, user: { _id: 'pat1' } });
  assert.strictEqual(blocked.statusCode, 403);
});

// ---------- Tokens of deleted / suspended accounts ----------
test('protect: deleted or suspended accounts are refused even with a valid token', async () => {
  const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
  const call = async (user) => {
    User.findById = () => q(user);
    let nextCalled = false;
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => { nextCalled = true; });
    return { res, nextCalled };
  };
  const ok = await call({ _id: 'u1', role: 'patient' });
  assert.ok(ok.nextCalled);
  const del = await call({ _id: 'u1', role: 'patient', isDeleted: true });
  assert.strictEqual(del.res.statusCode, 401);
  assert.ok(!del.nextCalled);
  const sus = await call({ _id: 'u1', role: 'doctor', isSuspended: true });
  assert.strictEqual(sus.res.statusCode, 401);
  assert.ok(!sus.nextCalled);
});

// ---------- Payment ----------
const aptDoc = (extra = {}) => ({
  _id: 'a1', patient: 'pat1', doctor: { _id: 'doc1', consultationFee: 500, toString: () => 'doc1' },
  status: 'confirmed', paymentStatus: 'pending', saved: 0, async save() { this.saved += 1; },
  ...extra,
});

test('notify payment: cannot downgrade a paid appointment or claim a cancelled one', async () => {
  let a = aptDoc({ paymentStatus: 'paid' });
  Appointment.findById = () => q(a);
  assert.strictEqual((await run(pay.notifyPayment, { params: { id: 'a1' }, user: { _id: 'pat1' } })).statusCode, 400);
  assert.strictEqual(a.paymentStatus, 'paid');
  a = aptDoc({ status: 'cancelled' });
  assert.strictEqual((await run(pay.notifyPayment, { params: { id: 'a1' }, user: { _id: 'pat1' } })).statusCode, 400);
  a = aptDoc();
  const ok = await run(pay.notifyPayment, { params: { id: 'a1' }, user: { _id: 'pat1' } });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(a.paymentStatus, 'patient_claimed');
});

test('mark payment: not on cancelled appointments; huge amounts refused', async () => {
  let a = aptDoc({ status: 'cancelled' });
  Appointment.findById = () => q(a);
  assert.strictEqual((await run(appt.markPayment, { params: { id: 'a1' }, user: { _id: 'doc1', role: 'doctor' } })).statusCode, 400);
  a = aptDoc();
  assert.strictEqual((await run(appt.markPayment, { params: { id: 'a1' }, body: { amount: 10000000 }, user: { _id: 'doc1', role: 'doctor' } })).statusCode, 400);
  const ok = await run(appt.markPayment, { params: { id: 'a1' }, user: { _id: 'doc1', role: 'doctor' } });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(a.amountCollected, 500);
});

// ---------- Calls ----------
test('call ringing: only during the booked slot; ending always allowed', async () => {
  const a = { _id: 'a1', patient: 'pat1', doctor: 'doc1', status: 'confirmed', date: new Date('2099-01-01'), timeSlot: SLOT, async save() {} };
  Appointment.findById = () => q(a);
  const ring = await run(appt.setCallStatus, { params: { id: 'a1' }, body: { active: true }, user: { _id: 'pat1', name: 'Usha' } });
  assert.strictEqual(ring.statusCode, 403);
  assert.ok(!a.callActive);
  const end = await run(appt.setCallStatus, { params: { id: 'a1' }, body: { active: false }, user: { _id: 'pat1', name: 'Usha' } });
  assert.strictEqual(end.statusCode, 200);
});

// ---------- Meeting link ----------
test('status update: meeting link must be https', async () => {
  const a = { _id: 'a1', patient: 'pat1', doctor: 'doc1', status: 'pending', markModified() {}, async save() {}, async populate() {} };
  Appointment.findById = () => q(a);
  const r = await run(appt.updateAppointmentStatus, { params: { id: 'a1' }, body: { status: 'confirmed', meetingLink: 'javascript:alert(1)' }, user: { _id: 'doc1' } });
  assert.strictEqual(r.statusCode, 400);
  assert.strictEqual(a.status, 'pending');
});

// ---------- Prescriptions ----------
const rxApt = (status) => ({ _id: 'a1', patient: 'pat1', doctor: 'doc1', status, async save() { this.saved = true; } });

test('prescription: follow-up days "7" means 7 days (not string-joined)', async () => {
  const a = rxApt('completed');
  Appointment.findById = () => q(a);
  Prescription.findOne = () => q(null);
  Prescription.create = async (d) => ({ ...d, _id: 'p1', patient: 'pat1', appointment: 'a1' });
  const r = await run(rx.createPrescription, { body: { appointmentId: 'a1', diagnosis: 'Viral fever', followUpDays: '7' }, user: { _id: 'doc1', name: 'Anjali' } });
  assert.strictEqual(r.statusCode, 201);
  const days = (a.followUpDeadline - Date.now()) / 86400000;
  assert.ok(days > 6.9 && days < 7.1, `expected ~7 days, got ${days}`);
});

test('prescription: not for pending/cancelled appointments; caps enforced', async () => {
  Prescription.findOne = () => q(null);
  Prescription.create = async (d) => ({ ...d, _id: 'p1', patient: 'pat1', appointment: 'a1' });
  Appointment.findById = () => q(rxApt('pending'));
  const user = { _id: 'doc1', name: 'Anjali' };
  assert.strictEqual((await run(rx.createPrescription, { body: { appointmentId: 'a1', diagnosis: 'x' }, user })).statusCode, 400);
  Appointment.findById = () => q(rxApt('completed'));
  const many = Array.from({ length: 31 }, (_, i) => ({ name: `Med ${i}` }));
  assert.strictEqual((await run(rx.createPrescription, { body: { appointmentId: 'a1', diagnosis: 'x', medicines: many }, user })).statusCode, 400);
  assert.strictEqual((await run(rx.createPrescription, { body: { appointmentId: 'a1', diagnosis: 'x', followUpDays: 400 }, user })).statusCode, 400);
  assert.strictEqual((await run(rx.createPrescription, { body: { appointmentId: 'a1', diagnosis: 'x'.repeat(1001) }, user })).statusCode, 400);
});

// ---------- Account contact details ----------
test('update account: phone must be valid and not used by another account (owner not revealed)', async () => {
  User.find = () => q([]);
  User.updateOne = async () => ({});
  let saved = null;
  User.findByIdAndUpdate = (id, updates) => { saved = updates; return q({ _id: 'pat1', name: 'Usha', ...updates }); };
  const user = { _id: 'pat1', role: 'patient', email: '' };

  assert.strictEqual((await run(auth.updateAccount, { body: { phone: '12345' }, user })).statusCode, 400);
  User.findOne = () => q({ _id: 'other', name: 'Secret Name' });
  const clash = await run(auth.updateAccount, { body: { phone: '9876543210' }, user });
  assert.strictEqual(clash.statusCode, 400);
  assert.ok(!clash.body.message.includes('Secret Name'));
  assert.strictEqual((await run(auth.updateAccount, { body: { email: 'not-an-email' }, user })).statusCode, 400);

  User.findOne = () => q(null);
  const ok = await run(auth.updateAccount, { body: { phone: '98765 43210' }, user });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(saved.phone, '+919876543210');
});

test('medical info: blood group and emergency phone are checked; text capped', async () => {
  User.findByIdAndUpdate = (id, u) => q({ _id: 'pat1', ...u });
  const user = { _id: 'pat1', role: 'patient' };
  assert.strictEqual((await run(auth.updateMedicalInfo, { body: { bloodGroup: 'Z+' }, user })).statusCode, 400);
  assert.strictEqual((await run(auth.updateMedicalInfo, { body: { emergencyContactPhone: '123' }, user })).statusCode, 400);
  assert.strictEqual((await run(auth.updateMedicalInfo, { body: { allergies: 'x'.repeat(1001) }, user })).statusCode, 400);
  assert.strictEqual((await run(auth.updateMedicalInfo, { body: { bloodGroup: 'O+', emergencyContactPhone: '9876543210' }, user })).statusCode, 200);
});

// ---------- Doctor profile ----------
const PROFILE = {
  specialization: 'General Physician', qualification: 'MBBS', medicalRegistrationNo: 'DMC-1',
  experience: 5, consultationFee: 300, clinicAddress: 'Main Road', phone: '9876543210',
};

test('doctor profile: phone validated + clash-checked; unsafe map links refused', async () => {
  User.find = () => q([]);
  User.updateOne = async () => ({});
  const doc = { _id: 'doc1', isModified: () => true, saved: null, async save(o) { this.saved = o; } };
  User.findById = () => q(doc);
  const user = { _id: 'doc1', role: 'doctor' };

  User.findOne = () => q(null);
  assert.strictEqual((await run(doctors.updateDoctorProfile, { body: { ...PROFILE, phone: '555' }, user })).statusCode, 400);
  assert.strictEqual((await run(doctors.updateDoctorProfile, { body: { ...PROFILE, googleMapsLink: 'javascript:alert(1)' }, user })).statusCode, 400);
  assert.strictEqual((await run(doctors.updateDoctorProfile, { body: { ...PROFILE, whatsappNumber: '12' }, user })).statusCode, 400);
  User.findOne = () => q({ _id: 'other', name: 'Someone' });
  assert.strictEqual((await run(doctors.updateDoctorProfile, { body: PROFILE, user })).statusCode, 400);

  User.findOne = () => q(null);
  const ok = await run(doctors.updateDoctorProfile, { body: { ...PROFILE, googleMapsLink: 'https://maps.app.goo.gl/x' }, user });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(doc.phone, '+919876543210');
  assert.deepStrictEqual(doc.saved, { validateModifiedOnly: true }); // schema validation now runs
});

// ---------- Push ----------
test('push subscribe: endpoint must be https with real keys', async () => {
  let updates = 0;
  User.findByIdAndUpdate = async () => { updates += 1; };
  const user = { _id: 'u1' };
  const keys = { p256dh: 'BOr1abc_-', auth: 'xyz123' };
  assert.strictEqual((await run(push.subscribe, { body: { subscription: { endpoint: 'http://169.254.169.254/x', keys } }, user })).statusCode, 400);
  assert.strictEqual((await run(push.subscribe, { body: { subscription: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: { $x: 1 }, auth: 'a' } } }, user })).statusCode, 400);
  assert.strictEqual(updates, 0);
  assert.strictEqual((await run(push.subscribe, { body: { subscription: { endpoint: 'https://fcm.googleapis.com/x', keys } }, user })).statusCode, 200);
});

test('doctor profile: partial save (autosave sends one field) is accepted', async () => {
  const doc = { _id: 'doc1', isModified: () => false, saved: null, async save(o) { this.saved = o; } };
  User.findById = () => q(doc);
  User.findOne = () => q(null);
  const user = { _id: 'doc1', role: 'doctor' };
  const r = await run(doctors.updateDoctorProfile, { body: { bio: 'Family physician, 10 years' }, user });
  assert.strictEqual(r.statusCode, 200);
  assert.strictEqual(doc.bio, 'Family physician, 10 years');
  const cleared = await run(doctors.updateDoctorProfile, { body: { experience: null }, user });
  assert.strictEqual(cleared.statusCode, 200);
  assert.strictEqual((await run(doctors.updateDoctorProfile, { body: {}, user })).statusCode, 400); // nothing sent
});

// ---------- Public doctor endpoints ----------
test('public doctor profile hides login secrets, email, push endpoints, block list', async () => {
  let selected = '';
  User.findOne = () => ({ select: async (s) => { selected = s; return { _id: 'doc1', toObject: () => ({ _id: 'doc1' }) }; } });
  Appointment.countDocuments = async () => 3;
  const r = await run(doctors.getDoctorById, { params: { id: 'doc1' } });
  assert.strictEqual(r.statusCode, 200);
  for (const f of ['password', 'email', 'resetPasswordToken', 'verificationToken', 'pushSubscriptions', 'lastLoginIP', 'blockedPatients', 'adminEdits']) {
    assert.ok(selected.split(' ').includes(`-${f}`), `expected ${f} to be excluded`);
  }
});

// ---------- Consultation types the doctor offers ----------
test('booking: only a consultation type the doctor offers; default = first offered', async () => {
  doctor = makeDoctor({ consultationModes: ['in-person'] });
  const e = await bookErr({ consultationType: 'video' });
  assert.strictEqual(e.status, 400);
  assert.match(e.message, /in-person consultations only/);
  await createBooking({ patientId: 'pat1', body: { ...BODY, consultationType: undefined } });
  assert.strictEqual(created.consultationType, 'in-person');
  doctor = makeDoctor({ consultationModes: ['video', 'phone'] });
  await createBooking({ patientId: 'pat1', body: { ...BODY, consultationType: '' } });
  assert.strictEqual(created.consultationType, 'video');
  await createBooking({ patientId: 'pat1', body: { ...BODY, consultationType: 'phone' } });
  assert.strictEqual(created.consultationType, 'phone');
});

// ---------- One free follow-up per visit ----------
test('booking: only one free follow-up per visit; a cancelled one frees it again', async () => {
  original = { _id: 'o1', patient: 'pat1', doctor: 'doc1', status: 'completed', followUpDeadline: new Date(Date.now() + 86400000) };
  let usedQuery = null;
  let existingFollowUp = { _id: 'f1' };
  Appointment.findOne = (query) => {
    if (query && query.isFollowUp) { usedQuery = query; return q(existingFollowUp); }
    return q(null); // slot free
  };
  const e = await bookErr({ isFollowUp: true, originalAppointmentId: 'o1' });
  assert.strictEqual(e.status, 400);
  assert.match(e.message, /already booked/);
  assert.deepStrictEqual(usedQuery.status, { $ne: 'cancelled' });
  existingFollowUp = null; // the earlier follow-up was cancelled
  await createBooking({ patientId: 'pat1', body: { ...BODY, isFollowUp: true, originalAppointmentId: 'o1' } });
  assert.strictEqual(created.paymentStatus, 'paid');
  // A paid "Book again" isn't limited.
  existingFollowUp = { _id: 'f1' };
  await createBooking({ patientId: 'pat1', body: { ...BODY, originalAppointmentId: 'o1' } });
  assert.strictEqual(created.paymentStatus, 'pending');
});
