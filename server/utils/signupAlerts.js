// ============================================
// Tell the admin who signed up
// ============================================
// - New DOCTOR → one email at once: each one needs the admin's attention
//   (check their registration no., help them finish their profile).
// - New PATIENTS → one list a day (~7 PM IST, same time as the doctors'
//   summary), so the inbox doesn't fill up. It also says who hasn't booked
//   yet, so the admin can offer help.
// Accounts the admin created themselves are left out (they already know).
// Never throws: an alert must never break sign-up.
// Pure parts are tested in tests/signupAlerts.test.js.

const { digestDue } = require('./adminEditNotes');

const ADMIN_NOTIFY_EMAIL = () => process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'support@promedicoz.in';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const istTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
// Only look this far back, so patients from before this feature (or a long
// outage) never arrive as one huge list.
const LOOKBACK_MS = 72 * 60 * 60 * 1000; // a failed send is retried the next evening

function doctorEmail(doctor) {
  return {
    subject: `ProMedicoz: new doctor signed up — Dr. ${String(doctor.name || '').slice(0, 60)}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color:#1f2937;margin:0 0 12px;">🩺 New doctor joined</h2>
      <p style="color:#374151;margin:4px 0;"><strong>Dr. ${esc(doctor.name)}</strong></p>
      ${doctor.email ? `<p style="color:#4b5563;margin:4px 0;">Email: ${esc(doctor.email)}</p>` : ''}
      ${doctor.phone ? `<p style="color:#4b5563;margin:4px 0;">Phone: ${esc(doctor.phone)}</p>` : ''}
      <p style="color:#4b5563;margin:4px 0;">Joined: ${esc(istTime(doctor.createdAt || Date.now()))}</p>
      <p style="color:#4b5563;margin:12px 0;">They still need to verify their email, fill in their profile, set hours and add a UPI QR before patients can book them.</p>
      <a href="https://www.promedicoz.in/admin" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Admin</a>
    </div>`,
  };
}

// rows: [{ name, patientId, createdAt, booked }]
function patientDigestEmail(rows) {
  const notBooked = rows.filter((r) => !r.booked).length;
  const li = rows.map((r) => `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${esc(r.name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-family:monospace;">${esc(r.patientId || '—')}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${esc(istTime(r.createdAt))}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${r.booked ? '✅ Booked' : '⏳ Not yet'}</td>
    </tr>`).join('');
  return {
    subject: `ProMedicoz: ${rows.length} new patient${rows.length === 1 ? '' : 's'} today${notBooked ? ` (${notBooked} not booked yet)` : ''}`,
    html: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">
      <h2 style="color:#1f2937;margin:0 0 12px;">👋 New patients today</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px;color:#374151;">
        <tr style="background:#f3f4f6;text-align:left;"><th style="padding:6px 8px;">Name</th><th style="padding:6px 8px;">Patient ID</th><th style="padding:6px 8px;">Joined</th><th style="padding:6px 8px;">Booked?</th></tr>
        ${li}
      </table>
      ${notBooked ? '<p style="color:#4b5563;margin-top:12px;">"Not yet" patients may need a hand finding a doctor. Search their Patient ID in Admin → Help patient.</p>' : ''}
      <a href="https://www.promedicoz.in/admin" style="display:inline-block;margin-top:8px;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Admin</a>
    </div>`,
  };
}

// Right after a doctor registers (fire-and-forget from authController).
function notifyAdminNewDoctor(doctor) {
  try {
    const { sendEmail } = require('./sendEmail');
    const { subject, html } = doctorEmail(doctor);
    Promise.resolve(sendEmail({ to: ADMIN_NOTIFY_EMAIL(), subject, html })).catch(() => {});
  } catch { /* never block sign-up */ }
}

// Daily list of new patients (runs every 10 min, acts once after 7 PM IST).
let lastRunAt = null;
async function runPatientSignupDigest(now = new Date()) {
  if (!digestDue(now, lastRunAt)) return { skipped: true };
  lastRunAt = now;
  const User = require('../models/User');
  const Appointment = require('../models/Appointment');
  const fresh = await User.find({
    role: 'patient',
    isDeleted: { $ne: true },
    createdByAdmin: null,
    signupNotifiedAt: { $exists: false },
    createdAt: { $gte: new Date(now.getTime() - LOOKBACK_MS) },
  }).select('name patientId createdAt').sort({ createdAt: 1 }).limit(200).lean();
  if (!fresh.length) return { sent: 0 };
  const bookedIds = new Set((await Appointment.distinct('patient', { patient: { $in: fresh.map((p) => p._id) } })).map(String));
  const rows = fresh.map((p) => ({ ...p, booked: bookedIds.has(String(p._id)) }));
  const { sendEmail } = require('./sendEmail');
  const { subject, html } = patientDigestEmail(rows);
  const res = await sendEmail({ to: ADMIN_NOTIFY_EMAIL(), subject, html });
  // Only mark them if the email went out, so a failed send retries tomorrow.
  if (res && res.success === false) return { sent: 0, failed: true };
  await User.updateMany({ _id: { $in: fresh.map((p) => p._id) } }, { $set: { signupNotifiedAt: now } });
  return { sent: rows.length };
}

module.exports = { doctorEmail, patientDigestEmail, notifyAdminNewDoctor, runPatientSignupDigest, LOOKBACK_MS };
