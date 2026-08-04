// ============================================
// Appointment Routes - Booking URL endpoints
// ============================================
// All appointment routes are PROTECTED (login required).
// Some are further restricted by role.
//
// ENDPOINTS:
//   POST   /api/appointments           → patient books an appointment
//   GET    /api/appointments/my        → get my appointments (patient or doctor)
//   GET    /api/appointments/:id       → view single appointment details
//   PUT    /api/appointments/:id/status → doctor updates status (confirm/complete)
//   PUT    /api/appointments/:id/cancel → patient cancels their booking
//
// NOTE: All routes use "protect" middleware — no anonymous access.

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
  markPayment
} = require('../controllers/appointmentController');

// Import middleware
const { protect, authorize } = require('../middleware/auth');

// ---- All routes below require login ----
// Instead of adding "protect" to each route individually,
// we can apply it to ALL routes in this router at once:
router.use(protect);
// ^ Every route defined AFTER this line requires a valid token.
// This is cleaner than writing: router.get('/my', protect, getMyAppointments)

// ---- PATIENT: Book an appointment ----
// POST /api/appointments
// Only patients can book (doctors don't book appointments with themselves!)
router.post('/', authorize('patient'), bookAppointment);

// ---- BOTH: Get my appointments ----
// GET /api/appointments/my
// Both doctors and patients can see their own appointments
// The controller handles showing different data based on role
router.get('/my', getMyAppointments);
// No authorize() here — both roles are allowed

// ---- BOTH: View single appointment ----
// GET /api/appointments/:id
// Both can view, but controller checks they're involved in the appointment
router.get('/:id', getAppointmentById);

// ---- DOCTOR: Update appointment status ----
// PUT /api/appointments/:id/status
// Only doctors can confirm/complete appointments
router.put('/:id/status', authorize('doctor'), updateAppointmentStatus);

// ---- PATIENT: Cancel appointment ----
// PUT /api/appointments/:id/cancel
// Only the patient who booked can cancel
router.put('/:id/cancel', authorize('patient'), cancelAppointment);

// ---- DOCTOR: Mark payment received ----
// PUT /api/appointments/:id/payment
router.put('/:id/payment', authorize('doctor'), markPayment);

module.exports = router;

// ============================================
// THE FULL BOOKING FLOW:
// ============================================
//
// 1. Patient browses doctors → GET /api/doctors?specialization=Cardiology
//
// 2. Patient picks a doctor → GET /api/doctors/:doctorId (view profile)
//
// 3. Patient books → POST /api/appointments
//    Body: { doctorId, date, timeSlot: "10:00 AM - 10:30 AM", reason: "Chest pain" }
//    Result: appointment created with status "pending"
//
// 4. Doctor checks their appointments → GET /api/appointments/my?status=pending
//    Sees the new booking request
//
// 5. Doctor confirms → PUT /api/appointments/:id/status
//    Body: { status: "confirmed" }
//
// 6. After consultation → PUT /api/appointments/:id/status
//    Body: { status: "completed", notes: "Prescribed medication X" }
//
// OR at any point:
//    Patient cancels → PUT /api/appointments/:id/cancel
//    Doctor cancels → PUT /api/appointments/:id/status { status: "cancelled" }
// ============================================
