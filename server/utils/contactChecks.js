// ============================================
// Contact checks — one set of rules for phone/email changes
// ============================================
// Used wherever a phone or email is saved after registration:
//   - PUT /api/auth/update-account          (patient/doctor edits own login details)
//   - PUT /api/doctors/profile              (doctor edits own phone/WhatsApp)
//   - Admin → Help patient                  (support edits a patient)
// Registration has its own checks (authController.register).
//
// Phone numbers are not a unique index in the database, and login looks a user
// up by phone, so two active accounts sharing one number would make phone login
// ambiguous. These helpers stop that.

const User = require('../models/User');
const { formatIndianPhone, isValidIndianPhone } = require('./formatPhone');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ContactError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/**
 * Validate + format a phone and make sure no other active account uses it.
 * @param {string} raw
 * @param {object} [opts]
 * @param {*}       [opts.selfId]      the account being edited (its own number is fine)
 * @param {boolean} [opts.revealOwner] admin only: name the clashing account in the message
 * @param {string}  [opts.label]       "Mobile number" / "WhatsApp number" for messages
 * @returns {Promise<string>} formatted "+91XXXXXXXXXX"
 */
async function checkPhone(raw, { selfId = null, revealOwner = false, label = 'Mobile number' } = {}) {
  const value = String(raw || '').trim();
  if (!value) throw new ContactError(400, `${label} is required.`);
  if (!isValidIndianPhone(value)) {
    throw new ContactError(400, 'Please enter a valid 10-digit Indian mobile number (starting 6-9).');
  }
  const formatted = formatIndianPhone(value);
  const query = { phone: formatted, isDeleted: { $ne: true } };
  if (selfId) query._id = { $ne: selfId };
  const clash = await User.findOne(query).select('_id name role');
  if (clash) {
    if (revealOwner) {
      throw new ContactError(400, `That number is already in use by another account (${clash.name}).`, { existingUserId: String(clash._id) });
    }
    // Self-service: don't reveal whose account it is.
    throw new ContactError(400, 'This mobile number is already used by another ProMedicoz account.');
  }
  return formatted;
}

// Format-only check for a number that may legitimately be shared (e.g. a
// clinic WhatsApp line, a family emergency contact). '' clears it.
function checkOptionalPhone(raw, label = 'Phone number') {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (!isValidIndianPhone(value)) {
    throw new ContactError(400, `${label}: please enter a valid 10-digit Indian mobile number (starting 6-9).`);
  }
  return formatIndianPhone(value);
}

/**
 * Email: optional. '' means "no email". Must look like an email and be unused.
 * @returns {Promise<string>} lowercased email, or ''
 */
async function checkEmail(raw, { selfId = null, revealOwner = false } = {}) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  if (value.length > 254 || !EMAIL_RE.test(value)) {
    throw new ContactError(400, 'Please enter a valid email address, or leave it empty.');
  }
  const query = { email: value, isDeleted: { $ne: true } };
  if (selfId) query._id = { $ne: selfId };
  const clash = await User.findOne(query).select('_id name');
  if (clash) {
    throw new ContactError(400, revealOwner
      ? `That email is already in use by another account (${clash.name}).`
      : 'This email is already in use by another account');
  }
  return value;
}

// A DELETED account can still hold a phone/email. Move it out of the way
// (same as registration does) so the new owner's phone login is unambiguous.
// The deleted record itself is kept.
async function releaseFromDeletedAccounts({ phone, email, selfId = null }) {
  const stamp = Date.now();
  const notSelf = selfId ? { _id: { $ne: selfId } } : {};
  if (phone) {
    const holders = await User.find({ phone, isDeleted: true, ...notSelf }).select('_id phone');
    for (const h of holders) {
      await User.updateOne({ _id: h._id }, { $set: { phone: `deleted_${stamp}_${h.phone}` } });
    }
  }
  if (email) {
    const holders = await User.find({ email, isDeleted: true, ...notSelf }).select('_id email');
    for (const h of holders) {
      await User.updateOne({ _id: h._id }, { $set: { email: `deleted_${stamp}_${h.email}` } });
    }
  }
}

module.exports = { ContactError, checkPhone, checkOptionalPhone, checkEmail, releaseFromDeletedAccounts, EMAIL_RE };
