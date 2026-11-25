// ============================================
// Admin "Investigate": timeline + evidence + track record for one appointment
// ============================================
// Read-only. Never notifies or changes anything, so it is silent.
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Message = require('../models/Message');
const CallLog = require('../models/CallLog');
const { stepsFor } = require('./appointmentSteps');
const ACTION_TEXT = {
  booked: 'Booked the appointment',
  confirmed: 'Confirmed the appointment',
  confirmed_late: 'Confirmed (after the booked time had passed)',
  cancelled: 'Cancelled the appointment',
  declined: 'Declined the request',
  completed: 'Marked the consultation completed',
  rescheduled: 'Picked a new time',
  paid_claimed: 'Said "I have paid"',
  utr_sent: 'Sent the UPI reference (UTR)',
  screenshot_sent: 'Sent a payment screenshot',
  claim_undone: 'Took back "I have paid"',
  reminded_doctor: 'Reminded the doctor about the payment',
  marked_paid: 'Marked the payment as received',
  not_received: 'Said the payment was NOT received',
  admin_marked_paid: 'Marked the payment as paid (admin)',
  admin_reset: 'Reset the payment (admin)',
  admin_confirmed: 'Confirmed the appointment (admin)',
  admin_warned: 'Sent a warning (admin)',
  admin_suspended: 'Suspended the account (admin)',
  admin_note: 'Admin note',
  refund_checked: 'Refund checked (admin)',
};
// Logged events plus the timestamps older appointments already have.
function buildTimeline(apt) {
  const events = (apt.events || []).map((e) => ({
    at: e.at, role: e.role, action: e.action, text: ACTION_TEXT[e.action] || e.action, note: e.note || '', data: e.data || null,
  }));
  const has = (...a) => events.some((e) => a.includes(e.action));
  const add = (at, role, action, extra = {}) => { if (at) events.push({ at, role, action, text: ACTION_TEXT[action] || extra.text || action, note: extra.note || '', data: extra.data || null, derived: true }); };
  if (!has('booked')) add(apt.createdAt, apt.bookedByAdmin ? 'admin' : 'patient', 'booked');
  if (!has('paid_claimed', 'utr_sent', 'screenshot_sent')) add(apt.paymentClaimedAt, 'patient', 'paid_claimed');
  if (!has('reminded_doctor')) add(apt.paymentReminderSentAt, 'patient', 'reminded_doctor');
  if (apt.paymentDoctorNudgedAt) add(apt.paymentDoctorNudgedAt, 'system', 'nudge', { text: 'Doctor reminded automatically to check the payment' });
  if (apt.paymentAdminAlertedAt) add(apt.paymentAdminAlertedAt, 'system', 'nudge2', { text: 'Admin alerted automatically (unverified payment)' });
  if (apt.confirmReminderSentAt) add(apt.confirmReminderSentAt, 'system', 'nudge3', { text: 'Doctor reminded automatically to confirm' });
  if (apt.paidAt && !has('marked_paid', 'admin_marked_paid')) add(apt.paidAt, apt.paymentMarkedByRole || 'doctor', 'marked_paid', { note: apt.paymentAdminNote });
  if (apt.completedAt && !has('completed')) add(apt.completedAt, 'system', 'completed', { text: `Completed (${apt.completedBy || 'doctor'})` });
  if (apt.refundCheckedAt && !has('refund_checked')) add(apt.refundCheckedAt, 'admin', 'refund_checked', { note: apt.refundNote });
  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}
