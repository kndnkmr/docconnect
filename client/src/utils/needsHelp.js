// ============================================
// Admin "Needs help" helpers (pure, tested in tests/needsHelp.test.mjs)
// ============================================

// Group order + labels shown on the Needs help screen.
export const GROUPS = [
  { key: 'notConfirmed', tone: 'red', icon: '🔴', title: 'Slot soon, not confirmed by doctor', note: 'doctor reminded automatically (3h after booking or 4h before the slot)' },
  { key: 'paymentWaiting', tone: 'orange', icon: '🟠', title: "Patient says paid, doctor hasn't confirmed", note: 'doctor reminded at 3h, you are emailed at 24h' },
  { key: 'unpaidSoon', tone: 'yellow', icon: '🟡', title: 'Confirmed, not paid, starts within 2h', note: 'patient reminded automatically' },
  { key: 'slotPassedOpen', tone: 'gray', icon: '⚪', title: 'Slot passed, still open', note: 'ended 2h+ ago, still pending/confirmed. Did it happen?' },
  { key: 'paidCancelled', tone: 'gray', icon: '⚪', title: 'Paid, then cancelled: check refund', note: 'check the refund with the doctor, then mark it checked' },
  { key: 'noPhone', tone: 'gray', icon: '⚪', title: 'Patients with no mobile number', note: 'add it via Help patient' },
];

// wa.me needs digits only, with country code. '' if there's no usable number.
export function waLink(phone, text) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return '';
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

const dayLabel = (date) => new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

// "3h", "45 min", "2d" — for "booked 6h ago" / "waiting 26h".
export function ago(date, now = Date.now()) {
  const ms = Math.max(0, now - new Date(date).getTime());
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

// Pre-filled WhatsApp messages from ProMedicoz support.
export function messageFor(group, apt, to) {
  const patient = apt.patient?.name || 'the patient';
  const doctor = apt.doctor?.name || '';
  const when = `${dayLabel(apt.date)}, ${apt.timeSlot}`;
  if (to === 'doctor') {
    if (group === 'notConfirmed') return `Hello Dr. ${doctor}, this is ProMedicoz support. ${patient} has booked ${when} and is waiting for your confirmation. Please confirm it from your ProMedicoz dashboard. Thank you.`;
    if (group === 'paymentWaiting') return `Hello Dr. ${doctor}, this is ProMedicoz support. ${patient} says they have paid for ${when}${apt.paymentUTR ? ` (UPI ref ${apt.paymentUTR})` : ''}. Could you check your UPI app and tap "Mark Paid"? Thank you.`;
    if (group === 'slotPassedOpen') return `Hello Dr. ${doctor}, this is ProMedicoz support. The appointment with ${patient} on ${when} is still open. Did it take place? Please mark it completed or cancelled on your dashboard.`;
    if (group === 'paidCancelled') return `Hello Dr. ${doctor}, this is ProMedicoz support. ${patient}'s appointment on ${when} was cancelled after payment. Has the refund been sent?`;
  }
  if (group === 'unpaidSoon') return `Hello ${patient}, this is ProMedicoz support. Your appointment with Dr. ${doctor} is at ${when}. Please complete the payment from your ProMedicoz dashboard so the doctor can start on time. Reply here if you need help.`;
  if (group === 'paidCancelled') return `Hello ${patient}, this is ProMedicoz support about your cancelled appointment with Dr. ${doctor} on ${when}. We're checking your refund and will update you.`;
  return `Hello ${patient}, this is ProMedicoz support about your appointment with Dr. ${doctor} on ${when}.`;
}
