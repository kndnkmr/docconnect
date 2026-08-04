// ============================================
// Prescription Routes
// ============================================
// POST   /api/prescriptions                    → doctor creates prescription (doctor only)
// GET    /api/prescriptions/my                 → get my prescriptions (both roles)
// GET    /api/prescriptions/appointment/:id    → get prescription for specific appointment
// PUT    /api/prescriptions/:id               → doctor updates prescription

const express = require('express');
const router = express.Router();

const {
  createPrescription,
  getPrescriptionByAppointment,
  getMyPrescriptions,
  updatePrescription
} = require('../controllers/prescriptionController');

const { protect, authorize } = require('../middleware/auth');

// All routes require login
router.use(protect);

// Both roles can view their prescriptions
router.get('/my', getMyPrescriptions);

// Both roles can view prescription for a specific appointment
router.get('/appointment/:appointmentId', getPrescriptionByAppointment);

// Doctor only: create and update
router.post('/', authorize('doctor'), createPrescription);
router.put('/:id', authorize('doctor'), updatePrescription);

module.exports = router;