// Screenshots / UTRs that were replaced or removed (kept in the events).
function evidenceHistory(apt) {
  const out = [];
  for (const e of apt.events || []) {
    const d = e.data || {};
    if (['claim_undone', 'admin_reset'].includes(e.action) && (d.utr || d.screenshot)) out.push({ at: e.at, action: e.action, role: e.role, utr: d.utr || '', screenshot: d.screenshot || '' });
    if (e.action === 'screenshot_sent' && d.replaced) out.push({ at: e.at, action: 'replaced', role: e.role, utr: '', screenshot: d.replaced });
  }
  return out;
}
const maskUpi = (upi) => {
  const s = String(upi || '');
  const at = s.indexOf('@');
  if (at < 3) return s ? '***' + s.slice(at) : '';
  return `${s.slice(0, 3)}***${s.slice(at)}`;
};
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
// Plain counts, no judgement. History from the event log starts when it was
// introduced, so older cases show 0 for the event-based numbers.
async function trustSummary(userId, role) {
  const key = role === 'doctor' ? 'doctor' : 'patient';
  const base = { [key]: userId };
  const [user, total, completed, cancelled, claims, paid, notReceived, adminSaidPaid, resets] = await Promise.all([
    User.findById(userId).select('name phone createdAt lastLoginAt isSuspended suspendedReason warnings role'),
    Appointment.countDocuments(base),
    Appointment.countDocuments({ ...base, status: 'completed' }),
    Appointment.countDocuments({ ...base, status: 'cancelled' }),
    Appointment.countDocuments({ ...base, $or: [{ paymentClaimedAt: { $ne: null } }, { 'events.action': 'paid_claimed' }] }),
    Appointment.countDocuments({ ...base, paymentStatus: 'paid', isFollowUp: { $ne: true } }),
    Appointment.countDocuments({ ...base, 'events.action': 'not_received' }),
    Appointment.countDocuments({ ...base, $and: [{ 'events.action': 'not_received' }, { 'events.action': 'admin_marked_paid' }] }),
    Appointment.countDocuments({ ...base, 'events.action': { $in: ['admin_reset', 'claim_undone'] } }),
  ]);
  return {
    name: user && user.name, role: key,
    joined: user && user.createdAt, lastLogin: user && user.lastLoginAt,
    suspended: !!(user && user.isSuspended), suspendedReason: user && user.suspendedReason,
    warnings: ((user && user.warnings) || []).length,
    bookings: total, completed, cancelled,
    paymentClaims: claims, paidBookings: paid,
    notReceivedCases: notReceived,            // cases where the doctor said "not received"
    notReceivedButAdminFoundPaid: adminSaidPaid, // ... and admin later marked it paid
    claimsTakenBackOrReset: resets,
    cancelRatePct: pct(cancelled, total),
  };
}
async function investigate(id) {
  const apt = await Appointment.findById(id)
    .populate('doctor', 'name phone specialization consultationFee upiId city isSuspended')
    .populate('patient', 'name phone email patientId isSuspended');
  if (!apt) return null;
  const doctorId = apt.doctor && apt.doctor._id;
  const patientId = apt.patient && apt.patient._id;
  const [patientTrust, doctorTrust, chatByRole, lastMsg, calls, utrReuse] = await Promise.all([
    patientId ? trustSummary(patientId, 'patient') : null,
    doctorId ? trustSummary(doctorId, 'doctor') : null,
    Message.aggregate([{ $match: { appointment: apt._id } }, { $group: { _id: '$senderRole', n: { $sum: 1 }, last: { $max: '$createdAt' } } }]),
    Message.findOne({ appointment: apt._id }).sort({ createdAt: -1 }).select('senderRole createdAt'),
    CallLog.find({ appointment: apt._id }).select('startedAt endedAt durationSeconds').sort({ startedAt: 1 }).limit(10),
    apt.paymentUTR ? Appointment.countDocuments({ _id: { $ne: apt._id }, paymentUTR: apt.paymentUTR }) : 0,
  ]);
  const chat = { total: chatByRole.reduce((a, c) => a + c.n, 0), byRole: {}, lastAt: lastMsg && lastMsg.createdAt, lastBy: lastMsg && lastMsg.senderRole };
  for (const c of chatByRole) chat.byRole[c._id] = c.n;
  const obj = apt.toObject();
  delete obj.events;
  return {
    appointment: obj,
    steps: stepsFor(apt),
    timeline: buildTimeline(apt),
    evidence: {
      utr: apt.paymentUTR || '', screenshot: apt.paymentScreenshot || '',
      amountAsked: Number(apt.doctor && apt.doctor.consultationFee) || 0,
      amountCollected: apt.amountCollected || 0,
      doctorUpi: maskUpi(apt.doctor && apt.doctor.upiId),
      utrUsedOnOtherBookings: utrReuse,
      history: evidenceHistory(apt),
      disputeNote: apt.paymentDisputeNote || '', disputedAt: apt.paymentDisputedAt || null,
    },
    chat, // counts and times only. Never the message text.
    calls: { alerts: apt.callAlerts || {}, logs: calls },
    trust: { patient: patientTrust, doctor: doctorTrust },
  };
}
module.exports = { investigate, buildTimeline, evidenceHistory, trustSummary, maskUpi, ACTION_TEXT };
