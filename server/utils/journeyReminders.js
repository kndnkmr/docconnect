// ============================================
// Journey reminders — nudge the right person before a patient gets stuck
// ============================================
// Runs every 10 minutes from server.js. Each reminder fires once per
// appointment (flag on the appointment; reschedule resets them).
//
//   Doctor: booking still PENDING 3h after it was made, or within 4h of the
//           slot, whichever comes first (and at least 30 min after booking,
//           since the doctor was just notified of the new booking).
//   Patient: CONFIRMED, payment NOT started, not a free follow-up, slot
//           starts within 2h.
// (Payment-confirmation reminders live in utils/paymentFollowUp.js.)
// Doctor pushes stay generic — no patient names on a lock screen.

const Appointment = require('../models/Appointment');
const { sendPushToUser } = require('./push');
const { slotWindowMs } = require('./slots');

const H = 60 * 60 * 1000;
const CONFIRM_AFTER_BOOKING_MS = 3 * H;
const CONFIRM_BEFORE_SLOT_MS = 4 * H;
const MIN_BOOKING_AGE_MS = 30 * 60 * 1000;
const PAY_BEFORE_SLOT_MS = 2 * H;
const DAY = 24 * H;

const label = (apt) =>
  `${new Date(apt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${(apt.timeSlot || '').split(' - ')[0]}`;

// Should the doctor be reminded to confirm this pending booking now?
function needsConfirmReminder(apt, now) {
  if (apt.status !== 'pending' || apt.confirmReminderSentAt) return false;
  const w = slotWindowMs(apt.date, apt.timeSlot);
  if (!w || w.start <= now) return false;                       // slot already started
  const age = now - new Date(apt.createdAt).getTime();
  if (age < MIN_BOOKING_AGE_MS) return false;
  return age >= CONFIRM_AFTER_BOOKING_MS || w.start - now <= CONFIRM_BEFORE_SLOT_MS;
}

// Should the patient be reminded to pay now?
function needsPayReminder(apt, now) {
  if (apt.status !== 'confirmed' || apt.payReminderSentAt || apt.isFollowUp) return false;
  if ((apt.paymentStatus || 'pending') !== 'pending') return false;
  const w = slotWindowMs(apt.date, apt.timeSlot);
  if (!w || w.start <= now) return false;
  return w.start - now <= PAY_BEFORE_SLOT_MS;
}

const runJourneyReminders = async (now = Date.now()) => {
  let doctors = 0;
  let patients = 0;
  try {
    // Pending bookings with a slot from today up to a month ahead.
    const pending = await Appointment.find({
      status: 'pending',
      confirmReminderSentAt: null,
      date: { $gte: new Date(now - DAY), $lte: new Date(now + 31 * DAY) },
    }).select('doctor date timeSlot status createdAt confirmReminderSentAt').limit(500);

    for (const apt of pending) {
      if (!needsConfirmReminder(apt, now)) continue;
      sendPushToUser(String(apt.doctor), {
        title: 'Please confirm a booking',
        body: `A patient is waiting for you to confirm their appointment on ${label(apt)}. Open ProMedicoz to confirm.`,
        url: '/dashboard',
        tag: `confirm-${apt._id}`,
      });
      await Appointment.updateOne({ _id: apt._id }, { $set: { confirmReminderSentAt: new Date(now) } });
      doctors += 1;
    }

    // Confirmed + unpaid with a slot in the next ~2 days (exact check below).
    const unpaid = await Appointment.find({
      status: 'confirmed',
      paymentStatus: { $in: ['pending', null] },
      isFollowUp: { $ne: true },
      payReminderSentAt: null,
      date: { $gte: new Date(now - DAY), $lte: new Date(now + 2 * DAY) },
    }).select('patient date timeSlot status paymentStatus isFollowUp payReminderSentAt').limit(500);

    for (const apt of unpaid) {
      if (!needsPayReminder(apt, now)) continue;
      sendPushToUser(String(apt.patient), {
        title: 'Payment pending for your appointment',
        body: `Your appointment on ${label(apt)} starts soon. Please complete the payment from your dashboard so the doctor can start on time.`,
        url: '/dashboard',
        tag: `pay-${apt._id}`,
      });
      await Appointment.updateOne({ _id: apt._id }, { $set: { payReminderSentAt: new Date(now) } });
      patients += 1;
    }
  } catch (error) {
    console.error('[journey-reminders] Error:', error.message);
  }
  return { doctors, patients };
};

module.exports = { runJourneyReminders, needsConfirmReminder, needsPayReminder };
