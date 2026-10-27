// ============================================
// createBooking — the ONE place an appointment is created
// ============================================
// Used by:
//   - POST /api/appointments              (the patient books for themselves)
//   - POST /api/admin/patients/:id/appointments (ProMedicoz support books on
//     the patient's behalf, after the patient agreed on a call/WhatsApp)
// Keeping a single function means both paths always apply the same rules:
// required fields, consent, doctor exists and is bookable (not suspended/
// deleted/unverified, patient not blocked), the slot is one the doctor's
// schedule offers (not blocked, not past, not already started today), slot
// still free, family member exists, follow-up belongs to this patient+doctor
// and is inside its window, symptom sanitising, and the unique slot index
// (two people can't take one slot).
//
// Throws BookingError(status, message) for anything the caller should show
// to the user; any other error is unexpected (caller returns 500).

const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { sendAppointmentNotification, sendAdminBookingNotification } = require('./sendEmail');
const { slotProblem } = require('./slots');

const MAX_REASON = 1000;
const CONSULT_TYPES = ['in-person', 'video', 'phone'];
// Same visibility rule as the public doctor list (GET /api/doctors).
const BOOKABLE_DOCTOR = { role: 'doctor', isVerified: { $ne: false }, isDeleted: { $ne: true }, isSuspended: { $ne: true } };

class BookingError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Today's date in India as "YYYY-MM-DD".
const todayIST = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * @param {object} args
 * @param {string|ObjectId} args.patientId   account the appointment belongs to
 * @param {object} args.body                 booking fields (same as POST /api/appointments)
 * @param {string} args.consentIP            IP recorded with the consent
 * @param {'patient'|'admin'} [args.consentBy]
 * @param {string|ObjectId|null} [args.bookedByAdmin]
 * @returns {Promise<{ appointment, doctor, patient }>}
 */
