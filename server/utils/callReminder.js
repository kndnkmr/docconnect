// ============================================
// Call Start Reminder - clock-based, not action-based
// ============================================
// Before this existed, the ringing/incoming-call notification only fired
// when one participant manually clicked "Join Call" - if neither doctor nor
// patient remembered to click first, nobody got notified at all, even though
// the appointment time had arrived. This job fixes that by watching the
// clock directly: the moment a confirmed + paid video/phone appointment's
// slot starts, it pushes a "your call is starting" notification to BOTH
// participants, whether or not either of them has done anything yet.
//
// This complements (doesn't replace) the client-side equivalent in
// Dashboard.jsx, which does the same clock check locally for instant local
// feedback (ringtone + banner) while the dashboard is open. This job is what
// reaches people whose dashboard ISN'T open at that moment - same idea as
// the account-cleanup job, just running every minute instead of once a day.
//
// The actual "Join" click still opens the call - this only decides WHEN to
// remind someone it's time, same as a calendar reminder rings you into a
// meeting without silently connecting your camera for you.

const Appointment = require('../models/Appointment');
const { sendPushToUser } = require('./push');

// Fire once, in a short window right at the start of the slot - this is
// meant to feel like "starting now", not a repeated nag for the whole slot
// (the existing 5-min-before/20-min-after grace window is still what
// governs whether the "Join Call" button itself is clickable).
const REMINDER_WINDOW_MINUTES = 3;

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

const sendCallStartReminders = async () => {
  try {
    const todayStr = istDateStr(new Date());
    const nowMin = istNowMinutes();

    // Broad DB-level range first (bounds the scan to "recent" appointments
    // regardless of timezone-boundary edge cases), then the exact IST
    // calendar-day + slot-time check happens per-document below.
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const candidates = await Appointment.find({
      status: 'confirmed',
      paymentStatus: 'paid',
      consultationType: { $in: ['video', 'phone'] },
      callReminderSentAt: null,
      date: { $gte: new Date(now.getTime() - oneDayMs), $lte: new Date(now.getTime() + oneDayMs) }
    }).select('doctor patient date timeSlot consultationType');

    for (const apt of candidates) {
      if (istDateStr(apt.date) !== todayStr) continue; // not today in IST

      const parts = (apt.timeSlot || '').split('-').map((s) => s.trim());
      const start = parseSlotMinutes(parts[0]);
      if (start == null) continue; // can't parse the slot - skip safely

      if (nowMin >= start && nowMin <= start + REMINDER_WINDOW_MINUTES) {
        const kind = apt.consultationType === 'video' ? 'video' : 'audio';
        const payload = {
          title: 'Your appointment is starting',
          body: `Your ${kind} consultation is starting now — tap to join.`,
          url: '/dashboard',
          tag: `call-start-${apt._id}`
        };
        sendPushToUser(apt.doctor, payload);
        sendPushToUser(apt.patient, payload);

        apt.callReminderSentAt = new Date();
        await apt.save({ validateBeforeSave: false });
      }
    }
  } catch (error) {
    console.error('[call-reminder] Error sending call start reminders:', error.message);
  }
};

module.exports = { sendCallStartReminders };
