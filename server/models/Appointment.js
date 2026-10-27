// ============================================
// Appointment Model - The shape of booking data
// ============================================
// This defines what an appointment looks like in MongoDB.
// Each appointment connects a PATIENT to a DOCTOR at a specific DATE/TIME.
//
// KEY CONCEPT: "References" (linking documents together)
// Instead of copying all doctor info into every appointment,
// we just store the doctor's ID. When we need full details,
// we use .populate() to "fill in" the referenced data.
// This is like storing a phone number vs the whole contact card.

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({

  // ---- WHO is the patient? ----
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    // ObjectId = a reference to another document in the database
    // It stores just the ID (like "65a1b2c3d4e5f6..."), not the full user data

    ref: 'User',
    // "ref" tells Mongoose: "This ID belongs to the User collection"
    // Later, we can use .populate('patient') to get the full patient details

    required: [true, 'Patient is required']
  },

  // ---- WHO is the doctor? ----
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor is required']
  },

  // ---- WHEN is the appointment? ----
  date: {
    type: Date,
    // JavaScript Date type — stores both date AND time
    // Example: "2024-03-15T10:30:00.000Z"
    required: [true, 'Appointment date is required']
  },

  // ---- Time slot (human-readable) ----
  timeSlot: {
    type: String,
    required: [true, 'Time slot is required']
    // Example: "10:00 AM - 10:30 AM"
    // We store this as a string for display purposes
  },

  // ---- WHAT is the status? ----
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    // The lifecycle of an appointment:
    //   pending    → patient just booked, waiting for doctor to accept
    //   confirmed  → doctor accepted the appointment
    //   completed  → appointment happened successfully
    //   cancelled  → either party cancelled
    default: 'pending'
  },

  // ---- WHO is this appointment for? ----
  // "self" = the patient themselves, "family" = a family member
  bookedFor: {
    type: String,
    enum: ['self', 'family'],
    default: 'self'
  },

  // If booked for a family member, store their name for display
  familyMemberName: {
    type: String,
    default: ''
  },

  // If this is a repeat booking, reference the original appointment
  originalAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },

  // ---- WHY is the patient visiting? ----
  reason: {
    type: String,
    required: [true, 'Reason for visit is required'],
    trim: true
    // Example: "Chest pain for the last 2 days", "Annual checkup"
  },

  // ---- Structured symptom tags (optional, supplements `reason`) ----
  // Quick-scannable for the doctor before even opening the free-text
  // reason - picked from a fixed common-symptoms list on the booking form.
  // Kept separate from `reason` rather than replacing it: `reason` stays
  // the patient's own words/detail, this is just a fast-glance summary.
  symptoms: {
    type: [String],
    default: []
  },

  // ---- Additional notes ----
  notes: {
    type: String,
    default: ''
    // Doctor can add notes after the consultation
    // Example: "Prescribed medication X, follow up in 2 weeks"
  },

  // ---- Consultation type ----
  consultationType: {
    type: String,
    enum: ['in-person', 'video', 'phone'],
    default: 'in-person'
    // Modern healthcare offers multiple consultation modes
  },

  // ---- Payment status ----
  paymentStatus: {
    type: String,
    enum: ['pending', 'patient_claimed', 'paid'],
    default: 'pending'
  },

  // ---- Amount actually collected ----
  amountCollected: {
    type: Number,
    default: 0,
    // Actual fee received (may differ from doctor's listed consultationFee)
    min: [0, 'Amount collected cannot be negative']
  },

  // ---- Payment date ----
  paidAt: {
    type: Date,
    default: null
    // When the payment was marked as received
  },

  // ---- Meeting link (for video/phone consultations) ----
  meetingLink: {
    type: String,
    default: ''
    // Doctor adds this when confirming the appointment
    // e.g., a Google Meet or Zoom link for video calls
    // Patient sees it in their dashboard after doctor confirms
  },

  // ---- Cancellation reason (if cancelled) ----
  cancellationReason: {
    type: String,
    default: ''
  },

  // ---- Payment screenshot (uploaded by patient as proof) ----
  paymentScreenshot: {
    type: String,
    default: ''
  },

  // ---- Payment recovery trail (see controllers/paymentController.js) ----
  // When the patient said "I've paid" (button, screenshot or UTR).
  paymentClaimedAt: { type: Date, default: null },
  // 12-digit UPI reference (UTR) the patient typed, so the doctor can find
  // the payment in their UPI app without a screenshot.
  paymentUTR: { type: String, default: '' },
  // Last time the PATIENT pressed "Remind doctor" (rate-limited).
  paymentReminderSentAt: { type: Date, default: null },
  // Automatic nudges for an unverified claim: doctor first, then admin.
  paymentDoctorNudgedAt: { type: Date, default: null },
  paymentAdminAlertedAt: { type: Date, default: null },
  // Who marked it paid / reset it, so admin actions are visible later.
  paymentMarkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  paymentMarkedByRole: { type: String, enum: ['', 'doctor', 'admin'], default: '' },
  paymentAdminNote: { type: String, default: '' },

  // ---- "Needs help" follow-ups (utils/journeyReminders.js, utils/needsHelp.js) ----
  // Doctor reminded to confirm a still-pending booking (once).
  confirmReminderSentAt: { type: Date, default: null },
  // Patient reminded to pay (confirmed, unpaid, slot within 2h; once).
  payReminderSentAt: { type: Date, default: null },
  // Admin checked the refund for a paid-then-cancelled appointment.
  refundCheckedAt: { type: Date, default: null },
  refundCheckedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  refundNote: { type: String, default: '' },

  // ---- Free follow-up deadline ----
  // Set by doctor when writing prescription
  // Patient can book a free follow-up before this date
  followUpDeadline: {
    type: Date,
    default: null
  },

  // ---- Is this a follow-up appointment (free, no payment needed) ----
  isFollowUp: {
    type: Boolean,
    default: false
  },

  // ---- Live call signaling (for in-app "ringing" notification) ----
  // When one participant joins the call, callActive is set true and the other
  // participant's dashboard polls and shows an incoming-call banner + ringtone.
  callActive: {
    type: Boolean,
    default: false
  },

  callStartedAt: {
    type: Date,
    default: null
  },

  callStartedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // ---- Clock-based "your call is starting" reminder (dedupe flag) ----
  // Set the first time the scheduled call-start reminder push has been sent
  // for this appointment, so the once-a-minute job (server/utils/callReminder.js)
  // never sends it twice for the same appointment.
  callReminderSentAt: {
    type: Date,
    default: null
  },

  // ---- "Your appointment is coming up" reminder (dedupe flag) ----
  // Set the first time the ~1-hour-before reminder push has been sent for this
  // appointment (server/utils/appointmentReminder.js), so the once-a-minute job
  // never reminds the same appointment twice. Separate from callReminderSentAt,
  // which fires AT the slot start for video/phone calls — this one is the
  // earlier "get ready" nudge and applies to all consultation types.
  reminderSentAt: {
    type: Date,
    default: null
  },

  // When this appointment was marked 'completed' (set by the status-update
  // paths). Used by the review-request job to wait a few hours after the
  // consult before nudging the patient to rate — so the ask lands after they've
  // actually had the consultation, not the instant the doctor clicks complete.
  completedAt: {
    type: Date,
    default: null
  },

  // Set the first (and only) time the "please rate your consultation" push has
  // been sent for this appointment (server/utils/reviewRequest.js), so that
  // once-a-minute job never nudges the same appointment twice. Same idempotency
  // pattern as reminderSentAt / callReminderSentAt.
  reviewRequestSentAt: {
    type: Date,
    default: null
  },

  // ---- Teleconsultation consent (captured at booking, for legal record) ----
  consentGiven: {
    type: Boolean,
    default: false
  },

  consentAt: {
    type: Date,
    default: null
    // Timestamp when the patient accepted the consent terms for THIS booking
  },

  consentIP: {
    type: String,
    default: ''
    // IP address at the time of consent (audit trail)
  },

  // Who gave the consent: the patient in the app ('patient'), or the patient
  // verbally on a call/WhatsApp with ProMedicoz support, recorded by an admin
  // who booked on their behalf ('admin'). consentIP is then the admin's IP.
  consentBy: {
    type: String,
    enum: ['patient', 'admin'],
    default: 'patient'
  },

  // Set when a ProMedicoz admin booked this appointment for the patient
  // (Admin Panel → Help patient → Book). null = booked by the patient.
  bookedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }

}, {
  timestamps: true
  // Adds createdAt (when booked) and updatedAt (when status last changed)
});

