// ============================================
// Admin → Manage doctor: full profile control on a doctor's behalf
// ============================================
// For doctors who send their details to ProMedicoz and want the admin to
// set up and run their profile ("I just want to see patients").
//
// Safeguards:
//   - Same validation as the doctor's own form (doctorController
//     validateDoctorUpdates + shared phone/email clash checks) — the admin
//     can't save anything the doctor couldn't.
//   - Every change is logged on the doctor (User.adminEdits: who, when, which
//     fields; never the values).
//   - The doctor is told: fee / UPI ID / UPI QR at once, everything else in a
//     daily summary (utils/adminEditNotes.js).
//   - Creating a doctor requires ticking "the doctor asked us to manage this"
//     (recorded: managedByAdmin + when + by whom). No password is typed by the
//     admin; the doctor sets one via "Send Password Reset" when they want to.
//   - Nothing is locked: the doctor can still log in and edit everything.

const crypto = require('crypto');
const User = require('../models/User');
const { validateDoctorUpdates } = require('./doctorController');
const { checkPhone, checkOptionalPhone, checkEmail, ContactError, releaseFromDeletedAccounts } = require('../utils/contactChecks');
const { uploadFile } = require('../utils/uploadFile');
const { notifyNowIfUrgent } = require('../utils/adminEditNotes');
const { setBlockedDates } = require('./availabilityController');

// Everything the doctor's own Edit Profile can change, plus email (the doctor
// can't change their own email there, but support often needs to).
const EDITABLE = [
  'name', 'specialization', 'qualification', 'medicalRegistrationNo', 'experience', 'consultationFee',
  'bio', 'consultationModes', 'languagesSpoken', 'city', 'clinicAddress', 'googleMapsLink',
  'googleReviewLink', 'phone', 'whatsappNumber', 'email', 'upiId',
];

// Fields the admin screen needs (incl. private ones patients never see).
const MANAGE_FIELDS = 'name email phone whatsappNumber role slug isVerified isAdminVerified isSuspended isDeleted '
  + 'specialization qualification medicalRegistrationNo experience consultationFee bio consultationModes '
  + 'languagesSpoken city clinicAddress googleMapsLink googleReviewLink upiId upiQrCode profilePhoto '
  + 'availability slotDuration blockedDates managedByAdmin managedConsentAt adminEdits createdByAdmin createdAt';

class ManageError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (res, error, label) => {
  if (error instanceof ManageError || error instanceof ContactError) return res.status(error.status).json({ message: error.message });
  if (error && error.name === 'ValidationError') {
    const first = Object.values(error.errors || {})[0];
    return res.status(400).json({ message: (first && first.message) || 'Some details are not valid' });
  }
  if (error && error.code === 11000) return res.status(400).json({ message: 'That email or phone is already used by another account.' });
  console.error(`${label} error:`, error && error.message);
  return res.status(500).json({ message: `${label} failed. Please try again.` });
};

function logEdit(doctor, adminId, fields, notified = false) {
  if (!fields.length) return;
  doctor.adminEdits = [...(doctor.adminEdits || []), { by: adminId, at: new Date(), fields, notified }].slice(-50);
}

async function loadDoctor(id) {
  if (!/^[a-f0-9]{24}$/i.test(String(id))) throw new ManageError(400, 'Invalid doctor id');
  const doctor = await User.findById(id);
  if (!doctor || doctor.role !== 'doctor') throw new ManageError(404, 'Doctor not found');
  if (doctor.isDeleted) throw new ManageError(400, 'This doctor account was deleted.');
  return doctor;
}

const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');

