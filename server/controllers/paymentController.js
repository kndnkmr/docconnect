// ============================================
// Payment Controller - the patient's "I've paid" flow, with no dead ends
// ============================================
// ProMedicoz doesn't take the money itself: the patient pays the doctor
// directly by UPI, then tells us, and the doctor checks their UPI app and
// presses "Mark Paid". The weak spot was the middle: once a patient tapped
// "I Have Paid" the QR and upload button disappeared, so a patient who hadn't
// really finished paying (or wanted to add a receipt) was stuck.
//
// Payment states and the way out of each:
//   pending          → pay (QR / UPI app), then: upload screenshot, type UTR,
//                      or just say "I've paid"          → patient_claimed
//   patient_claimed  → add/replace screenshot or UTR, show QR again,
//                      "I haven't paid yet"             → pending
//                      "Remind doctor" (after 2h, max every 6h)
//                      automatic: doctor nudged at 3h, admin alerted at 24h
//                      (utils/paymentFollowUp.js)
//   paid             → final for the patient. Doctor or admin decides.
// Admin can also mark paid or reset (Admin → Appointments → Payment help).
//
// Endpoints:
//   PUT  /api/appointments/:id/payment-screenshot  (patient, multipart "screenshot")
//   PUT  /api/appointments/:id/notify-payment      (patient, body { utr? })
//   PUT  /api/appointments/:id/undo-payment-claim  (patient)
//   POST /api/appointments/:id/payment-reminder    (patient)
//   PUT  /api/admin/appointments/:id/payment       (admin, body { action, amount?, note? })

const Appointment = require('../models/Appointment');
const { sendPushToUser } = require('../utils/push');
const { uploadFile } = require('../utils/uploadFile');
const { appointmentChanged } = require('../utils/live');

const REMIND_AFTER_MS = 2 * 60 * 60 * 1000;   // patient can remind 2h after claiming
const REMIND_EVERY_MS = 6 * 60 * 60 * 1000;   // ...and then at most every 6h
const MAX_AMOUNT = 100000;
const MAX_NOTE = 300;

class PaymentError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const send = (res, error, label) => {
  if (error instanceof PaymentError) return res.status(error.status).json({ message: error.message });
  if (error && error.kind === 'ObjectId') return res.status(400).json({ message: 'Invalid appointment id' });
  console.error(`${label} error:`, error.message);
  return res.status(500).json({ message: `Error: ${label.toLowerCase()}` });
};

// UTR = the 12-digit UPI transaction reference every UPI app shows.
function cleanUTR(raw) {
  if (raw === undefined || raw === null || raw === '') return '';
  const v = String(raw).replace(/[\s-]/g, '');
  if (!/^\d{12}$/.test(v)) {
    throw new PaymentError(400, 'UPI reference (UTR) is the 12-digit number shown in your UPI app after paying.');
  }
  return v;
}

async function loadOwn(req) {
  const apt = await Appointment.findById(req.params.id);
  if (!apt) throw new PaymentError(404, 'Appointment not found');
  if (String(apt.patient) !== String(req.user._id)) throw new PaymentError(403, 'Not authorized');
  return apt;
}

// Can the patient still change anything about payment on this appointment?
function assertOpen(apt) {
  if (apt.status === 'cancelled') throw new PaymentError(400, 'This appointment was cancelled');
  if (apt.paymentStatus === 'paid') throw new PaymentError(400, 'This appointment is already marked as paid');
  if (apt.confirmedLate) throw new PaymentError(400, 'The booked time has already passed. Please pick a new time first, then pay.');
}

const shortWhen = (apt) =>
  `${new Date(apt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}, ${(apt.timeSlot || '').split(' - ')[0]}`;

// Tell the doctor there's a payment to check: push (works with the app
// closed) + socket (their open dashboard refreshes). Generic wording, like
// the other doctor pushes, so a lock screen doesn't show the patient's name.
function tellDoctor(req, apt, title, body) {
  const doctorId = String(apt.doctor && apt.doctor._id ? apt.doctor._id : apt.doctor);
  sendPushToUser(doctorId, { title, body, url: '/dashboard', tag: `payment-${apt._id}` });
  const io = req.app && req.app.get ? req.app.get('io') : null;
  if (io) io.to(`user:${doctorId}`).emit('appointment-updated', { appointmentId: String(apt._id) });
}

