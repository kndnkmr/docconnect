// ============================================
// "Did the patient come?" — doctor's list + "Didn't come" (utils/attendance.js)
// ============================================
const Appointment = require('../models/Appointment');
const CallLog = require('../models/CallLog');
const { attendanceAction } = require('../utils/attendance');
const { slotWindowMs } = require('../utils/slots');
const { appointmentChanged } = require('../utils/live');

// GET /api/appointments/attendance-due (doctor) — confirmed visits whose slot
// has ended (last 14 days) and that still need ✅ Came / ✗ Didn't come.
const getAttendanceDue = async (req, res) => {
  try {
    const now = Date.now();
    const apts = await Appointment.find({
      doctor: req.user._id,
      status: 'confirmed',
      noShow: { $ne: true },
      date: { $gte: new Date(now - 15 * 864e5), $lte: new Date(now + 864e5) },
    })
      .select('patient date timeSlot status consultationType paymentStatus bookedFor familyMemberName noShow')
      .populate('patient', 'name patientId')
      .sort({ date: 1 })
      .lean();
    const joined = new Set((await CallLog.distinct('appointment', { appointment: { $in: apts.map((a) => a._id) } })).map(String));
    const due = apts
      .filter((a) => attendanceAction(a, now, { doctorJoinedCall: joined.has(String(a._id)) }) === 'ask')
      .map((a) => ({ ...a, autoCompletesAt: a.paymentStatus === 'paid' ? new Date(slotWindowMs(a.date, a.timeSlot).end + 3 * 864e5) : null }));
    res.json({ appointments: due });
  } catch (error) {
    console.error('Attendance due error:', error.message);
    res.status(500).json({ message: 'Could not load the list' });
  }
};

// PUT /api/appointments/:id/no-show (doctor) — the patient didn't come.
// Ends the appointment ("Did not attend"); the patient isn't asked to rate.
const markNoShow = async (req, res) => {
  try {
    const apt = await Appointment.findById(req.params.id);
    if (!apt) return res.status(404).json({ message: 'Appointment not found' });
    if (String(apt.doctor) !== String(req.user._id)) return res.status(403).json({ message: 'You can only update your own appointments' });
    if (apt.status !== 'confirmed') return res.status(400).json({ message: `This appointment is already ${apt.status}.` });
    const w = slotWindowMs(apt.date, apt.timeSlot);
    if (w && Date.now() < w.start) return res.status(400).json({ message: 'This appointment hasn\'t started yet.' });
    apt.status = 'cancelled';
    apt.noShow = true;
    apt.cancellationReason = 'Did not attend';
    await apt.save({ validateModifiedOnly: true });
    appointmentChanged(req, apt, { status: 'cancelled' });
    res.json({ message: 'Marked as didn\'t come.', appointment: apt });
  } catch (error) {
    console.error('No-show error:', error.message);
    res.status(500).json({ message: 'Could not save. Please try again.' });
  }
};

module.exports = { getAttendanceDue, markNoShow };