// ---- Indexes for performance ----
// Indexes help the database find documents faster (like a book's index)
// Without indexes, MongoDB scans EVERY document (slow with millions of records)

appointmentSchema.index({ patient: 1, date: -1 });
// ^ Makes it fast to find "all appointments for this patient, newest first"

appointmentSchema.index({ doctor: 1, date: -1 });
// ^ Makes it fast to find "all appointments for this doctor, newest first"

// (The plain { doctor, date, timeSlot } index that used to be here was
// removed: an index on the same keys with different options stops MongoDB
// creating the unique double-booking guard below. Slot lookups use the
// { doctor, date } index above. utils/fixIndexes.js drops the old one.)

// ---- Prevent double-booking at the DATABASE level ----
// The booking controller checks "is this slot free?" then creates the
// appointment — but two patients booking the same slot at the same instant can
// both pass that check and both get created (a race condition). This UNIQUE
// index makes the database itself reject a second active booking for the same
// doctor+date+timeSlot, closing the race for good: the second create fails and
// the controller can report the slot as taken.
//
// It's a PARTIAL index: only active appointments (pending / confirmed /
// completed) hold a slot, so a cancelled slot can be re-booked normally.
//
// Why `$gt: 'cancelled'`: MongoDB does not allow $ne (or, before 7.0, $in)
// in a partial index filter, so the earlier `$ne: 'cancelled'` version was
// silently never created. The four statuses sort alphabetically as
//   cancelled < completed < confirmed < pending
// so "status > 'cancelled'" is exactly the three active statuses, using an
// operator every MongoDB version accepts. If a new status is ever added,
// re-check this ordering.
//
// Built/verified on startup by utils/fixIndexes.js (fixSlotIndex), which
// refuses to build it if real duplicate active bookings exist and reports
// them instead. Admin → Overview shows whether the guard is on.
const ACTIVE_SLOT_FILTER = { status: { $gt: 'cancelled' } };
appointmentSchema.index(
  { doctor: 1, date: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: ACTIVE_SLOT_FILTER,
    name: 'unique_active_slot'
  }
);

const Appointment = mongoose.model('Appointment', appointmentSchema);
Appointment.ACTIVE_SLOT_FILTER = ACTIVE_SLOT_FILTER;

module.exports = Appointment;
