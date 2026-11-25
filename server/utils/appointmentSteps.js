// ============================================
// Where is each side of an appointment right now?
// ============================================
// Pure function (unit-tested). Used by the admin appointments list and the
// Investigate panel so both always say the same thing.
//   tone: ok (fine) | wait (normal waiting) | bad (needs attention) | idle
//   flag: 'dispute' (paid vs not received) | 'stuck' | null
const { slotWindowMs } = require('./slots');
const H = 60 * 60 * 1000;
function stepsFor(apt, now = Date.now()) {
  const status = apt.status;
  const pay = apt.paymentStatus || 'pending';
  const fee = Number(apt.doctor && apt.doctor.consultationFee) || 0;
  const w = slotWindowMs(apt.date, apt.timeSlot);
  const slotStarted = !!w && w.start <= now;
  const slotEnded2h = !!w && w.end <= now - 2 * H;
  const idle = (label) => ({ patient: { label, tone: 'idle' }, doctor: { label, tone: 'idle' }, flag: null });
  if (status === 'cancelled') return idle(apt.noShow ? 'Cancelled (did not attend)' : 'Cancelled');
  if (status === 'completed') {
    return { patient: { label: 'Consultation done', tone: 'ok' }, doctor: { label: 'Consultation done', tone: 'ok' }, flag: null };
  }
  let out;
  if (status === 'pending') {
    if (slotStarted) {
      out = { patient: { label: 'Needs to pick a new time', tone: 'wait' }, doctor: { label: 'Did not confirm in time', tone: 'bad' }, flag: 'stuck' };
    } else {
      out = { patient: { label: 'Waiting for the doctor to confirm', tone: 'wait' }, doctor: { label: 'Needs to confirm', tone: 'wait' }, flag: null };
    }
  } else if (apt.confirmedLate) {
    out = { patient: { label: 'Needs to pick a new time', tone: 'wait' }, doctor: { label: 'Confirmed late, waiting for patient', tone: 'wait' }, flag: null };
  } else if (apt.isFollowUp || fee <= 0 || pay === 'paid') {
    const paidTxt = pay === 'paid' && fee > 0 && !apt.isFollowUp;
    out = {
      patient: { label: paidTxt ? 'Paid. Ready for the consultation' : 'Ready for the consultation', tone: 'ok' },
      doctor: { label: paidTxt ? 'Payment received. Hold the consultation' : 'Hold the consultation', tone: 'ok' },
      flag: null,
    };
  } else if (pay === 'patient_claimed' && apt.paymentDisputedAt) {
    out = { patient: { label: 'Says paid. Doctor says not received', tone: 'bad' }, doctor: { label: 'Says payment NOT received', tone: 'bad' }, flag: 'dispute' };
  } else if (pay === 'patient_claimed') {
    const since = new Date(apt.paymentClaimedAt || apt.updatedAt || now).getTime();
    const late = now - since >= 3 * H;
    out = {
      patient: { label: 'Says paid. Waiting for the doctor to verify', tone: 'wait' },
      doctor: { label: late ? 'Has not checked the payment (3h+)' : 'Needs to check the payment', tone: late ? 'bad' : 'wait' },
      flag: null,
    };
  } else {
    out = { patient: { label: 'Needs to pay', tone: 'wait' }, doctor: { label: 'Waiting for the patient to pay', tone: 'wait' }, flag: null };
  }
  if (!out.flag && slotEnded2h) {
    out.flag = 'stuck';
    out.doctor = { label: `${out.doctor.label}. Time passed, not closed`, tone: 'bad' };
  }
  return out;
}
module.exports = { stepsFor };
