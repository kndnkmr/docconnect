// ============================================
// Review Request - "how was your consultation? please rate it" (a few hours after)
// ============================================
// Closes a real retention + social-proof gap: today the "⭐ Rate" button only
// works if the patient happens to reopen the dashboard, so most completed
// consultations never get reviewed. This job watches the clock and, a few
// hours after an appointment is marked 'completed', sends the patient ONE push
// asking them to rate their doctor — unless they've already reviewed it.
//
// Same shape/cadence as appointmentReminder.js: a once-a-minute, idempotent
// job. A per-appointment `reviewRequestSentAt` flag guarantees it fires at most
// once. The delay (a few hours) means the ask lands after the patient has had
// the consultation, not the instant the doctor clicks "Mark Complete".
//
// Deliberately patient-only (the doctor doesn't need a "please get reviewed"
// nudge), and web-push only — no SMS/email cost, works for phone-only patients.

const Appointment = require('../models/Appointment');
const Review = require('../models/Review');
const { sendPushToUser } = require('./push');

// Wait this long after completion before asking, and the catch window. Because
// the job runs every minute, the push fires once when we're between
// DELAY_HOURS and DELAY_HOURS + (window) past completedAt.
const DELAY_HOURS = 3;
const CATCH_WINDOW_MINUTES = 90; // generous — survives a sleeping free-tier dyno

const sendReviewRequests = async () => {
  try {
    const now = Date.now();
    const delayMs = DELAY_HOURS * 60 * 60 * 1000;
    const windowMs = CATCH_WINDOW_MINUTES * 60 * 1000;

    // Completed, not yet asked, and completed long enough ago to be in the
    // ask window. Bounding the scan to the last ~2 days keeps it cheap.
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const candidates = await Appointment.find({
      status: 'completed',
      reviewRequestSentAt: null,
      completedAt: {
        $ne: null,
        $gte: new Date(now - twoDaysMs),
        $lte: new Date(now - delayMs) // completed at least DELAY_HOURS ago
      }
    })
      .select('doctor patient completedAt')
      .populate('doctor', 'name');

    for (const apt of candidates) {
      const completedMs = new Date(apt.completedAt).getTime();
      const askAt = completedMs + delayMs;

      // Only fire inside [askAt, askAt + window]. If we've somehow missed the
      // window entirely (e.g. the server was down for days), mark it sent
      // WITHOUT pushing — a days-late "please rate" nudge is just noise.
      if (now < askAt) continue; // not time yet
      if (now > askAt + windowMs) {
        apt.reviewRequestSentAt = new Date();
        await apt.save({ validateBeforeSave: false });
        continue;
      }

      // Skip (and mark done) if the patient already reviewed this appointment —
      // the unique index on Review.appointment makes this a cheap existence check.
      const already = await Review.findOne({ appointment: apt._id }).select('_id').lean();
      if (already) {
        apt.reviewRequestSentAt = new Date();
        await apt.save({ validateBeforeSave: false });
        continue;
      }

      const doctorName = apt.doctor && apt.doctor.name ? `Dr. ${apt.doctor.name}` : 'your doctor';
      sendPushToUser(apt.patient, {
        title: 'How was your consultation?',
        body: `Please take a moment to rate your consultation with ${doctorName}. It helps other patients choose.`,
        url: '/dashboard',
        tag: `review-request-${apt._id}`
      });

      apt.reviewRequestSentAt = new Date();
      await apt.save({ validateBeforeSave: false });
    }
  } catch (error) {
    console.error('[review-request] Error sending review requests:', error.message);
  }
};

module.exports = { sendReviewRequests };
