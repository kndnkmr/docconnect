// ============================================
// Prescription nudge: one push to the doctor if a completed visit still has no
// prescription 2 hours later (daytime IST only, once per visit).
// ============================================
// Runs every 10 min from server.js. Visits the doctor marked "no prescription
// needed" are skipped. One push per doctor lists how many are waiting.
const Appointment = require('../models/Appointment');
const { dueFor } = require('../controllers/prescriptionFollowUpController');
const { isDaytimeIST } = require('./attendance');
const { sendPushToUser } = require('./push');
const H = 3600 * 1000;
// Pure: which of these (completed, no prescription) should be nudged now?
function toNudge(apts, now) {
  return apts.filter((a) => !a.rxNudgedAt && a.completedAt
    && now - new Date(a.completedAt).getTime() >= 2 * H
    && now - new Date(a.completedAt).getTime() <= 24 * H);
}
async function runPrescriptionNudge(now = Date.now()) {
  let doctors = 0;
  try {
    if (!isDaytimeIST(now)) return { doctors };
    const candidates = await Appointment.find({
      status: 'completed', rxNotNeeded: { $ne: true }, rxNudgedAt: null, isFollowUp: { $ne: true },
      completedAt: { $gte: new Date(now - 24 * H), $lte: new Date(now - 2 * H) },
    }).select('doctor completedAt rxNudgedAt').limit(500);
    const byDoctor = new Map();
    for (const a of toNudge(candidates, now)) byDoctor.set(String(a.doctor), [...(byDoctor.get(String(a.doctor)) || []), a._id]);
    for (const [doctorId, ids] of byDoctor) {
      const waiting = (await dueFor(doctorId, now, 2)).filter((a) => ids.some((i) => String(i) === String(a._id)));
      if (waiting.length) {
        await sendPushToUser(doctorId, {
          title: waiting.length === 1 ? 'A patient is waiting for a prescription' : `${waiting.length} patients are waiting for a prescription`,
          body: 'Tap to write it. It only takes a minute.',
          url: '/dashboard',
          tag: `rx-due-${doctorId}`,
        });
        doctors += 1;
      }
      await Appointment.updateMany({ _id: { $in: ids } }, { $set: { rxNudgedAt: new Date(now) } });
    }
  } catch (e) {
    console.error('[rx-nudge] error:', e.message);
  }
  return { doctors };
}
module.exports = { runPrescriptionNudge, toNudge };
