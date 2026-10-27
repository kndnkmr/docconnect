// ============================================
// Patient payment flow helpers (pure, unit-tested in tests/paymentFlow.test.mjs)
// ============================================
// The rules here mirror server/controllers/paymentController.js.

export const REMIND_AFTER_MS = 2 * 60 * 60 * 1000; // first reminder 2h after "I've paid"
export const REMIND_EVERY_MS = 6 * 60 * 60 * 1000; // then at most every 6h

// Which payment box the patient should see for this appointment.
//   'pay'     → confirmed, not paid yet: QR / UPI app + "I've paid" options
//   'waiting' → said "I've paid", no proof yet: add proof / pay again / undo
//   'proof'   → screenshot or UTR sent: view/replace, remind, support
//   'paid'    → doctor/admin confirmed
//   null      → nothing to show (pending request, cancelled, free follow-up)
export function paymentStage(apt) {
  if (!apt || apt.status === 'cancelled') return null;
  if (apt.paymentStatus === 'paid') return 'paid';
  if (apt.paymentStatus === 'patient_claimed') {
    return apt.paymentScreenshot || apt.paymentUTR ? 'proof' : 'waiting';
  }
  if (apt.status === 'confirmed') return 'pay';
  return null;
}

// One-tap UPI link (opens GPay / PhonePe / Paytm / BHIM with the payee,
// amount and a note filled in). The note carries the patient ID + date so the
// doctor can match the payment in their UPI app. Returns '' without a UPI ID.
export function buildUpiLink({ upiId, doctorName, amount, patientId, date }) {
  const pa = String(upiId || '').trim();
  if (!/^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,64}$/.test(pa)) return '';
  const params = [`pa=${encodeURIComponent(pa)}`];
  if (doctorName) params.push(`pn=${encodeURIComponent(`Dr ${doctorName}`.slice(0, 50))}`);
  const am = Number(amount);
  if (am > 0 && Number.isFinite(am)) params.push(`am=${am.toFixed(2)}`);
  params.push('cu=INR');
  const day = date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '';
  const tn = ['ProMedicoz', patientId, day].filter(Boolean).join(' ').slice(0, 50);
  params.push(`tn=${encodeURIComponent(tn)}`);
  return `upi://pay?${params.join('&')}`;
}

// UPI apps only open from a phone/tablet.
export function isMobileDevice(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua || '');
}

// 12-digit UPI reference (UTR). Returns the digits, or '' if not valid.
export function cleanUTR(raw) {
  const v = String(raw || '').replace(/[\s-]/g, '');
  return /^\d{12}$/.test(v) ? v : '';
}

// When can the patient press "Remind doctor"?  { can, at: Date|null }
export function reminderState(apt, now = Date.now()) {
  if (!apt || apt.paymentStatus !== 'patient_claimed') return { can: false, at: null };
  const claimed = apt.paymentClaimedAt ? new Date(apt.paymentClaimedAt).getTime() : 0;
  const last = apt.paymentReminderSentAt ? new Date(apt.paymentReminderSentAt).getTime() : 0;
  const at = Math.max(claimed + REMIND_AFTER_MS, last ? last + REMIND_EVERY_MS : 0);
  return { can: now >= at, at: new Date(at) };
}

// WhatsApp support message with everything support needs to find the booking.
export function supportMessage({ patientName, patientId, doctorName, date, timeSlot }) {
  const day = date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
  return [
    'Hi ProMedicoz, I need help with my payment.',
    `Patient: ${patientName || ''}${patientId ? ` (${patientId})` : ''}`,
    `Doctor: Dr. ${doctorName || ''}`,
    `Appointment: ${day}${timeSlot ? `, ${timeSlot}` : ''}`,
  ].join('\n');
}
