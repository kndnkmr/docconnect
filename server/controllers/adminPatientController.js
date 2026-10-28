// ============================================
// Admin "Help patient" — act on a patient's behalf (support)
// ============================================
// For patients who struggle with the app (e.g. elderly, first-time users),
// a ProMedicoz admin can, from the Admin Panel:
//   PUT    /api/admin/patients/:id                       edit details + medical info
//   POST   /api/admin/patients/:id/family                add a family member
//   PUT    /api/admin/patients/:id/family/:memberId      edit a family member
//   DELETE /api/admin/patients/:id/family/:memberId      remove a family member
//   POST   /api/admin/patients/:id/appointments          book on their behalf
//   POST   /api/admin/patients                           create an account for them
// All routes are admin-only (routes/admin.js applies protect + authorize('admin')).
//
// SAFEGUARDS
//   - Patient accounts only (never doctors/admins); deleted accounts refused.
//   - Phone is required and checked for duplicates; email checked too.
//   - Booking uses the SAME createBooking() as the patient's own booking, and
//     requires the admin to confirm the patient agreed to the teleconsultation
//     terms on a call/WhatsApp. Stored as consentBy='admin' + bookedByAdmin.
//   - Every change to details/family is logged on the account (who, when,
//     which fields — not the values) in user.adminEdits.
//   - The admin never sets or sees a password. New accounts get a random
//     password and a 48-hour "set your password" link for the patient.

const crypto = require('crypto');
const User = require('../models/User');
const { getNextSequence } = require('../models/Counter');
const { formatIndianPhone, isValidIndianPhone } = require('../utils/formatPhone');
const {
  ContactError, checkPhone: sharedCheckPhone, checkEmail: sharedCheckEmail, releaseFromDeletedAccounts,
} = require('../utils/contactChecks');
const { createBooking, BookingError } = require('../utils/booking');
const { addMember, updateMember, removeMember, FamilyError } = require('../utils/familyMembers');
const { sendPushToUser } = require('../utils/push');
const { sendEmail } = require('../utils/sendEmail');

const BLOOD_GROUPS = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const TEXT_FIELDS = ['allergies', 'currentMedications', 'medicalHistory', 'emergencyContactName', 'insuranceProvider', 'insurancePolicyNumber'];
const MAX_TEXT = 1000;
const SET_PASSWORD_HOURS = 48;

class HelpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const sendError = (res, error, label) => {
  if (error instanceof HelpError || error instanceof BookingError || error instanceof FamilyError || error instanceof ContactError) {
    return res.status(error.status).json({ message: error.message, ...(error.extra || {}) });
  }
  if (error && error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0];
    return res.status(400).json({ message: `That ${field === 'email' ? 'email' : 'value'} is already used by another account.` });
  }
  if (error && error.kind === 'ObjectId') {
    return res.status(400).json({ message: 'Invalid id' });
  }
  console.error(`${label} error:`, error.message);
  return res.status(500).json({ message: `Error: ${label.toLowerCase()}` });
};

const clientIP = (req) => req.headers['x-forwarded-for'] || req.ip || '';

async function loadPatient(id) {
  const user = await User.findById(id);
  if (!user) throw new HelpError(404, 'Patient not found');
  if (user.role !== 'patient') throw new HelpError(400, 'This action is only for patient accounts');
  if (user.isDeleted) throw new HelpError(400, 'This account has been deleted');
  return user;
}

// Phone: required, valid Indian mobile, not used by another active account.
// Email: optional, '' clears it, must look like an email and be unused.
// Shared rules (utils/contactChecks); the admin is told whose account clashes.
const checkPhone = (raw, selfId = null) => sharedCheckPhone(raw, { selfId, revealOwner: true });
const checkEmail = (raw, selfId = null) => sharedCheckEmail(raw, { selfId, revealOwner: true });

function logEdit(user, adminId, fields) {
  if (!fields.length) return;
  user.adminEdits = [...(user.adminEdits || []), { by: adminId, at: new Date(), fields }].slice(-20);
}

const publicPatient = (u) => ({
  _id: u._id, name: u.name, email: u.email, phone: u.phone, patientId: u.patientId,
  bloodGroup: u.bloodGroup, allergies: u.allergies, currentMedications: u.currentMedications,
  medicalHistory: u.medicalHistory, emergencyContactName: u.emergencyContactName,
  emergencyContactPhone: u.emergencyContactPhone, insuranceProvider: u.insuranceProvider,
  insurancePolicyNumber: u.insurancePolicyNumber, familyMembers: u.familyMembers,
});

