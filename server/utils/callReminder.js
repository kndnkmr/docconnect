// ============================================
// Call alarm — make sure nobody misses a video/phone appointment
// ============================================
// For CONFIRMED + PAID video/phone appointments (runs every 20 s from server.js):
//
//   −10 min   "Starting in 10 min"              (once, both people)
//    0 min    📞 RING: alarm-style push         (both people)
//   +40 s     ring again                        } up to 3 rings in total,
//   +80 s     ring again                        } stops as soon as either
//                                                  side joins the call
//   "In 5 min" on the notification snoozes that one person; they're rung
//   again 5 min later (if nobody has joined and the slot isn't over).
//
// "Alarm-style" = kind:'call' in the payload: the service worker
// (client/public/sw.js) keeps it on screen until tapped, vibrates in a long
// pattern, re-alerts on every ring (renotify) and shows Join now / In 5 min.
// Sent with high urgency + short TTL so phones deliver it immediately.
// The open Dashboard also rings on its own (clock-based) — see Dashboard.jsx.
//
// Doctor-facing text stays generic (no patient name on a lock screen),
// same as the other doctor pushes.

const Appointment = require('../models/Appointment');
const { sendPushToUser, RING_PUSH_OPTS } = require('./push');
const { slotWindowMs } = require('./slots');
const { makeRingToken, snoozeUrl } = require('./ringToken');

const MIN = 60 * 1000;
const PRE_ALERT_BEFORE_MS = 10 * MIN;
const PRE_ALERT_LATEST_MS = 6 * MIN;   // don't send "in 10 min" if it's already only 5 away
const MAX_RINGS = 3;
const RING_GAP_MS = 40 * 1000;
const RING_WINDOW_MS = 5 * MIN;        // first ring must start within 5 min of slot start
const SNOOZE_MS = 5 * MIN;

const startLabel = (apt) => (apt.timeSlot || '').split(' - ')[0];
const kindLabel = (apt) => (apt.consultationType === 'video' ? 'video' : 'audio');

// Pure: what should happen for this appointment right now?
// Returns { preAlert, ring, snoozed: [userIds], joined }.
function planFor(apt, now) {
  const w = slotWindowMs(apt.date, apt.timeSlot);
  const out = { preAlert: false, ring: false, snoozed: [], joined: false };
  if (!w) return out;
  const joined = !!(apt.callStartedAt && new Date(apt.callStartedAt).getTime() >= w.start - 15 * MIN);
  out.joined = joined;

  if (!apt.callPreAlertSentAt && now >= w.start - PRE_ALERT_BEFORE_MS && now <= w.start - PRE_ALERT_LATEST_MS) {
    out.preAlert = true;
  }
  if (joined || now > w.end) return out;

  const count = apt.callRingCount || 0;
  const last = apt.callLastRingAt ? new Date(apt.callLastRingAt).getTime() : 0;
  if (now >= w.start && count < MAX_RINGS) {
    const firstRingOk = count > 0 || now <= w.start + RING_WINDOW_MS;
    if (firstRingOk && (!last || now - last >= RING_GAP_MS)) out.ring = true;
  }
  out.snoozed = (apt.ringSnoozes || [])
    .filter((s) => s && s.at && new Date(s.at).getTime() <= now)
    .map((s) => String(s.user));
  return out;
}

function ringPayload(apt, forDoctor, userId, w) {
  const id = String(apt._id);
  const url = snoozeUrl();
  const doctorName = apt.doctor && apt.doctor.name ? apt.doctor.name : '';
  return {
    kind: 'call',
    appointmentId: id,
    title: `📞 Your ${kindLabel(apt)} consultation is starting`,
    body: forDoctor
      ? `Your ${startLabel(apt)} appointment is starting now. Tap Join now.`
      : `${doctorName ? `Dr. ${doctorName}` : 'Your doctor'} · ${startLabel(apt)}. Tap Join now.`,
    url: `/dashboard?join=${id}`,
    tag: `call-start-${id}`,
    snoozeUrl: url || undefined,
    snoozeToken: url ? makeRingToken(id, userId, w.end) : undefined,
  };
}