async function createBooking({ patientId, body, consentIP = '', consentBy = 'patient', bookedByAdmin = null }) {
  const {
    doctorId, date, timeSlot, reason, consultationType, bookedFor, familyMemberName,
    originalAppointmentId, isFollowUp, consentGiven, symptoms,
  } = body || {};

  // Step 1: Validate required fields
  if (!doctorId || !date || !timeSlot || !reason) {
    throw new BookingError(400, 'Please provide doctorId, date, timeSlot, and reason');
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new BookingError(400, 'Please describe the reason for the visit');
  }
  if (reason.length > MAX_REASON) {
    throw new BookingError(400, `Reason is too long (max ${MAX_REASON} characters)`);
  }
  if (consultationType !== undefined && consultationType !== '' && !CONSULT_TYPES.includes(consultationType)) {
    throw new BookingError(400, `Consultation type must be one of: ${CONSULT_TYPES.join(', ')}`);
  }
  if (bookedFor !== undefined && bookedFor !== '' && !['self', 'family'].includes(bookedFor)) {
    throw new BookingError(400, 'bookedFor must be "self" or "family"');
  }

  // Step 1b: If booking for family member, validate family member name
  if (bookedFor === 'family' && !familyMemberName) {
    throw new BookingError(400, 'Please provide the family member name when booking for a family member');
  }

  // Step 1c: Require teleconsultation consent (legal requirement)
  if (!consentGiven) {
    throw new BookingError(400, 'Consent to the teleconsultation terms is required to book an appointment');
  }

  // Step 1d: The account the appointment is for. A family booking must name
  // someone actually saved on that account (stored with their saved spelling).
  const patient = await User.findById(patientId).select('name phone email patientId familyMembers');
  if (!patient) {
    throw new BookingError(404, 'Patient not found');
  }
  let memberName = '';
  if (bookedFor === 'family') {
    const wanted = String(familyMemberName).trim().toLowerCase();
    const member = (patient.familyMembers || []).find((m) => String(m.name || '').trim().toLowerCase() === wanted);
    if (!member) {
      throw new BookingError(400, 'Please choose a family member saved on this account (add them in the Family tab first).');
    }
    memberName = member.name;
  }

  // Step 2: The doctor must exist and be bookable — same visibility rule as
  // the public doctor list (not unverified, deleted or suspended).
  const doctor = await User.findOne({ _id: doctorId, ...BOOKABLE_DOCTOR });
  if (!doctor) {
    throw new BookingError(404, 'Doctor not found');
  }

  // Step 2a: A doctor can block a patient (abuse). Blocked means no bookings.
  if ((doctor.blockedPatients || []).some((p) => String(p) === String(patientId))) {
    throw new BookingError(403, 'Booking with this doctor is not available for this account. Please contact ProMedicoz support.');
  }

  // Step 2b: Date + slot must be ones the doctor's schedule actually offers:
  // a real YYYY-MM-DD date, not past, not a blocked day, a slot label from
  // the doctor's weekly hours, and (today) a slot that hasn't started yet.
  // The UI only offers such slots; this stops a direct API call from booking
  // an impossible time.
  const problem = slotProblem(doctor, date, timeSlot);
  if (problem) {
    throw new BookingError(400, problem);
  }

  // Step 3: Check if the time slot is already taken
  const existingAppointment = await Appointment.findOne({
    doctor: doctorId,
    date: new Date(date),
    timeSlot,
    status: { $nin: ['cancelled'] }
  });
  if (existingAppointment) {
    throw new BookingError(400, 'This time slot is already booked. Please choose another time.');
  }

  // (Step 4, "not in the past", is part of slotProblem above.)

  // Step 5: Repeat / follow-up bookings link to an earlier appointment. It must
  // be this patient's own appointment with this same doctor. A FREE follow-up
  // (no payment) additionally needs that appointment to have an open
  // follow-up window (set when the doctor wrote the prescription).
  if (isFollowUp && !originalAppointmentId) {
    throw new BookingError(400, 'A free follow-up must be booked from the original appointment.');
  }
  if (originalAppointmentId) {
    let originalApt = null;
    try {
      originalApt = await Appointment.findById(originalAppointmentId);
    } catch (e) {
      originalApt = null; // malformed id → treated as not found
    }
    if (!originalApt
      || String(originalApt.patient) !== String(patientId)
      || String(originalApt.doctor) !== String(doctorId)) {
      throw new BookingError(400, 'The earlier appointment could not be found for this patient and doctor.');
    }
    if (isFollowUp && (
      originalApt.status === 'cancelled'
      || !originalApt.followUpDeadline
      || new Date() > new Date(originalApt.followUpDeadline))) {
      throw new BookingError(400, 'Free follow-up period has expired. Please book a regular appointment.');
    }
  }

  // Sanitize symptoms: only strings, trimmed, capped in count and length
  // so a crafted payload can't stuff an unbounded amount of data in here.
  const cleanSymptoms = Array.isArray(symptoms)
    ? symptoms.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 50)).slice(0, 20)
    : [];

  // Step 6: Create the appointment
  const appointmentData = {
    patient: patientId,
    doctor: doctorId,
    date: new Date(date),
    timeSlot,
    reason: reason.trim(),
    symptoms: cleanSymptoms,
    consultationType: consultationType || 'in-person',
    status: 'pending',
    bookedFor: bookedFor === 'family' ? 'family' : 'self',
    familyMemberName: bookedFor === 'family' ? memberName : '',
    isFollowUp: !!isFollowUp,
    paymentStatus: isFollowUp ? 'paid' : 'pending', // Follow-ups skip payment (validated above)
    consentGiven: true,
    consentAt: new Date(),
    consentIP,
    consentBy,
    bookedByAdmin: bookedByAdmin || null,
  };
  // If this is a repeat booking, link to original appointment
  if (originalAppointmentId) appointmentData.originalAppointment = originalAppointmentId;

  let appointment;
  try {
    appointment = await Appointment.create(appointmentData);
  } catch (error) {
    // If two people booked the same slot at once, the unique index rejects the
    // second create with a duplicate-key error (code 11000).
    if (error && error.code === 11000) {
      throw new BookingError(400, 'This time slot was just booked by someone else. Please choose another time.');
    }
    throw error;
  }

  // Populate doctor info so the caller gets the doctor's name, not just an id.
  await appointment.populate('doctor', 'name specialization profilePhoto');

  // Notify the doctor and the admin inbox (non-blocking — never affects booking).
  sendAppointmentNotification(doctor, patient, appointment);
  sendAdminBookingNotification(doctor, patient, appointment);

  return { appointment, doctor, patient };
}

module.exports = { createBooking, BookingError, todayIST, BOOKABLE_DOCTOR };
