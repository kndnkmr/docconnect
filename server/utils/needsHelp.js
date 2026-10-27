// ============================================
// Needs help — patients who may be stuck (Admin → 🚨 Needs help)
// ============================================
// Built live on each request from a few bounded queries. Groups:
//   notConfirmed     pending, slot not started, and (booked 3h+ ago or slot within 4h)
//   paymentWaiting   patient says paid, doctor hasn't confirmed for 3h+
//   unpaidSoon       confirmed, payment not started, slot within 2h (not follow-ups)
//   slotPassedOpen   slot ended 2h+ ago (last 30 days) but still pending/confirmed
//   paidCancelled    cancelled after being paid / claimed (last 60 days), refund not checked
//   noPhone          patient accounts with no mobile number
// The automatic reminders (journeyReminders.js, paymentFollowUp.js) usually
// fire first; this list is for what's left.

const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { slotWindowMs } = require('./slots');

const H = 60 * 60 * 1000;
const DAY = 24 * H;
const LIMIT = 100;

const DOCTOR_FIELDS = 'name specialization phone consultationFee';
const PATIENT_FIELDS = 'name email phone patientId';

const withPeople = (query) => query
  .populate('doctor', DOCTOR_FIELDS)
  .populate('patient', PATIENT_FIELDS)
  .limit(LIMIT);

// Pure: sort candidate appointments into groups (unit-tested).
function classify(appointments, now) {
  const groups = { notConfirmed: [], paymentWaiting: [], unpaidSoon: [], slotPassedOpen: [], paidCancelled: [] };
  for (const apt of appointments) {
    const w = slotWindowMs(apt.date, apt.timeSlot);
    const pay = apt.paymentStatus || 'pending';

    if (apt.status === 'cancelled') {
      if ((pay === 'paid' || pay === 'patient_claimed') && !apt.refundCheckedAt) groups.paidCancelled.push(apt);
      continue;
    }
    if (!['pending', 'confirmed', 'completed'].includes(apt.status)) continue;

    // Slot over (2h+ ago) but nobody closed it.
    if (w && ['pending', 'confirmed'].includes(apt.status) && w.end <= now - 2 * H) {
      groups.slotPassedOpen.push(apt);
      continue;
    }
    if (pay === 'patient_claimed') {
      const since = new Date(apt.paymentClaimedAt || apt.updatedAt).getTime();
      if (now - since >= 3 * H) groups.paymentWaiting.push(apt);
      continue;
    }
    if (!w || w.start <= now) continue;
    if (apt.status === 'pending') {
      const age = now - new Date(apt.createdAt).getTime();
      if (age >= 3 * H || w.start - now <= 4 * H) groups.notConfirmed.push(apt);
    } else if (apt.status === 'confirmed' && pay === 'pending' && !apt.isFollowUp && w.start - now <= 2 * H) {
      groups.unpaidSoon.push(apt);
    }
  }
  // Most urgent first.
  const startOf = (a) => (slotWindowMs(a.date, a.timeSlot) || { start: 0 }).start;
  groups.notConfirmed.sort((a, b) => startOf(a) - startOf(b));
  groups.unpaidSoon.sort((a, b) => startOf(a) - startOf(b));
  groups.paymentWaiting.sort((a, b) => new Date(a.paymentClaimedAt || a.updatedAt) - new Date(b.paymentClaimedAt || b.updatedAt));
  groups.slotPassedOpen.sort((a, b) => startOf(b) - startOf(a));
  return groups;
}

async function buildNeedsHelp(now = Date.now()) {
  const [open, claimed, cancelled, noPhone] = await Promise.all([
    // Open appointments from 30 days ago to a month ahead.
    withPeople(Appointment.find({
      status: { $in: ['pending', 'confirmed'] },
      paymentStatus: { $ne: 'patient_claimed' },
      date: { $gte: new Date(now - 31 * DAY), $lte: new Date(now + 31 * DAY) },
    }).sort({ date: 1 })),
    // Payment claims (any date) still waiting.
    withPeople(Appointment.find({ paymentStatus: 'patient_claimed', status: { $ne: 'cancelled' } }).sort({ updatedAt: 1 })),
    // Paid/claimed then cancelled, recently.
    withPeople(Appointment.find({
      status: 'cancelled',
      paymentStatus: { $in: ['paid', 'patient_claimed'] },
      refundCheckedAt: null,
      updatedAt: { $gte: new Date(now - 60 * DAY) },
    }).sort({ updatedAt: -1 })),
    User.find({
      role: 'patient',
      isDeleted: { $ne: true },
      $or: [{ phone: { $exists: false } }, { phone: null }, { phone: '' }],
    }).select('name email patientId createdAt').sort({ createdAt: -1 }).limit(LIMIT),
  ]);

  const groups = classify([...open, ...claimed, ...cancelled], now);
  groups.noPhone = noPhone;
  const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { groups, counts, total, generatedAt: new Date(now) };
}

module.exports = { buildNeedsHelp, classify };