function markClaimed(apt) {
  if (apt.paymentStatus !== 'patient_claimed') {
    apt.paymentStatus = 'patient_claimed';
    apt.paymentClaimedAt = new Date();
    apt.paymentDisputedAt = null; // a fresh claim starts clean
    apt.paymentDisputeNote = '';
    apt.paymentDoctorNudgedAt = null;
    apt.paymentAdminAlertedAt = null;
  }
}

const { logEvent } = require('../utils/appointmentEvents');
const paymentView = (apt) => ({
  _id: apt._id,
  paymentStatus: apt.paymentStatus,
  paymentScreenshot: apt.paymentScreenshot,
  paymentUTR: apt.paymentUTR,
  paymentClaimedAt: apt.paymentClaimedAt,
  paymentReminderSentAt: apt.paymentReminderSentAt,
  paymentDisputedAt: apt.paymentDisputedAt,
});

// ---- Upload (or replace) a payment screenshot. Counts as "I've paid". ----
const uploadPaymentScreenshot = async (req, res) => {
  try {
    const apt = await loadOwn(req);
    assertOpen(apt);
    if (!req.file) throw new PaymentError(400, 'Please choose a screenshot of your payment');

    const replacing = !!apt.paymentScreenshot;
    const prevShot = apt.paymentScreenshot;
    const firstClaim = apt.paymentStatus !== 'patient_claimed';
    apt.paymentScreenshot = await uploadFile(req.file.buffer, req.file.mimetype, 'promedicoz/payments');
    markClaimed(apt);
    if (firstClaim) logEvent(apt, { role: 'patient', by: req.user._id, action: 'paid_claimed' });
    logEvent(apt, { role: 'patient', by: req.user._id, action: 'screenshot_sent', data: { url: apt.paymentScreenshot, replaced: prevShot || undefined } });
    await apt.save({ validateModifiedOnly: true });

    tellDoctor(req, apt, replacing ? 'Payment receipt updated' : 'Payment receipt received',
      `A patient sent a payment screenshot for ${shortWhen(apt)}. Check it, then tap "Mark Paid".`);

    res.json({ message: replacing ? 'Screenshot replaced' : 'Screenshot sent to the doctor', ...paymentView(apt) });
  } catch (error) {
    send(res, error, 'Uploading payment screenshot');
  }
};

// ---- "I've paid" (optionally with the UPI reference / UTR) ----
const notifyPayment = async (req, res) => {
  try {
    const apt = await loadOwn(req);
    assertOpen(apt);
    const utr = cleanUTR(req.body && req.body.utr);
    const wasClaimed = apt.paymentStatus === 'patient_claimed';
    if (utr) apt.paymentUTR = utr;
    markClaimed(apt);
    if (!wasClaimed) logEvent(apt, { role: 'patient', by: req.user._id, action: 'paid_claimed' });
    if (utr) logEvent(apt, { role: 'patient', by: req.user._id, action: 'utr_sent', data: { utr } });
    await apt.save({ validateModifiedOnly: true });

    if (!wasClaimed || utr) {
      tellDoctor(req, apt, 'Payment to check',
        `A patient says they've paid for ${shortWhen(apt)}${utr ? ` (UPI ref ${utr})` : ''}. Check your UPI app, then tap "Mark Paid".`);
    }
    res.json({ message: utr ? 'UPI reference sent to the doctor' : 'Doctor notified', ...paymentView(apt) });
  } catch (error) {
    send(res, error, 'Notifying payment');
  }
};

// ---- "I haven't paid yet" — back to the pay screen ----
const undoPaymentClaim = async (req, res) => {
  try {
    const apt = await loadOwn(req);
    assertOpen(apt);
    if (apt.paymentStatus !== 'patient_claimed') {
      return res.json({ message: 'Payment details are showing again', ...paymentView(apt) });
    }
    // Keep what they had sent: it stays visible to admin in the timeline.
    logEvent(apt, { role: 'patient', by: req.user._id, action: 'claim_undone', data: { utr: apt.paymentUTR || undefined, screenshot: apt.paymentScreenshot || undefined } });
    apt.paymentStatus = 'pending';
    apt.paymentClaimedAt = null;
    apt.paymentScreenshot = '';
    apt.paymentUTR = '';
    apt.paymentReminderSentAt = null;
    apt.paymentDoctorNudgedAt = null;
    apt.paymentAdminAlertedAt = null;
    await apt.save({ validateModifiedOnly: true });

    const io = req.app && req.app.get ? req.app.get('io') : null;
    if (io) io.to(`user:${String(apt.doctor)}`).emit('appointment-updated', { appointmentId: String(apt._id) });
    res.json({ message: 'OK — the payment details are showing again', ...paymentView(apt) });
  } catch (error) {
    send(res, error, 'Undoing payment claim');
  }
};

