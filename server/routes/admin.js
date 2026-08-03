// ============================================
// Admin Routes - Admin-only endpoints
// ============================================
// All routes here require: login + admin role

const express = require('express');
const router = express.Router();

const { getStats, getAllUsers, getAllAppointments, deleteUser } = require('../controllers/adminController');
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

// DELETE /api/admin/users/:id - Remove a user
router.delete('/users/:id', deleteUser);

module.exports = router;
