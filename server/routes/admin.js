// ============================================
// Admin Routes - Admin-only endpoints
// ============================================
// All routes here require: login + admin role

const express = require('express');
const router = express.Router();

const { getStats, getAllUsers, getAllAppointments, deleteUser, setUserSuspension, getAnalytics } = require('../controllers/adminController');
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

// GET /api/admin/analytics - Revenue and consultation insights
router.get('/analytics', getAnalytics);

module.exports = router;