const sendCallStartReminders = async (now = Date.now()) => {
  const sent = { preAlerts: 0, rings: 0, snoozeRings: 0 };
  try {
    const day = 24 * 60 * MIN;
    const candidates = await Appointment.find({
      status: 'confirmed',
      paymentStatus: 'paid',
      consultationType: { $in: ['video', 'phone'] },
      date: { $gte: new Date(now - day), $lte: new Date(now + day) },
      $or: [
        { callPreAlertSentAt: null },
        { callRingCount: { $lt: MAX_RINGS } },
        { 'ringSnoozes.0': { $exists: true } },
      ],
    })
      .select('doctor patient date timeSlot consultationType callStartedAt callPreAlertSentAt callRingCount callLastRingAt ringSnoozes')
      .populate('doctor', 'name')
      .limit(500);

    for (const apt of candidates) {
      const w = slotWindowMs(apt.date, apt.timeSlot);
      if (!w) continue;
      const plan = planFor(apt, now);
      const doctorId = String(apt.doctor && apt.doctor._id ? apt.doctor._id : apt.doctor);
      const patientId = String(apt.patient);
      const set = {};

      if (plan.preAlert) {
        const base = { url: '/dashboard', tag: `call-soon-${apt._id}` };
        sendPushToUser(patientId, {
          ...base,
          title: `⏰ Your ${kindLabel(apt)} consultation starts in 10 min`,
          body: `${apt.doctor && apt.doctor.name ? `Dr. ${apt.doctor.name}` : 'Your doctor'} at ${startLabel(apt)}. Keep your phone nearby — it will ring.`,
        }, { urgency: 'high', TTL: 300 });
        sendPushToUser(doctorId, {
          ...base,
          title: `⏰ ${kindLabel(apt) === 'video' ? 'Video' : 'Audio'} consultation in 10 min`,
          body: `Your ${startLabel(apt)} appointment starts soon.`,
        }, { urgency: 'high', TTL: 300 });
        set.callPreAlertSentAt = new Date(now);
        sent.preAlerts += 1;
      }

      if (plan.ring) {
        sendPushToUser(doctorId, ringPayload(apt, true, doctorId, w), RING_PUSH_OPTS);
        sendPushToUser(patientId, ringPayload(apt, false, patientId, w), RING_PUSH_OPTS);
        set.callRingCount = (apt.callRingCount || 0) + 1;
        set.callLastRingAt = new Date(now);
        set.callReminderSentAt = new Date(now); // older field, kept for compatibility
        sent.rings += 1;
      }

      const update = {};
      if (Object.keys(set).length) update.$set = set;

      if (plan.snoozed.length) {
        if (!plan.joined) {
          for (const uid of plan.snoozed) {
            sendPushToUser(uid, ringPayload(apt, uid === doctorId, uid, w), RING_PUSH_OPTS);
            sent.snoozeRings += 1;
          }
        }
        update.$pull = { ringSnoozes: { at: { $lte: new Date(now) } } };
      }
      if (Object.keys(update).length) await Appointment.updateOne({ _id: apt._id }, update);
    }
  } catch (error) {
    console.error('[call-reminder] Error:', error.message);
  }
  return sent;
};

// "In 5 min" from the notification (see controllers/pushController.js snooze).
async function snoozeRing(appointmentId, userId, now = Date.now()) {
  const apt = await Appointment.findById(appointmentId).select('patient doctor date timeSlot status ringSnoozes');
  if (!apt || apt.status !== 'confirmed') return { ok: false, reason: 'not active' };
  const isParty = [String(apt.patient), String(apt.doctor)].includes(String(userId));
  if (!isParty) return { ok: false, reason: 'not a participant' };
  const w = slotWindowMs(apt.date, apt.timeSlot);
  if (!w || now > w.end) return { ok: false, reason: 'slot over' };
  const mine = (apt.ringSnoozes || []).filter((s) => String(s.user) === String(userId)).length;
  if (mine >= 2) return { ok: false, reason: 'already snoozed' };
  const at = new Date(Math.min(now + SNOOZE_MS, w.end - MIN));
  await Appointment.updateOne({ _id: apt._id }, { $push: { ringSnoozes: { user: userId, at } } });
  return { ok: true, at };
}

module.exports = { sendCallStartReminders, snoozeRing, planFor, ringPayload, MAX_RINGS, RING_GAP_MS };
