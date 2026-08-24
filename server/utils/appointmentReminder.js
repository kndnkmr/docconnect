// ============================================
// Appointment Reminder - "your appointment is coming up" (~1 hour before)
// ============================================
// Reduces no-shows: without this, a confirmed appointment arrives with no
// nudge at all unless the patient happens to open the dashboard. This job
// watches the clock and, ~1 hour before a confirmed appointment's slot
// starts, pushes a friendly reminder to BOTH the patient and the doctor —
// works even when the app isn't open (web push, no SMS/email cost).
//
// This is the EARLIER "get ready" nudge. It complements the at-slot-start
// call reminder in callReminder.js (which fires when a video/phone slot
// actually begins). Different timing, different dedupe flag (reminderSentAt
// vs callReminderSentAt), so the two never interfere.
//
// Applies to ALL consultation types (an in-person reminder is just as useful
// as a video one). Fires once per appointment; the reminderSentAt flag makes
// it idempotent, exactly like the call reminder.

const Appointment = require('../models/Appointment');
const { sendPushToUser } = require('./push');

// How long before the slot to remind, and the catch window. The job runs
// every minute, so a 5-minute window means the reminder fires once when we're
// between 60 and 55 minutes before the slot start.
const REMIND_BEFORE_MINUTES = 60;
const CATCH_WINDOW_MINUTES = 5;

function istNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  let h = 0, m = 0;
  for (const p of parts) {
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') m = parseInt(p.value, 10);
  }
  if (h === 24) h = 0;
  return h * 60 + m;
}

function istDateStr(d) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function parseSlotMinutes(str) {
  if (!str) return null;
  const m = str.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

const sendAppointmentReminders = async () => {
  try {
    const todayStr = istDateStr(new Date());
    const nowMin = istNowMinutes();

    // Broad DB-level range first (bounds the scan regardless of timezone-
    // boundary edge cases), then the exact IST calendar-day + slot-time check
    // happens per-document below. Same shape as callReminder.js.
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const candidates = await Appointment.find({
      status: 'confirmed',
      reminderSentAt: null,
      date: { $gte: new Date(now.getTime() - oneDayMs), $lte: new Date(now.getTime() + oneDayMs) }
    })
      .select('doctor patient date timeSlot consultationType')
      .populate('doctor', 'name');

    for (const apt of candidates) {
      if (istDateStr(apt.date) !== todayStr) continue; // not today in IST

      const parts = (apt.timeSlot || '').split('-').map((s) => s.trim());
      const start = parseSlotMinutes(parts[0]);
      if (start == null) continue; // can't parse the slot — skip safely

      const remindAt = start - REMIND_BEFORE_MINUTES;
      // Fire once in the window [remindAt, remindAt + CATCH_WINDOW]. Guard the
      // lower bound too, so if the server starts up late (after the window has
      // already passed) we don't fire a stale reminder for a slot about to
      // start anyway — the at-start call reminder handles that case.
      if (nowMin >= remindAt && nowMin <= remindAt + CATCH_WINDOW_MINUTES) {
        const doctorName = apt.doctor && apt.doctor.name ? `Dr. ${apt.doctor.name}` : 'your doctor';
        const modeText = apt.consultationType === 'video'
          ? 'video consultation'
          : apt.consultationType === 'phone'
            ? 'phone consultation'
            : 'appointment';

        // Patient-facing: names the doctor.
        sendPushToUser(apt.patient, {
          title: 'Appointment reminder',
          body: `Your ${modeText} with ${doctorName} is at ${parts[0]} (in about an hour).`,
          url: '/dashboard',
          tag: `appt-reminder-${apt._id}`
        });

        // Doctor-facing: generic (doesn't leak the patient's name in the push).
        sendPushToUser(apt.doctor && apt.doctor._id ? apt.doctor._id : apt.doctor, {
          title: 'Upcoming appointment',
          body: `You have an ${modeText} at ${parts[0]} (in about an hour).`,
          url: '/dashboard',
          tag: `appt-reminder-doc-${apt._id}`
        });

        apt.reminderSentAt = new Date();
        await apt.save({ validateBeforeSave: false });
      }
    }
  } catch (error) {
    console.error('[appointment-reminder] Error sending reminders:', error.message);
  }
};

module.exports = { sendAppointmentReminders };
