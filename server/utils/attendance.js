// ============================================
// "Did the patient come?" — so visits actually get marked complete
// ============================================
// Everything after a visit (the patient's "rate your doctor" request, the
// "X consultations" count, free follow-ups) waits for the visit to be
// COMPLETED — and no doctor ever tapped "Mark Complete" (0 of all visits).
// So, for confirmed visits whose slot has ended (last 14 days only, so old
// visits don't flood patients with rating requests):
//   1. Video/phone and the DOCTOR joined the call (a CallLog exists):
//      complete automatically 1 hour after the slot ends.
//   2. Otherwise ask the doctor once (push, daytime): "Did these patients
//      come? ✅ / ✗" — the dashboard shows the same list.
//   3. No answer after 3 days and the visit was PAID: complete it.
//      (Unpaid + no call → left alone; it probably didn't happen.)
// Pure planner tested in tests/attendance.test.js.

const { slotWindowMs } = require('./slots');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const LOOKBACK_MS = 14 * DAY;
const CALL_GRACE_MS = 1 * HOUR;
const TIMEOUT_MS = 3 * DAY;

// What to do with one confirmed appointment right now:
// 'complete-call' | 'complete-timeout' | 'ask' | 'wait' | 'ignore'
function attendanceAction(apt, now, { doctorJoinedCall = false } = {}) {
  if (!apt || apt.status !== 'confirmed' || apt.noShow) return 'ignore';
  const w = slotWindowMs(apt.date, apt.timeSlot);
  if (!w) return 'ignore';
  if (now < w.end) return 'wait';
  if (now - w.end > LOOKBACK_MS) return 'ignore';
  if (doctorJoinedCall && apt.consultationType !== 'in-person' && now >= w.end + CALL_GRACE_MS) return 'complete-call';
  if (now >= w.end + TIMEOUT_MS && apt.paymentStatus === 'paid') return 'complete-timeout';
  if (doctorJoinedCall && apt.consultationType !== 'in-person') return 'wait'; // completes within the hour
  return 'ask';
}

// Ask only during the day (IST 9 AM – 9 PM).
function isDaytimeIST(now) {
  const h = Number(new Date(now).toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' })) % 24;
  return h >= 9 && h < 21;
}

async function completeAuto(apt, by, now) {
  apt.status = 'completed';
  apt.completedAt = new Date(now);
  apt.completedBy = by;
  await apt.save({ validateModifiedOnly: true });
  try { require('./live').appointmentChanged(null, apt, { status: 'completed' }); } catch { /* live update is a nicety */ }
}

let running = false;
async function runAttendance(now = Date.now()) {
  if (running) return { skipped: true };
  running = true;
  const out = { completedCall: 0, completedTimeout: 0, asked: 0 };
  try {
    const Appointment = require('../models/Appointment');
    const CallLog = require('../models/CallLog');
    const apts = await Appointment.find({
      status: 'confirmed',
      noShow: { $ne: true },
      date: { $gte: new Date(now - LOOKBACK_MS - DAY), $lte: new Date(now + DAY) },
    }).select('doctor patient date timeSlot status consultationType paymentStatus noShow attendanceNudgedAt');
    if (!apts.length) return out;
    const joined = new Set((await CallLog.distinct('appointment', { appointment: { $in: apts.map((a) => a._id) } })).map(String));
    const toAsk = new Map(); // doctorId → [apt]
    for (const apt of apts) {
      const action = attendanceAction(apt, now, { doctorJoinedCall: joined.has(String(apt._id)) });
      if (action === 'complete-call') { await completeAuto(apt, 'auto-call', now); out.completedCall += 1; }
      else if (action === 'complete-timeout') { await completeAuto(apt, 'auto-3days', now); out.completedTimeout += 1; }
      else if (action === 'ask' && !apt.attendanceNudgedAt) {
        const k = String(apt.doctor);
        toAsk.set(k, [...(toAsk.get(k) || []), apt]);
      }
    }
    if (toAsk.size && isDaytimeIST(now)) {
      const { sendPushToUser } = require('./push');
      const User = require('../models/User');
      for (const [doctorId, list] of toAsk) {
        const patients = await User.find({ _id: { $in: list.map((a) => a.patient) } }).select('name').lean();
        const names = patients.map((p) => (p.name || '').split(' ')[0]).filter(Boolean);
        const who = names.length ? `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}` : `${list.length} patient${list.length > 1 ? 's' : ''}`;
        await sendPushToUser(doctorId, {
          title: list.length === 1 ? 'Did your patient come?' : 'Did your patients come?',
          body: `${who}: tap ✅ Came or ✗ Didn't come. Patients who came are asked to rate the visit.`,
          url: '/dashboard?attendance=1',
          tag: `attendance-${doctorId}`,
        });
        await Appointment.updateMany({ _id: { $in: list.map((a) => a._id) } }, { $set: { attendanceNudgedAt: new Date(now) } });
        out.asked += list.length;
      }
    }
    return out;
  } finally {
    running = false;
  }
}

module.exports = { attendanceAction, isDaytimeIST, runAttendance, LOOKBACK_MS, TIMEOUT_MS };
