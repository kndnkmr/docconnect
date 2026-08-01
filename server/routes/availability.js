// ============================================
// Availability Routes - Time Slot Management
// ============================================
// ENDPOINTS:
//   PUT  /api/availability            → doctor sets their weekly schedule (protected, doctor only)
//   GET  /api/availability            → doctor views their schedule (protected, doctor only)
//   GET  /api/availability/:doctorId/slots?date=YYYY-MM-DD → get free slots (public)
//
// NOTE: The free slots endpoint is PUBLIC — patients don't need to be logged in
// to check a doctor's availability. They only need to log in to BOOK.

const express = require('express');
const router = express.Router();

const {
  setAvailability,
  getMyAvailability,
  getFreeSlots
} = require('../controllers/availabilityController');

const { protect, authorize } = require('../middleware/auth');

// ---- PUBLIC ROUTE ----
// GET /api/availability/:doctorId/slots?date=2024-03-15
// Anyone can check available time slots for a doctor on a specific date
// This is called from the BookAppointment page
router.get('/:doctorId/slots', getFreeSlots);

// ---- PROTECTED ROUTES (doctor only) ----

// GET /api/availability
// Doctor views their own availability schedule
router.get('/', protect, authorize('doctor'), getMyAvailability);

// PUT /api/availability
// Doctor sets/updates their weekly availability
router.put('/', protect, authorize('doctor'), setAvailability);

module.exports = router;