// ============================================
// PUT /api/admin/patients/:id — edit details + medical info
// ============================================
// Body: any of { name, phone, email, bloodGroup, allergies, currentMedications,
// medicalHistory, emergencyContactName, emergencyContactPhone,
// insuranceProvider, insurancePolicyNumber }. Only fields sent are changed.
const updatePatientDetails = async (req, res) => {
  try {
    const user = await loadPatient(req.params.id);
    const b = req.body || {};
    const changed = [];

    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) throw new HelpError(400, 'Name cannot be empty.');
      if (name.length > 100) throw new HelpError(400, 'Name is too long.');
      if (name !== user.name) { user.name = name; changed.push('name'); }
    }
    if (b.phone !== undefined) {
      const phone = await checkPhone(b.phone, user._id);
      if (phone !== user.phone) { user.phone = phone; changed.push('phone'); }
    }
    if (b.email !== undefined) {
      const email = await checkEmail(b.email, user._id);
      if (email !== (user.email || '')) {
        // Sparse unique index: an absent email must be undefined, never ''.
        user.email = email || undefined;
        changed.push('email');
      }
    }
    if (b.bloodGroup !== undefined) {
      if (!BLOOD_GROUPS.includes(b.bloodGroup)) throw new HelpError(400, 'Invalid blood group.');
      if (b.bloodGroup !== user.bloodGroup) { user.bloodGroup = b.bloodGroup; changed.push('bloodGroup'); }
    }
    for (const f of TEXT_FIELDS) {
      if (b[f] === undefined) continue;
      const v = String(b[f]).trim();
      if (v.length > MAX_TEXT) throw new HelpError(400, `${f} is too long (max ${MAX_TEXT} characters).`);
      if (v !== (user[f] || '')) { user[f] = v; changed.push(f); }
    }
    if (b.emergencyContactPhone !== undefined) {
      const raw = String(b.emergencyContactPhone).trim();
      if (raw && !isValidIndianPhone(raw)) throw new HelpError(400, 'Emergency contact phone must be a valid 10-digit mobile number, or empty.');
      const v = raw ? formatIndianPhone(raw) : '';
      if (v !== (user.emergencyContactPhone || '')) { user.emergencyContactPhone = v; changed.push('emergencyContactPhone'); }
    }

    if (!changed.length) {
      return res.json({ message: 'No changes to save.', changed, user: publicPatient(user) });
    }
    logEdit(user, req.user._id, changed);
    // A deleted account may still hold the new phone/email; move it aside.
    await releaseFromDeletedAccounts({
      phone: changed.includes('phone') ? user.phone : null,
      email: changed.includes('email') ? user.email : null,
      selfId: user._id,
    });
    await user.save({ validateModifiedOnly: true });
    res.json({ message: `Saved ${changed.length} change${changed.length === 1 ? '' : 's'} for "${user.name}".`, changed, user: publicPatient(user) });
  } catch (error) {
    sendError(res, error, 'Updating patient details');
  }
};

// ============================================
// Family members — same rules as the patient's own Family tab
// ============================================
const addPatientFamilyMember = async (req, res) => {
  try {
    const user = await loadPatient(req.params.id);
    const member = addMember(user, req.body);
    logEdit(user, req.user._id, ['familyMembers']);
    await user.save();
    res.status(201).json({ message: `Added ${member.name}.`, familyMember: member, familyMembers: user.familyMembers });
  } catch (error) {
    sendError(res, error, 'Adding family member');
  }
};

const updatePatientFamilyMember = async (req, res) => {
  try {
    const user = await loadPatient(req.params.id);
    const member = updateMember(user, req.params.memberId, req.body);
    logEdit(user, req.user._id, ['familyMembers']);
    await user.save();
    res.json({ message: `Updated ${member.name}.`, familyMember: member, familyMembers: user.familyMembers });
  } catch (error) {
    sendError(res, error, 'Updating family member');
  }
};

const deletePatientFamilyMember = async (req, res) => {
  try {
    const user = await loadPatient(req.params.id);
    removeMember(user, req.params.memberId);
    logEdit(user, req.user._id, ['familyMembers']);
    await user.save();
    res.json({ message: 'Family member removed.', familyMembers: user.familyMembers });
  } catch (error) {
    sendError(res, error, 'Removing family member');
  }
};

