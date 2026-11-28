// ============================================
// Payment reminders: patients who booked, were confirmed, and did not pay
// ============================================
// Before this, a patient got ONE push, and only when the slot was within 2
// hours (journeyReminders.js). A patient who ignored the "confirmed, please
// pay" message simply stayed unpaid for days.
//
// Ladder, counted from the moment the doctor confirmed:
//   1 hour later, 6 hours later, 24 hours later  (the 2-hours-before-the-slot
//   reminder still exists too). At most 3 here, at least 3 hours apart, only
//   9 AM to 9 PM IST, never for a free visit / follow-up, never once the
//   patient started paying, and not within 30 minutes of the slot.
// After each run that sent any, the admin gets ONE push + ONE email listing
// who was reminded (with phone numbers), so support can follow up on WhatsApp.
// Every reminder is written to the appointment's history.
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { slotWindowMs } = require('./slots');
const { isDaytimeIST } = require('./attendance');
const { sendPushToUser } = require('./push');
const { sendEmail } = require('./sendEmail');
const H = 3600 * 1000;
const STEPS_H = [1, 6, 24];
const MIN_GAP_MS = 3 * H;
const ADMIN_NOTIFY_EMAIL = () => process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL || 'support@promedicoz.in';
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const label = (apt) =>
  `${new Date(apt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${(apt.timeSlot || '').split(' - ')[0]}`;
