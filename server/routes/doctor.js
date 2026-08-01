// ============================================
// Doctor Routes - URL endpoints for doctor profiles
// ============================================
// These routes handle doctor profile browsing and management.
//
// KEY CONCEPT: Some routes are PUBLIC (anyone can view), some are PROTECTED (login required)
//
// PUBLIC routes (no login needed):
//   GET /api/doctors         → browse all doctors (with search & pagination)
//   GET /api/doctors/:id     → view a specific doctor's profile
//
// PROTECTED routes (must be logged in AS A DOCTOR):
//   PUT /api/doctors/profile → update your own profile

const express = require('express');
const router = express.Router();

// Import controller functions
const {
  getAllDoctors,
  getDoctorById,
  updateDoctorProfile
} = require('../controllers/doctorController');

// Import middleware
const { protect, authorize } = require('../middleware/auth');
// protect = checks if user is logged in
// authorize = checks if user has the right role

// Import upload middleware (for profile photo uploads)
const { upload } = require('../middleware/upload');

// ---- PUBLIC ROUTES ----

// GET /api/doctors
// Anyone can browse doctors (patients searching for a doctor)
// Supports query params: ?specialization=Cardiology&name=Smith&page=1&limit=10
router.get('/', getAllDoctors);

// GET /api/doctors/:id
// Anyone can view a doctor's full profile
// ":id" is a placeholder — the actual URL would be like /api/doctors/65a1b2c3...
router.get('/:id', getDoctorById);

// ---- PROTECTED ROUTES ----

// PUT /api/doctors/profile
// Only logged-in doctors can update their profile
// Middleware chain: protect → authorize('doctor') → upload → controller
//
// The order matters! Each runs in sequence:
// 1. protect: "Are you logged in?" → if no, stops here (401 error)
// 2. authorize('doctor'): "Are you a doctor?" → if no, stops here (403 error)
// 3. upload.single('profilePhoto'): "Is there a file attached?" → processes it
// 4. updateDoctorProfile: finally runs the update logic
router.put(
  '/profile',
  protect,
  authorize('doctor'),
  upload.single('profilePhoto'),
  // ^ 'profilePhoto' = the field name the frontend uses when sending the file
  // .single() means "expect ONE file" (not multiple)
  updateDoctorProfile
);

module.exports = router;

// ============================================
// ROUTE ORDER NOTE:
// ============================================
// PUT /profile is defined BEFORE GET /:id
// Why? Because Express matches routes top to bottom.
// If /:id came first, "profile" would be treated as an ID!
// Express would think you're looking for a doctor with ID "profile".
//
// RULE: Put specific routes (like /profile) BEFORE parameter routes (like /:id)
// ============================================