// ============================================
// POST /api/admin/patients/:id/appointments — book on the patient's behalf
// ============================================
// Body: { doctorId, date, timeSlot, reason, consultationType, symptoms,
//         bookedFor, familyMemberName, consentConfirmed: true }
const bookForPatient = async (req, res) => {
  try {
    const user = await loadPatient(req.params.id);
    if (user.isSuspended) throw new HelpError(400, 'This account is deactivated. Reactivate it before booking.');
    const b = req.body || {};
    if (b.consentConfirmed !== true) {
      throw new HelpError(400, 'Please confirm the patient agreed (on a call or WhatsApp) to the Terms and teleconsultation consent.');
    }
    // Admin bookings must name a family member that actually exists
    // (createBooking checks this too; this gives the admin a clearer message).
    if (b.bookedFor === 'family') {
      const name = String(b.familyMemberName || '').trim().toLowerCase();
      const member = (user.familyMembers || []).find((m) => m.name.trim().toLowerCase() === name);
      if (!member) throw new HelpError(400, 'Choose one of the patient\'s family members (add them in the Family tab first).');
      b.familyMemberName = member.name;
    }

    const { appointment, doctor } = await createBooking({
      patientId: user._id,
      body: {
        doctorId: b.doctorId, date: b.date, timeSlot: b.timeSlot, reason: b.reason,
        consultationType: b.consultationType, symptoms: b.symptoms,
        bookedFor: b.bookedFor === 'family' ? 'family' : 'self', familyMemberName: b.familyMemberName,
        consentGiven: true, // the admin confirmed the patient's verbal consent (checked above)
      },
      consentIP: clientIP(req),
      consentBy: 'admin',
      bookedByAdmin: req.user._id,
    });

    const when = `${new Date(appointment.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} at ${appointment.timeSlot}`;
    // Tell the patient (patients get no booking message otherwise).
    sendPushToUser(user._id, {
      title: 'Appointment booked for you',
      body: `ProMedicoz support booked your appointment with Dr. ${doctor.name} on ${when}. The doctor will confirm it.`,
      url: '/dashboard',
      tag: `appointment-${appointment._id}`
    });

    require('../utils/live').appointmentChanged(req, appointment);
    res.status(201).json({
      message: `Booked with Dr. ${doctor.name} on ${when} for ${b.bookedFor === 'family' ? b.familyMemberName : user.name}. Waiting for the doctor to confirm.`,
      appointment,
      patient: { _id: user._id, name: user.name, phone: user.phone },
      when,
    });
  } catch (error) {
    sendError(res, error, 'Booking for patient');
  }
};

// ============================================
// POST /api/admin/patients — create an account for someone who can't register
// ============================================
// Body: { name, phone, email?, consentConfirmed: true }
const createPatient = async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) throw new HelpError(400, 'Name is required.');
    if (name.length > 100) throw new HelpError(400, 'Name is too long.');
    if (b.consentConfirmed !== true) {
      throw new HelpError(400, 'Please confirm the patient agreed (on a call or WhatsApp) to the Terms & Privacy Policy.');
    }
    const phone = await checkPhone(b.phone);
    const email = await checkEmail(b.email);

    // A DELETED account still holding this phone/email: move it out of the
    // way (same as self-registration does), keeping its records.
    const deletedByPhone = await User.findOne({ phone, isDeleted: true });
    if (deletedByPhone) {
      deletedByPhone.phone = `deleted_${Date.now()}_${deletedByPhone.phone}`;
      await deletedByPhone.save({ validateModifiedOnly: true });
    }

    const user = await User.create({
      name,
      email: email || undefined,
      phone,
      // Random password nobody knows; the patient sets their own via the link.
      password: crypto.randomBytes(24).toString('hex'),
      role: 'patient',
      isVerified: true,
      consentAcceptedAt: new Date(),
      lastLoginIP: '',
      createdByAdmin: req.user._id,
    });
    const seq = await getNextSequence('patientId');
    user.patientId = `PT${String(seq).padStart(6, '0')}`;

    // "Set your password" link (uses the normal reset-password page).
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpire = Date.now() + SET_PASSWORD_HOURS * 60 * 60 * 1000;
    logEdit(user, req.user._id, ['account created']);
    await user.save({ validateBeforeSave: false });
    const setPasswordUrl = `https://www.promedicoz.in/reset-password/${token}`;

    let emailed = false;
    if (email) {
      const result = await sendEmail({
        to: email,
        subject: 'Your ProMedicoz account is ready',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">🏥 ProMedicoz</h1>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <p style="color: #4b5563;">Hi ${name.replace(/[<>&]/g, '')},</p>
              <p style="color: #4b5563;">Our support team created your ProMedicoz account, as you asked. You'll log in with your mobile number. Please set your password:</p>
              <a href="${setPasswordUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">Set my password</a>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">This link expires in ${SET_PASSWORD_HOURS} hours.</p>
            </div>
          </div>`
      });
      emailed = !!(result && result.success);
    }

    res.status(201).json({
      message: `Created an account for "${name}" (${user.patientId}).`,
      user: publicPatient(user),
      setPasswordUrl,
      expiresInHours: SET_PASSWORD_HOURS,
      emailed,
    });
  } catch (error) {
    sendError(res, error, 'Creating patient');
  }
};

module.exports = {
  updatePatientDetails,
  addPatientFamilyMember,
  updatePatientFamilyMember,
  deletePatientFamilyMember,
  bookForPatient,
  createPatient,
};
