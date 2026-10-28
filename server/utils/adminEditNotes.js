// ============================================
// Tell doctors what the admin changed on their profile
// ============================================
// Admin → Manage doctor edits are logged on the doctor (User.adminEdits:
// who, when, which fields — never the values). The doctor is told:
//   - AT ONCE for money fields (fee, UPI ID, UPI QR code) — a wrong QR would
//     send patients' money to the wrong place, so it must never go unnoticed;
//   - in ONE daily summary (~7 PM IST) for everything else.
// By push (if they turned notifications on) + email (if they have one).
// The core picks are pure and unit-tested (tests/adminDoctor.test.js).

const LABELS = {
  name: 'name', specialization: 'specialization', qualification: 'qualification',
  medicalRegistrationNo: 'registration no.', experience: 'experience', consultationFee: 'fee',
  bio: 'bio', consultationModes: 'consultation types', languagesSpoken: 'languages',
  city: 'city', clinicAddress: 'clinic address', googleMapsLink: 'Google Maps link',
  googleReviewLink: 'Google review link', phone: 'phone', whatsappNumber: 'WhatsApp number',
  email: 'email', upiId: 'UPI ID', upiQrCode: 'UPI QR code', profilePhoto: 'photo',
  availability: 'weekly hours', slotDuration: 'slot length', blockedDates: 'days off',
  'account created': 'account created',
};
const URGENT = new Set(['consultationFee', 'upiId', 'upiQrCode']);

const label = (f) => LABELS[f] || f;
const isUrgent = (fields) => (fields || []).some((f) => URGENT.has(f));

// Unique, readable list of what changed across entries: "fee, UPI QR code".
function changedList(entries) {
  const seen = [];
  for (const e of entries || []) for (const f of e.fields || []) if (f !== 'account created' && !seen.includes(label(f))) seen.push(label(f));
  return seen;
}

// Is the daily summary due? Once a day after 19:00 IST.
function digestDue(now, lastRunAt) {
  const ist = new Date(now.getTime() + 330 * 60000);
  if (ist.getUTCHours() < 19) return false;
  if (!lastRunAt) return true;
  const lastIst = new Date(lastRunAt.getTime() + 330 * 60000);
  return lastIst.toISOString().slice(0, 10) !== ist.toISOString().slice(0, 10);
}

async function tellDoctor(doctor, items, { urgent }) {
  if (!items.length) return;
  const { sendPushToUser } = require('./push');
  const { sendEmail } = require('./sendEmail');
  const list = items.join(', ');
  const title = urgent ? '⚠️ ProMedicoz updated your payment details' : 'ProMedicoz updated your profile';
  const body = urgent
    ? `Changed: ${list}. Please check it's correct — patients pay using these.`
    : `Changed today: ${list}. Open your profile to see it.`;
  try { await sendPushToUser(doctor._id, { title, body, url: '/dashboard?tab=profile', tag: `admin-edit-${doctor._id}` }); } catch { /* best effort */ }
  if (doctor.email) {
    const safe = (s) => String(s).replace(/[<>&]/g, '');
    await sendEmail({
      to: doctor.email,
      subject: title,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <p style="color:#374151;">Hi Dr. ${safe(doctor.name)},</p>
        <p style="color:#374151;">As you asked, our team updated your ProMedicoz profile. Changed: <strong>${safe(list)}</strong>.</p>
        ${urgent ? '<p style="color:#b45309;"><strong>Please check your payment details are correct</strong> — patients pay you using them.</p>' : ''}
        <a href="https://www.promedicoz.in/dashboard?tab=profile" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open my profile</a>
        <p style="color:#9ca3af;font-size:12px;margin-top:20px;">Something wrong? Reply to this email or message ProMedicoz support.</p>
      </div>`,
    }).catch(() => {});
  }
}

// After an admin edit: money fields → tell now and mark those entries told.
async function notifyNowIfUrgent(doctor) {
  const pending = (doctor.adminEdits || []).filter((e) => !e.notified && isUrgent(e.fields));
  if (!pending.length) return false;
  await tellDoctor(doctor, changedList(pending), { urgent: true });
  for (const e of pending) e.notified = true;
  await doctor.save({ validateModifiedOnly: true });
  return true;
}

// Daily summary of everything not yet told.
let lastDigestAt = null;
async function runAdminEditDigest(now = new Date()) {
  if (!digestDue(now, lastDigestAt)) return { skipped: true };
  lastDigestAt = now;
  const User = require('../models/User');
  const doctors = await User.find({ role: 'doctor', isDeleted: { $ne: true }, adminEdits: { $elemMatch: { notified: false } } })
    .select('name email adminEdits');
  let told = 0;
  for (const d of doctors) {
    const pending = d.adminEdits.filter((e) => !e.notified);
    const items = changedList(pending);
    if (items.length) { await tellDoctor(d, items, { urgent: false }); told += 1; }
    for (const e of pending) e.notified = true;
    await d.save({ validateModifiedOnly: true });
  }
  return { told };
}

module.exports = { LABELS, URGENT, label, isUrgent, changedList, digestDue, notifyNowIfUrgent, runAdminEditDigest };