// ---- "Remind doctor" (2h after claiming, then at most every 6h) ----
const remindDoctorAboutPayment = async (req, res) => {
  try {
    const apt = await loadOwn(req);
    assertOpen(apt);
    if (apt.paymentStatus !== 'patient_claimed') {
      throw new PaymentError(400, 'Tell the doctor you have paid first');
    }
    const now = Date.now();
    const claimedAt = apt.paymentClaimedAt ? new Date(apt.paymentClaimedAt).getTime() : 0;
    const lastAt = apt.paymentReminderSentAt ? new Date(apt.paymentReminderSentAt).getTime() : 0;
    const nextAt = Math.max(claimedAt + REMIND_AFTER_MS, lastAt ? lastAt + REMIND_EVERY_MS : 0);
    if (now < nextAt) {
      return res.status(429).json({
        message: 'The doctor was notified recently. You can send a reminder a bit later.',
        nextReminderAt: new Date(nextAt),
      });
    }
    apt.paymentReminderSentAt = new Date();
    logEvent(apt, { role: 'patient', by: req.user._id, action: 'reminded_doctor' });
    await apt.save({ validateModifiedOnly: true });
    tellDoctor(req, apt, 'Reminder: payment to check',
      `A patient is waiting for you to confirm their payment for ${shortWhen(apt)}. Check your UPI app, then tap "Mark Paid".`);
    res.json({ message: 'Reminder sent to the doctor', nextReminderAt: new Date(now + REMIND_EVERY_MS), ...paymentView(apt) });
  } catch (error) {
    send(res, error, 'Reminding doctor');
  }
};

// ---- Doctor: "I did not receive this payment" ----
// PUT /api/appointments/:id/payment-not-received  body { note? }
// The patient said they paid, the doctor can't find it. Tells the patient what
// to send, and flags the booking for admin (Needs help + Investigate).
const doctorPaymentNotReceived = async (req, res) => {
  try {
    const note = req.body && req.body.note !== undefined ? String(req.body.note).trim() : '';
    if (note.length > MAX_NOTE) throw new PaymentError(400, `Note is too long (max ${MAX_NOTE} characters)`);
    const apt = await Appointment.findById(req.params.id);
    if (!apt) throw new PaymentError(404, 'Appointment not found');
    if (String(apt.doctor) !== String(req.user._id)) throw new PaymentError(403, 'Not authorized');
    if (apt.paymentStatus !== 'patient_claimed') throw new PaymentError(400, 'The patient has not said they paid for this appointment');
    if (!apt.paymentDisputedAt) {
      apt.paymentDisputedAt = new Date();
      apt.paymentDisputeNote = note;
      logEvent(apt, { role: 'doctor', by: req.user._id, action: 'not_received', note });
      await apt.save({ validateModifiedOnly: true });
      sendPushToUser(String(apt.patient), {
        title: 'The doctor could not find your payment',
        body: `For ${shortWhen(apt)}. Please send the UPI reference (UTR) or a clear screenshot, or contact ProMedicoz support.`,
        url: `/booking-confirmation?id=${apt._id}`,
        tag: `payment-${apt._id}`,
      });
      appointmentChanged(req, apt, { paymentDisputed: true });
    }
    res.json({ message: 'Noted. The patient has been asked to send the UPI reference or a clearer screenshot, and ProMedicoz support can see this.', appointment: paymentView(apt), paymentDisputedAt: apt.paymentDisputedAt });
  } catch (error) {
    send(res, error, 'Reporting payment not received');
  }
};