// ---- POST /api/admin/doctors — create a doctor from the details they sent ----
// Body: { name, phone, email?, specialization?, city?, consentConfirmed: true }
const createDoctor = async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) throw new ManageError(400, 'Name is required.');
    if (name.length > 100) throw new ManageError(400, 'Name is too long.');
    if (b.consentConfirmed !== true) {
      throw new ManageError(400, 'Please confirm the doctor asked ProMedicoz to set up and manage their profile.');
    }
    const phone = await checkPhone(b.phone, { revealOwner: true });
    const email = await checkEmail(b.email, { revealOwner: true });
    await releaseFromDeletedAccounts({ phone, email });
    const extra = {};
    for (const f of ['specialization', 'city']) if (b[f] !== undefined) extra[f] = String(b[f]).trim().slice(0, 100);

    const doctor = new User({
      name, phone, email: email || undefined,
      // Random password nobody knows; the doctor sets their own via
      // "Send Password Reset" when they want to log in.
      password: crypto.randomBytes(24).toString('hex'),
      role: 'doctor',
      isVerified: true, // contact details came to the admin directly
      createdByAdmin: req.user._id,
      managedByAdmin: true,
      managedConsentAt: new Date(),
      managedConsentBy: req.user._id,
      ...extra,
    });
    logEdit(doctor, req.user._id, ['account created', ...Object.keys(extra)], true);
    await doctor.save();
    res.status(201).json({ message: `Created a doctor account for "${name}". Fill in the rest in Manage doctor.`, doctor: { _id: doctor._id, name: doctor.name, slug: doctor.slug } });
  } catch (error) {
    fail(res, error, 'Creating doctor');
  }
};

// ---- GET /api/admin/doctors/:id — everything Manage doctor shows ----
const getDoctorForManage = async (req, res) => {
  try {
    await loadDoctor(req.params.id);
    const doctor = await User.findById(req.params.id).select(MANAGE_FIELDS).populate('adminEdits.by', 'name').lean();
    doctor.adminEdits = (doctor.adminEdits || []).slice().reverse();
    res.json({ doctor });
  } catch (error) {
    fail(res, error, 'Loading doctor');
  }
};

// ---- PUT /api/admin/doctors/:id — save any changed fields ----
const updateDoctorAsAdmin = async (req, res) => {
  try {
    const doctor = await loadDoctor(req.params.id);
    const body = req.body || {};
    const updates = {};
    for (const f of EDITABLE) if (body[f] !== undefined) updates[f] = body[f];
    if (body.managedByAdmin !== undefined) updates.managedByAdmin = Boolean(body.managedByAdmin);
    if (!Object.keys(updates).length) throw new ManageError(400, 'Nothing to update.');

    // Same rules as the doctor's own form.
    const { email, managedByAdmin, ...profileFields } = updates;
    const problem = validateDoctorUpdates(profileFields);
    if (problem) throw new ManageError(400, problem);
    if (profileFields.experience !== undefined && profileFields.experience !== null && profileFields.experience !== '') {
      const n = Number(profileFields.experience);
      if (!Number.isFinite(n) || n < 0 || n > 70) throw new ManageError(400, 'Experience must be between 0 and 70 years.');
      profileFields.experience = n;
    }
    if (profileFields.consultationFee !== undefined && profileFields.consultationFee !== null && profileFields.consultationFee !== '') {
      const n = Number(profileFields.consultationFee);
      if (!Number.isFinite(n) || n < 0 || n > 100000) throw new ManageError(400, 'Fee must be between 0 and 100000.');
      profileFields.consultationFee = n;
    }
    if (profileFields.name !== undefined && !String(profileFields.name).trim()) throw new ManageError(400, 'Name cannot be empty.');
    if (profileFields.phone !== undefined) profileFields.phone = await checkPhone(profileFields.phone, { selfId: doctor._id, revealOwner: true });
    if (profileFields.whatsappNumber !== undefined) profileFields.whatsappNumber = checkOptionalPhone(profileFields.whatsappNumber, 'WhatsApp number');
    for (const f of ['name', 'specialization', 'qualification', 'medicalRegistrationNo', 'bio', 'city', 'clinicAddress', 'googleMapsLink', 'googleReviewLink', 'upiId']) {
      if (typeof profileFields[f] === 'string') profileFields[f] = profileFields[f].trim();
    }

    const changed = [];
    for (const [k, v] of Object.entries(profileFields)) {
      if (!same(doctor[k], v)) { doctor[k] = v; changed.push(k); }
    }
    if (email !== undefined) {
      const clean = await checkEmail(email, { selfId: doctor._id, revealOwner: true });
      if ((doctor.email || '') !== (clean || '')) {
        doctor.email = clean || undefined;
        changed.push('email');
      }
    }
    if (managedByAdmin !== undefined && doctor.managedByAdmin !== managedByAdmin) {
      doctor.managedByAdmin = managedByAdmin;
      if (managedByAdmin) { doctor.managedConsentAt = new Date(); doctor.managedConsentBy = req.user._id; }
      changed.push('managedByAdmin');
    }
    if (!changed.length) return res.json({ message: 'No changes — everything was already saved.', changed: [] });

    if (doctor.isModified('phone')) await releaseFromDeletedAccounts({ phone: doctor.phone, selfId: doctor._id });
    // managedByAdmin is admin bookkeeping — don't tell the doctor about it.
    logEdit(doctor, req.user._id, changed.filter((f) => f !== 'managedByAdmin'));
    await doctor.save({ validateModifiedOnly: true });
    const toldNow = await notifyNowIfUrgent(doctor);
    res.json({ message: `Saved: ${changed.length} change${changed.length === 1 ? '' : 's'}.${toldNow ? ' The doctor was told about the payment change.' : ''}`, changed, toldNow });
  } catch (error) {
    fail(res, error, 'Saving doctor');
  }
};