// Pure: which reminder (1, 2, 3) is due now for this appointment? 0 = none.
function dueReminder(apt, fee, now) {
  if (!apt || apt.status !== 'confirmed' || apt.isFollowUp || apt.confirmedLate) return 0;
  if ((apt.paymentStatus || 'pending') !== 'pending') return 0;
  if (!(Number(fee) > 0)) return 0;
  const count = apt.payRemindCount || 0;
  if (count >= STEPS_H.length) return 0;
  const w = slotWindowMs(apt.date, apt.timeSlot);
  if (!w || w.start - now < 30 * 60000) return 0;
  const base = new Date(apt.confirmedAt || apt.updatedAt || 0).getTime();
  if (!base || now - base < STEPS_H[count] * H) return 0;
  if (apt.payRemindLastAt && now - new Date(apt.payRemindLastAt).getTime() < MIN_GAP_MS) return 0;
  return count + 1;
}
// What the patient reads. Plain words, no threats.
function reminderText(n, apt, doctorName, fee) {
  const when = label(apt);
  if (n === 1) return { title: `Pay Rs. ${fee} to lock your appointment`, body: `Dr. ${doctorName} confirmed your appointment on ${when}. Tap to pay. It takes about a minute.` };
  if (n === 2) return { title: 'Your appointment is waiting for payment', body: `Your slot with Dr. ${doctorName} on ${when} is confirmed but not paid yet. Tap to pay Rs. ${fee}.` };
  return { title: 'Reminder: payment pending', body: `Your appointment with Dr. ${doctorName} on ${when} still needs payment of Rs. ${fee}. Need help? Message ProMedicoz support.` };
}
const eventEntry = (role, n, extra = {}) => ({ at: new Date(), by: null, role, action: 'pay_reminder', note: `Reminder ${n}`, data: { n, ...extra } });
async function notifyAdmins(sent, now) {
  if (!sent.length) return;
  try {
    const admins = await User.find({ role: 'admin', isDeleted: { $ne: true } }).select('_id');
    for (const a of admins) {
      sendPushToUser(String(a._id), {
        title: `💳 ${sent.length} patient${sent.length > 1 ? 's' : ''} reminded to pay`,
        body: 'Payment reminders went out. Open Needs help to follow up on WhatsApp.',
        url: '/admin',
        tag: 'pay-reminders-admin',
      });
    }
  } catch (e) { console.error('[pay-reminders] admin push failed:', e.message); }
  const rows = sent.map((r) => `
    <tr>
      <td style="padding:6px;border-bottom:1px solid #eee">${esc(r.patient)}${r.patientId ? ` (${esc(r.patientId)})` : ''}<br><small>${esc(r.phone || 'no phone')}</small></td>
      <td style="padding:6px;border-bottom:1px solid #eee">Dr. ${esc(r.doctor)}</td>
      <td style="padding:6px;border-bottom:1px solid #eee">${esc(r.when)}<br><small>Rs. ${esc(r.fee)}</small></td>
      <td style="padding:6px;border-bottom:1px solid #eee">#${r.n} of 3${r.channel ? `<br><small>${esc(r.channel)}</small>` : ''}</td>
    </tr>`).join('');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px">
      <h2 style="margin-top:0">${sent.length} patient${sent.length > 1 ? 's were' : ' was'} reminded to pay</h2>
      <p>These appointments are confirmed by the doctor, but the patient has not paid. We sent a reminder to the app. If a patient does not respond, message them on WhatsApp from Admin → <b>Needs help</b> (group "Confirmed, waiting for payment").</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
        <tr style="text-align:left;background:#f3f4f6"><th style="padding:6px">Patient</th><th style="padding:6px">Doctor</th><th style="padding:6px">Appointment</th><th style="padding:6px">Reminder</th></tr>
        ${rows}
      </table>
      <p><a href="https://www.promedicoz.in/admin">Open Admin Dashboard</a></p>
    </div>`;
  Promise.resolve(sendEmail({ to: ADMIN_NOTIFY_EMAIL(), subject: `ProMedicoz: ${sent.length} patient(s) reminded to pay`, html }))
    .catch((e) => console.error('[pay-reminders] admin email failed:', e.message));
}
async function runPayReminders(now = Date.now()) {
  const sent = [];
  try {
    if (!isDaytimeIST(now)) return { sent: 0 };
    const todayStart = new Date(`${new Date(now + 330 * 60000).toISOString().slice(0, 10)}T00:00:00Z`);
    const candidates = await Appointment.find({
      status: 'confirmed',
      paymentStatus: { $in: ['pending', null] },
      isFollowUp: { $ne: true },
      confirmedLate: { $ne: true },
      payRemindCount: { $lt: STEPS_H.length },
      date: { $gte: todayStart },
    })
      .select('-events')
      .populate('doctor', 'name consultationFee')
      .populate('patient', 'name phone email patientId')
      .limit(300);
    for (const apt of candidates) {
      const fee = apt.doctor && apt.doctor.consultationFee;
      const n = dueReminder(apt, fee, now);
      if (!n) continue;
      const doctorName = (apt.doctor && apt.doctor.name) || '';
      const text = reminderText(n, apt, doctorName, fee);
      sendPushToUser(String(apt.patient && apt.patient._id ? apt.patient._id : apt.patient), { ...text, url: `/booking-confirmation?id=${apt._id}`, tag: `pay-ladder-${apt._id}` });
      let channel = 'push';
      if (n >= 2 && apt.patient && apt.patient.email) {
        Promise.resolve(sendEmail({
          to: apt.patient.email,
          subject: text.title,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px"><p>Hi ${esc(apt.patient.name)},</p><p>${esc(text.body)}</p><p><a href="https://www.promedicoz.in/booking-confirmation?id=${apt._id}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Pay Rs. ${esc(fee)} now</a></p><p style="color:#9ca3af;font-size:12px">ProMedicoz</p></div>`,
        })).catch(() => {});
        channel = 'push + email';
      }
      await Appointment.updateOne({ _id: apt._id }, {
        $inc: { payRemindCount: 1 },
        $set: { payRemindLastAt: new Date(now) },
        $push: { events: { $each: [eventEntry('system', n, { channel })], $slice: -80 } },
      });
      sent.push({
        patient: apt.patient && apt.patient.name, patientId: apt.patient && apt.patient.patientId, phone: apt.patient && apt.patient.phone,
        doctor: doctorName, when: label(apt), fee, n, channel,
      });
    }
    await notifyAdmins(sent, now);
  } catch (e) {
    console.error('[pay-reminders] error:', e.message);
  }
  return { sent: sent.length };
}
module.exports = { runPayReminders, dueReminder, reminderText, STEPS_H, MIN_GAP_MS };