// ---- Admin: Payment help (mark paid on the doctor's behalf, or reset) ----
const adminPaymentAction = async (req, res) => {
  try {
    const { action } = req.body || {};
    const note = req.body && req.body.note !== undefined ? String(req.body.note).trim() : '';
    if (note.length > MAX_NOTE) throw new PaymentError(400, `Note is too long (max ${MAX_NOTE} characters)`);

    const apt = await Appointment.findById(req.params.id).populate('doctor', 'name consultationFee');
    if (!apt) throw new PaymentError(404, 'Appointment not found');
    if (apt.status === 'cancelled') throw new PaymentError(400, 'This appointment was cancelled');

    if (action === 'mark_paid') {
      if (apt.paymentStatus === 'paid') throw new PaymentError(400, 'Already marked as paid');
      let amount = apt.doctor && apt.doctor.consultationFee ? apt.doctor.consultationFee : 0;
      if (req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '') {
        amount = Number(req.body.amount);
        if (Number.isNaN(amount) || amount < 0 || amount > MAX_AMOUNT) {
          throw new PaymentError(400, `Amount must be between 0 and ${MAX_AMOUNT}`);
        }
      }
      apt.paymentStatus = 'paid';
      apt.paidAt = new Date();
      apt.amountCollected = amount;
      apt.paymentMarkedBy = req.user._id;
      apt.paymentMarkedByRole = 'admin';
      apt.paymentAdminNote = note;
      logEvent(apt, { role: 'admin', by: req.user._id, action: 'admin_marked_paid', note, data: { amount } });
      await apt.save({ validateModifiedOnly: true });
      appointmentChanged(req, apt, { paymentStatus: 'paid' });
      sendPushToUser(String(apt.patient), {
        title: 'Payment confirmed',
        body: `Your payment for ${shortWhen(apt)} with Dr. ${apt.doctor ? apt.doctor.name : ''} is confirmed.`,
        url: '/dashboard',
        tag: `payment-${apt._id}`,
      });
      return res.json({ message: `Marked as paid (Rs. ${amount}).`, appointment: apt });
    }

    if (action === 'reset') {
      if (apt.paymentStatus === 'pending') throw new PaymentError(400, 'Payment is already "not paid"');
      if (apt.paymentStatus === 'paid' && !note) {
        throw new PaymentError(400, 'Please add a note explaining why a paid appointment is being reset');
      }
      logEvent(apt, { role: 'admin', by: req.user._id, action: 'admin_reset', note, data: { was: apt.paymentStatus, utr: apt.paymentUTR || undefined, screenshot: apt.paymentScreenshot || undefined } });
      apt.paymentStatus = 'pending';
      apt.paidAt = null;
      apt.amountCollected = 0;
      apt.paymentClaimedAt = null;
      apt.paymentScreenshot = '';
      apt.paymentUTR = '';
      apt.paymentReminderSentAt = null;
      apt.paymentDoctorNudgedAt = null;
      apt.paymentAdminAlertedAt = null;
      apt.paymentMarkedBy = req.user._id;
      apt.paymentMarkedByRole = 'admin';
      apt.paymentAdminNote = note;
      await apt.save({ validateModifiedOnly: true });
      appointmentChanged(req, apt, { paymentStatus: 'pending' });
      sendPushToUser(String(apt.patient), {
        title: 'Payment details are ready',
        body: `You can complete the payment for ${shortWhen(apt)} from your dashboard.`,
        url: '/dashboard',
        tag: `payment-${apt._id}`,
      });
      return res.json({ message: 'Payment reset — the patient sees the QR and upload options again.', appointment: apt });
    }

    throw new PaymentError(400, 'action must be "mark_paid" or "reset"');
  } catch (error) {
    send(res, error, 'Updating payment');
  }
};

// ---- Admin: refund checked (paid/claimed, then cancelled) ----
// PUT /api/admin/appointments/:id/refund-checked  body { note? }
// Records that support checked the refund with the doctor/patient, so it
// leaves the "Paid, then cancelled" list. Payment status itself is unchanged.
const adminRefundChecked = async (req, res) => {
  try {
    const note = req.body && req.body.note !== undefined ? String(req.body.note).trim() : '';
    if (note.length > MAX_NOTE) throw new PaymentError(400, `Note is too long (max ${MAX_NOTE} characters)`);
    const apt = await Appointment.findById(req.params.id);
    if (!apt) throw new PaymentError(404, 'Appointment not found');
    if (apt.status !== 'cancelled') throw new PaymentError(400, 'Only for cancelled appointments');
    apt.refundCheckedAt = new Date();
    apt.refundCheckedBy = req.user._id;
    apt.refundNote = note;
    logEvent(apt, { role: 'admin', by: req.user._id, action: 'refund_checked', note });
    await apt.save({ validateModifiedOnly: true });
    res.json({ message: 'Marked as refund checked.' });
  } catch (error) {
    send(res, error, 'Marking refund checked');
  }
};

module.exports = {
  adminRefundChecked,
  uploadPaymentScreenshot, notifyPayment, undoPaymentClaim, remindDoctorAboutPayment, adminPaymentAction, doctorPaymentNotReceived,
  REMIND_AFTER_MS, REMIND_EVERY_MS,
};