// ---- POST /api/admin/doctors/:id/image — photo or UPI QR (multipart) ----
// Form fields: file (image), fieldName = 'profilePhoto' | 'upiQrCode'
const uploadDoctorImage = async (req, res) => {
  try {
    const doctor = await loadDoctor(req.params.id);
    const field = req.body && req.body.fieldName;
    if (!['profilePhoto', 'upiQrCode'].includes(field)) throw new ManageError(400, 'fieldName must be profilePhoto or upiQrCode');
    if (!req.file) throw new ManageError(400, 'Please choose an image.');
    if (!/^image\//.test(req.file.mimetype || '')) throw new ManageError(400, 'Please upload an image (JPG or PNG).');
    // The admin screen reads the UPI ID from the QR in the browser and sends
    // it along. Only fills an EMPTY UPI ID (never overwrites one).
    const readUpi = field === 'upiQrCode' && typeof req.body.upiId === 'string' ? req.body.upiId.trim() : '';
    if (readUpi && validateDoctorUpdates({ upiId: readUpi })) throw new ManageError(400, 'The UPI ID read from the QR is not valid.');
    const url = await uploadFile(req.file.buffer, req.file.mimetype, field === 'upiQrCode' ? 'promedicoz/qr' : 'promedicoz/profile');
    doctor[field] = url;
    const fields = [field];
    if (readUpi && !String(doctor.upiId || '').trim()) { doctor.upiId = readUpi; fields.push('upiId'); }
    logEdit(doctor, req.user._id, fields);
    await doctor.save({ validateModifiedOnly: true });
    const toldNow = await notifyNowIfUrgent(doctor);
    const upiNote = fields.includes('upiId') ? ` UPI ID ${doctor.upiId} saved from the QR.` : '';
    res.json({ message: field === 'upiQrCode' ? `UPI QR code updated.${upiNote}${toldNow ? ' The doctor was told.' : ''}` : 'Photo updated.', url, toldNow, upiId: doctor.upiId });
  } catch (error) {
    fail(res, error, 'Uploading image');
  }
};

// ---- PUT /api/admin/doctors/:id/blocked-dates — days off / leave ----
// Same rules as the doctor's own (availabilityController.setBlockedDates).
const setDoctorBlockedDatesAdmin = async (req, res) => {
  try {
    const doctor = await loadDoctor(req.params.id);
    const before = JSON.stringify(doctor.blockedDates || []);
    // Run the doctor-side handler with the doctor as the target user, and
    // capture its answer so we can log + reply.
    let status = 200; let payload = null;
    const proxyRes = { status(s) { status = s; return this; }, json(p) { payload = p; return this; } };
    await setBlockedDates({ body: req.body, user: { _id: doctor._id } }, proxyRes);
    if (status !== 200) return res.status(status).json(payload);
    if (JSON.stringify(payload.blockedDates || []) !== before) {
      const fresh = await User.findById(doctor._id);
      logEdit(fresh, req.user._id, ['blockedDates']);
      await fresh.save({ validateModifiedOnly: true });
    }
    res.json(payload);
  } catch (error) {
    fail(res, error, 'Saving days off');
  }
};

module.exports = { createDoctor, getDoctorForManage, updateDoctorAsAdmin, uploadDoctorImage, setDoctorBlockedDatesAdmin, EDITABLE, logEdit };
