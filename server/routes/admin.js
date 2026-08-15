// ============================================
// Admin Routes - Admin-only endpoints
// ============================================
// All routes here require: login + admin role

const express = require('express');
const router = express.Router();

const { getStats, getAllUsers, getAllAppointments, deleteUser, setUserSuspension, setDoctorVerification, getAnalytics, migrateBase64Images, generateResetLink, findDuplicatePhones, freeUpContactInfo, backfillPatientIds } = require('../controllers/adminController');
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

module.exports = router;
