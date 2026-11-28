// ============================================
// After the consultation: who is waiting for a prescription?
// ============================================
//   GET  /api/appointments/prescription-due        (doctor) completed visits, last 14 days, no prescription yet
//   PUT  /api/appointments/:id/no-prescription     (doctor) "no prescription needed" (clears it from the list)
//   PUT  /api/appointments/:id/ask-prescription    (patient) one tap reminds the doctor (once a day)
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const { sendPushToUser } = require('../utils/push');
const { logEvent } = require('../utils/appointmentEvents');
const DAY = 24 * 3600 * 1000;
const ASK_EVERY_MS = DAY;
const dayLabel = (apt) => new Date(apt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
// Completed appointments of this doctor in the last `days` days that have no
// prescription and were not marked "not needed".
async function dueFor(doctorId, now = Date.now(), days = 14) {
  const apts = await Appointment.find({
    doctor: doctorId,
    status: 'completed',
    rxNotNeeded: { $ne: true },
    isFollowUp: { $ne: true },
    date: { $gte: new Date(now - (days + 1) * DAY) },
  })
    .select('patient date timeSlot bookedFor familyMemberName completedAt consultationType')
    .populate('patient', 'name patientId')
    .sort({ date: -1 })
    .limit(100)
    .lean();
  if (!apts.length) return [];
  const have = new Set((await Prescription.distinct('appointment', { appointment: { $in: apts.map((a) => a._id) } })).map(String));
  return apts.filter((a) => !have.has(String(a._id)));
}
const getPrescriptionDue = async (req, res) => {
  try {
    res.json({ appointments: await dueFor(req.user._id) });
  } catch (error) {
    console.error('Prescription due error:', error.message);
    res.status(500).json({ message: 'Could not load the list' });
  }
};
const markNoPrescription = async (req, res) => {
  try {
    const apt = await Appointment.findById(req.params.id);
    if (!apt) return res.status(404).json({ message: 'Appointment not found' });
    if (String(apt.doctor) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized' });
    if (apt.status !== 'completed') return res.status(400).json({ message: 'Only for a completed appointment' });
    apt.rxNotNeeded = true;
    logEvent(apt, { role: 'doctor', by: req.user._id, action: 'admin_note', note: 'Doctor: no prescription needed' });
    await apt.save({ validateModifiedOnly: true });
    res.json({ message: 'Okay, removed from your list.' });
  } catch (error) {
    console.error('No prescription error:', error.message);
    res.status(500).json({ message: 'Could not save' });
  }
};
const askForPrescription = async (req, res) => {
  try {
    const apt = await Appointment.findById(req.params.id);
    if (!apt) return res.status(404).json({ message: 'Appointment not found' });
    if (String(apt.patient) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized' });
    if (apt.status !== 'completed') return res.status(400).json({ message: 'The consultation is not finished yet' });
    if (apt.rxNotNeeded) return res.status(400).json({ message: 'Your doctor has said no prescription is needed for this visit' });
    if (await Prescription.exists({ appointment: apt._id })) return res.status(400).json({ message: 'Your prescription is already there' });
    const last = apt.rxAskedAt ? new Date(apt.rxAskedAt).getTime() : 0;
    if (Date.now() - last < ASK_EVERY_MS) {
      return res.status(429).json({ message: 'We reminded your doctor recently. You can ask again tomorrow.', nextAskAt: new Date(last + ASK_EVERY_MS) });
    }
    apt.rxAskedAt = new Date();
    logEvent(apt, { role: 'patient', by: req.user._id, action: 'admin_note', note: 'Patient asked for the prescription' });
    await apt.save({ validateModifiedOnly: true });
    // Generic wording (no patient name on a lock screen), like other doctor pushes.
    sendPushToUser(String(apt.doctor), {
      title: 'A patient is waiting for a prescription',
      body: `For the consultation on ${dayLabel(apt)}. Tap to write it.`,
      url: '/dashboard',
      tag: `rx-${apt._id}`,
    });
    res.json({ message: 'We have reminded your doctor. You will get a notification when the prescription is ready.' });
  } catch (error) {
    console.error('Ask prescription error:', error.message);
    res.status(500).json({ message: 'Could not send the reminder' });
  }
};
module.exports = { getPrescriptionDue, markNoPrescription, askForPrescription, dueFor, ASK_EVERY_MS };
