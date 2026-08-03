// ============================================
// Admin Controller - Admin Panel Logic
// ============================================
// Only users with role: 'admin' can access these.
// Provides overview of all users, appointments, and stats.

const User = require('../models/User');
const Appointment = require('../models/Appointment');

// ============================================
// GET STATS - Dashboard overview numbers
// ============================================
// Endpoint: GET /api/admin/stats

const getStats = async (req, res) => {
  try {
    const totalDoctors = await User.countDocuments({ role: 'doctor' });
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalAppointments = await Appointment.countDocuments();
    const pendingAppointments = await Appointment.countDocuments({ status: 'pending' });
    const confirmedAppointments = await Appointment.countDocuments({ status: 'confirmed' });
    const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
    const cancelledAppointments = await Appointment.countDocuments({ status: 'cancelled' });

    res.json({
      stats: {
        totalDoctors,
        totalPatients,
        totalUsers: totalDoctors + totalPatients,
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        completedAppointments,
        cancelledAppointments
      }
    });

  } catch (error) {
    console.error('Get stats error:', error.message);
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

// ============================================
// GET ALL USERS - List all registered users
// ============================================
// Endpoint: GET /api/admin/users?role=doctor&page=1&limit=20

const getAllUsers = async (req, res) => {
  try {
    const filter = {};

    // Optional role filter
    if (req.query.role) {
      filter.role = req.query.role;
    }

    // Search by name or email
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalUsers: total
      }
    });

  } catch (error) {
    console.error('Get all users error:', error.message);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// ============================================
// GET ALL APPOINTMENTS - List all bookings
// ============================================
// Endpoint: GET /api/admin/appointments?status=pending&page=1&limit=20

const getAllAppointments = async (req, res) => {
  try {
    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const appointments = await Appointment.find(filter)
      .populate('doctor', 'name specialization phone')
      .populate('patient', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Appointment.countDocuments(filter);

    res.json({
      appointments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalAppointments: total
      }
    });

  } catch (error) {
    console.error('Get all appointments error:', error.message);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
};

// ============================================
// DELETE USER - Remove a user account
// ============================================
// Endpoint: DELETE /api/admin/users/:id

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow deleting admin accounts
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin accounts' });
    }

    await User.findByIdAndDelete(req.params.id);

    // Also delete their appointments
    if (user.role === 'patient') {
      await Appointment.deleteMany({ patient: req.params.id });
    } else if (user.role === 'doctor') {
      await Appointment.deleteMany({ doctor: req.params.id });
    }

    res.json({ message: `User "${user.name}" deleted successfully` });

  } catch (error) {
    console.error('Delete user error:', error.message);
    res.status(500).json({ message: 'Error deleting user' });
  }
};

module.exports = { getStats, getAllUsers, getAllAppointments, deleteUser };
