// ============================================
// Admin Routes - Admin-only endpoints
// ============================================
// All routes here require: login + admin role

const express = require('express');
const router = express.Router();

const { getStats, getAllUsers, getAllAppointments, deleteUser, setUserSuspension, setDoctorVerification, getAnalytics, migrateBase64Images, generateResetLink, findDuplicatePhones, freeUpContactInfo, backfillPatientIds, backfillDoctorLanguages, sendDoctorSetupReminder, markEmailVerified } = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect);
router.use(authorize('admin'));

// GET /api/admin/stats - Overview numbers
router.get('/stats', getStats);

// GET /api/admin/users - All users (with search/filter)
router.get('/users', getAllUsers);

// GET /api/admin/appointments - All appointments (with filter)
router.get('/appointments', getAllAppointments);

// DELETE /api/admin/users/:id - Remove a user (permanent)
router.delete('/users/:id', deleteUser);

// PUT /api/admin/users/:id/suspension - Deactivate/reactivate a user (keeps records)
router.put('/users/:id/suspension', setUserSuspension);

// PUT /api/admin/users/:id/verify - Mark/unmark a doctor as "Verified by ProMedicoz"
router.put('/users/:id/verify', setDoctorVerification);

// GET /api/admin/analytics - Revenue and consultation insights
router.get('/analytics', getAnalytics);

// POST /api/admin/migrate-images - one-time base64 → Cloudinary migration
router.post('/migrate-images', migrateBase64Images);

// POST /api/admin/users/:id/reset-link - generate/relay a password reset link
// (manual account-recovery assist for phone-only patients with no email on file)
router.post('/users/:id/reset-link', generateResetLink);

// GET /api/admin/duplicate-phones - data integrity check (read-only)
router.get('/duplicate-phones', findDuplicatePhones);

// POST /api/admin/users/:id/free-contact-info - non-destructive duplicate
// resolution: renames a DELETED account's phone/email out of the way
// (keeps the record + all its history) instead of permanently deleting it
router.post('/users/:id/free-contact-info', freeUpContactInfo);

// POST /api/admin/backfill-patient-ids - one-time: assign a Patient ID to
// any existing patient who registered before this field existed
router.post('/backfill-patient-ids', backfillPatientIds);

// POST /api/admin/backfill-doctor-languages - one-time: set a default
// languagesSpoken (Hindi + English) on doctors who registered before the
// field existed and haven't set any yet. Idempotent; never overwrites a
// doctor who already chose their own languages.
router.post('/backfill-doctor-languages', backfillDoctorLanguages);

// POST /api/admin/users/:id/setup-reminder - email an incomplete doctor a
// nudge listing the onboarding steps they still need to finish
router.post('/users/:id/setup-reminder', sendDoctorSetupReminder);

// POST /api/admin/users/:id/verify-email - admin bypass for a doctor whose
// verification email landed in spam: marks their email verified so they go live
router.post('/users/:id/verify-email', markEmailVerified);

module.exports = router;
