// ============================================
// createBooking — the ONE place an appointment is created
// ============================================
// Used by:
//   - POST /api/appointments              (the patient books for themselves)
//   - POST /api/admin/patients/:id/appointments (ProMedicoz support books on
//     the patient's behalf, after the patient agreed on a call/WhatsApp)
// Keeping a single function means both paths always apply the same rules:
// required fields, consent, doctor exists, doctor's blocked dates, slot still
// free, no past dates, follow-up window, symptom sanitising, and the unique
// slot index (two people can't take one slot).
//
// Throws BookingError(status, message) for anything the caller should show
// to the user; any other error is unexpected (caller returns 500).

const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { sendAppointmentNotification, sendAdminBookingNotification } = require('./sendEmail');

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

  // Step 1b: If booking for family member, validate family member name
  if (bookedFor === 'family' && !familyMemberName) {
    throw new BookingError(400, 'Please provide the family member name when booking for a family member');
  }

  // Step 1c: Require teleconsultation consent (legal requirement)
  if (!consentGiven) {
    throw new BookingError(400, 'Consent to the teleconsultation terms is required to book an appointment');
  }

  // Step 2: Verify the doctor exists and is actually a doctor
  const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
  if (!doctor) {
    throw new BookingError(404, 'Doctor not found');
  }

  // Step 2b: Reject dates the doctor has blocked (vacation / day off).
  // Slot generation already hides these, but this guard stops a direct API
  // call from booking a blocked date the UI would never have offered.
  if ((doctor.blockedDates || []).some((b) => b.date === date)) {
    throw new BookingError(400, 'The doctor is not available on this date. Please choose another day.');
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

  // Step 4: Check the appointment date is not in the past (IST timezone)
  if (date < todayIST()) {
    throw new BookingError(400, 'Cannot book appointments in the past');
  }

  // Step 5: Validate follow-up eligibility
  if (isFollowUp && originalAppointmentId) {
    const originalApt = await Appointment.findById(originalAppointmentId);
    if (!originalApt || !originalApt.followUpDeadline || new Date() > new Date(originalApt.followUpDeadline)) {
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
    reason,
    symptoms: cleanSymptoms,
    consultationType: consultationType || 'in-person',
    status: 'pending',
    bookedFor: bookedFor || 'self',
    familyMemberName: bookedFor === 'family' ? familyMemberName : '',
    isFollowUp: isFollowUp || false,
    paymentStatus: isFollowUp ? 'paid' : 'pending', // Follow-ups skip payment
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
  const patient = await User.findById(patientId).select('name phone email patientId');
  sendAppointmentNotification(doctor, patient, appointment);
  sendAdminBookingNotification(doctor, patient, appointment);

  return { appointment, doctor, patient };
}

module.exports = { createBooking, BookingError, todayIST };
