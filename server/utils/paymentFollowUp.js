// ============================================
// Payment follow-up — nobody sits on "waiting for payment confirmation"
// ============================================
// When a patient says they've paid (button, screenshot or UTR), the doctor
// has to check their UPI app and tap "Mark Paid". If that doesn't happen:
//   - after 3 hours  → push the doctor once ("payment to check")
//   - after 24 hours → alert ProMedicoz admin once (email + push), so support
//                      can call the doctor or use Admin → Payment help
// Runs every 10 minutes from server.js. Each step fires once per claim (the
// timestamps reset if the patient undoes the claim and claims again).

const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { sendPushToUser } = require('./push');
const { sendEmail } = require('./sendEmail');

const DOCTOR_NUDGE_AFTER_MS = 3 * 60 * 60 * 1000;
const ADMIN_ALERT_AFTER_MS = 24 * 60 * 60 * 1000;
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'support@promedicoz.in';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const when = (apt) =>
  `${new Date(apt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}, ${(apt.timeSlot || '').split(' - ')[0]}`;

// Claimed before `cutoff`. Claims made before this feature existed have no
// paymentClaimedAt; for those, the last update time is the best estimate.
const claimedBefore = (cutoff) => ({
  $or: [
    { paymentClaimedAt: { $ne: null, $lte: new Date(cutoff) } },
    { paymentClaimedAt: null, updatedAt: { $lte: new Date(cutoff) } },
  ],
});

async function nudgeDoctors(now) {
  const due = await Appointment.find({
    paymentStatus: 'patient_claimed',
    status: { $ne: 'cancelled' },
    paymentDoctorNudgedAt: null,
    ...claimedBefore(now - DOCTOR_NUDGE_AFTER_MS),
  }).select('doctor date timeSlot').limit(200);

  for (const apt of due) {
    sendPushToUser(String(apt.doctor), {
      title: 'Payment waiting for your confirmation',
      body: `A patient paid for ${when(apt)} and is waiting. Check your UPI app, then tap "Mark Paid".`,
      url: '/dashboard',
      tag: `payment-${apt._id}`,
    });
    await Appointment.updateOne({ _id: apt._id }, { $set: { paymentDoctorNudgedAt: new Date(now) } });
  }
  return due.length;
}

async function alertAdmin(now) {
  const due = await Appointment.find({
    paymentStatus: 'patient_claimed',
    status: { $ne: 'cancelled' },
    paymentAdminAlertedAt: null,
    ...claimedBefore(now - ADMIN_ALERT_AFTER_MS),
  })
    .select('doctor patient date timeSlot paymentUTR paymentScreenshot paymentClaimedAt')
    .populate('doctor', 'name phone')
    .populate('patient', 'name phone patientId')
    .limit(100);
  if (!due.length) return 0;

  const rows = due.map((a) => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #eee">${esc(a.patient && a.patient.name)} ${a.patient && a.patient.patientId ? `(${esc(a.patient.patientId)})` : ''}<br><small>${esc(a.patient && a.patient.phone)}</small></td>
      <td style="padding:6px;border-bottom:1px solid #eee">Dr. ${esc(a.doctor && a.doctor.name)}<br><small>${esc(a.doctor && a.doctor.phone)}</small></td>
      <td style="padding:6px;border-bottom:1px solid #eee">${esc(when(a))}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${a.paymentScreenshot ? 'Screenshot' : ''}${a.paymentUTR ? ` UTR ${esc(a.paymentUTR)}` : ''}${!a.paymentScreenshot && !a.paymentUTR ? 'No proof' : ''}</td>
    </tr>`).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
      <h2 style="margin-top:0">Payments not confirmed for 24+ hours (${due.length})</h2>
      <p>These patients said they paid, but the doctor hasn't marked the payment as received.
      Please check with the doctor, then use Admin → Appointments → <b>Payment help</b> to mark it paid or reset it.</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <tr style="text-align:left;background:#f3f4f6"><th style="padding:6px">Patient</th><th style="padding:6px">Doctor</th><th style="padding:6px">Appointment</th><th style="padding:6px">Proof</th></tr>
        ${rows}
      </table>
      <p><a href="https://www.promedicoz.in/admin">Open Admin Dashboard</a></p>
    </div>`;

  sendEmail({ to: ADMIN_NOTIFY_EMAIL, subject: `ProMedicoz: ${due.length} payment(s) waiting 24h+ for doctor confirmation`, html })
    .catch((e) => console.error('[payment-follow-up] admin email failed:', e.message));

  const admins = await User.find({ role: 'admin', isDeleted: { $ne: true } }).select('_id');
  for (const admin of admins) {
    sendPushToUser(String(admin._id), {
      title: 'Payments need help',
      body: `${due.length} payment(s) waiting 24h+ for doctor confirmation. Open Admin → Appointments.`,
      url: '/admin',
      tag: 'payment-admin-alert',
    });
  }

  await Appointment.updateMany(
    { _id: { $in: due.map((a) => a._id) } },
    { $set: { paymentAdminAlertedAt: new Date(now) } }
  );
  return due.length;
}

const runPaymentFollowUp = async (now = Date.now()) => {
  try {
    const doctors = await nudgeDoctors(now);
    const admin = await alertAdmin(now);
    return { doctors, admin };
  } catch (error) {
    console.error('[payment-follow-up] Error:', error.message);
    return { doctors: 0, admin: 0 };
  }
};

module.exports = { runPaymentFollowUp, DOCTOR_NUDGE_AFTER_MS, ADMIN_ALERT_AFTER_MS };
