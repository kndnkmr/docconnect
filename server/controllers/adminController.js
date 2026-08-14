// ============================================
// Admin Controller - Admin Panel Logic
// ============================================
// Only users with role: 'admin' can access these.
// Provides overview of all users, appointments, and stats.

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const CallLog = require('../models/CallLog');
const MedicalReport = require('../models/MedicalReport');
const { uploadFile } = require('../utils/uploadFile');

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

// ============================================
// SET USER SUSPENSION - Deactivate / Reactivate
// ============================================
// Endpoint: PUT /api/admin/users/:id/suspension
// Body: { suspend: true|false, reason?: string }
//
// Unlike delete, this keeps ALL records intact. A suspended doctor is:
//   - Hidden from patients (removed from listings and profile pages)
//   - Blocked from logging in
// Reactivating restores full access.

const setUserSuspension = async (req, res) => {
  try {
    const { suspend, reason } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow suspending admin accounts
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot suspend admin accounts' });
    }

    user.isSuspended = !!suspend;
    user.suspendedAt = suspend ? new Date() : null;
    user.suspendedReason = suspend ? (reason || '') : '';
    await user.save({ validateModifiedOnly: true });

    res.json({
      message: suspend
        ? `"${user.name}" has been deactivated. Their records are preserved.`
        : `"${user.name}" has been reactivated.`,
      user: {
        _id: user._id,
        name: user.name,
        isSuspended: user.isSuspended,
        suspendedAt: user.suspendedAt
      }
    });

  } catch (error) {
    console.error('Set user suspension error:', error.message);
    res.status(500).json({ message: 'Error updating account status' });
  }
};

// ============================================
// GET ANALYTICS - Revenue and consultation insights
// ============================================
// Endpoint: GET /api/admin/analytics

const getAnalytics = async (req, res) => {
  try {
    // Total revenue (sum of all paid appointments)
    const revenueResult = await Appointment.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amountCollected' }, count: { $sum: 1 } } }
    ]);
    const totalRevenue = revenueResult[0]?.totalRevenue || 0;
    const totalPaidAppointments = revenueResult[0]?.count || 0;

    // Revenue per doctor
    const revenueByDoctor = await Appointment.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: '$doctor', revenue: { $sum: '$amountCollected' }, appointments: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctorInfo' } },
      { $unwind: '$doctorInfo' },
      { $project: { doctorName: '$doctorInfo.name', specialization: '$doctorInfo.specialization', revenue: 1, appointments: 1 } },
      { $sort: { revenue: -1 } }
    ]);

    // Consultation type breakdown
    const consultationTypes = await Appointment.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: '$consultationType', count: { $sum: 1 } } }
    ]);

    // Top doctors by bookings
    const topDoctors = await Appointment.aggregate([
      { $group: { _id: '$doctor', totalBookings: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctorInfo' } },
      { $unwind: '$doctorInfo' },
      { $project: { doctorName: '$doctorInfo.name', specialization: '$doctorInfo.specialization', totalBookings: 1, completed: 1 } },
      { $sort: { totalBookings: -1 } },
      { $limit: 10 }
    ]);

    // Recent payments
    const recentPayments = await Appointment.find({ paymentStatus: 'paid' })
      .populate('doctor', 'name specialization')
      .populate('patient', 'name phone')
      .sort({ paidAt: -1 })
      .limit(10)
      .select('doctor patient amountCollected paidAt date timeSlot consultationType');

    // In-app call stats (only completed logs with a duration)
    const callTotals = await CallLog.aggregate([
      { $match: { endedAt: { $ne: null } } },
      { $group: { _id: null, totalCalls: { $sum: 1 }, totalSeconds: { $sum: '$durationSeconds' } } }
    ]);
    const totalCalls = callTotals[0]?.totalCalls || 0;
    const totalCallMinutes = Math.round((callTotals[0]?.totalSeconds || 0) / 60);

    // Calls + minutes per doctor
    const callsByDoctor = await CallLog.aggregate([
      { $match: { endedAt: { $ne: null } } },
      { $group: { _id: '$doctor', calls: { $sum: 1 }, seconds: { $sum: '$durationSeconds' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'doctorInfo' } },
      { $unwind: '$doctorInfo' },
      { $project: { doctorName: '$doctorInfo.name', specialization: '$doctorInfo.specialization', calls: 1, minutes: { $round: [{ $divide: ['$seconds', 60] }, 0] } } },
      { $sort: { calls: -1 } }
    ]);

    res.json({
      revenue: {
        total: totalRevenue,
        totalPaidAppointments,
        byDoctor: revenueByDoctor
      },
      consultationTypes,
      topDoctors,
      recentPayments,
      calls: {
        totalCalls,
        totalCallMinutes,
        byDoctor: callsByDoctor
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error.message);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
};

// ============================================
// MIGRATE BASE64 IMAGES → Cloudinary (admin, one-time)
// ============================================
// Endpoint: POST /api/admin/migrate-images
// Moves any legacy base64 images (doctor QR/photo, payment screenshots, reports)
// to Cloudinary and replaces the stored value with the URL. Idempotent: only
// touches values still starting with "data:". Runs on the server where the
// Cloudinary credentials already live, so no local setup is needed.

const parseDataUri = (v) => {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(v || '');
  return m ? { mimetype: m[1], buffer: Buffer.from(m[2], 'base64') } : null;
};
const isBase64 = (v) => typeof v === 'string' && v.startsWith('data:');

const migrateBase64Images = async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(400).json({ message: 'Cloudinary is not configured on the server.' });
    }

    let migrated = 0;
    let failed = 0;

    // Doctors: QR codes + profile photos
    const users = await User.find({ $or: [{ upiQrCode: /^data:/ }, { profilePhoto: /^data:/ }] });
    for (const u of users) {
      for (const [field, folder] of [['upiQrCode', 'promedicoz/qr'], ['profilePhoto', 'promedicoz/profile']]) {
        if (isBase64(u[field])) {
          const p = parseDataUri(u[field]);
          if (p) {
            const url = await uploadFile(p.buffer, p.mimetype, folder);
            if (url && url.startsWith('http')) { u[field] = url; migrated++; } else { failed++; }
          }
        }
      }
      await u.save({ validateBeforeSave: false });
    }

    // Appointments: payment screenshots
    const appts = await Appointment.find({ paymentScreenshot: /^data:/ });
    for (const a of appts) {
      const p = parseDataUri(a.paymentScreenshot);
      if (p) {
        const url = await uploadFile(p.buffer, p.mimetype, 'promedicoz/payments');
        if (url && url.startsWith('http')) { a.paymentScreenshot = url; migrated++; await a.save(); } else { failed++; }
      }
    }

    // Medical reports
    const reports = await MedicalReport.find({ filePath: /^data:/ });
    for (const r of reports) {
      const p = parseDataUri(r.filePath);
      if (p) {
        const url = await uploadFile(p.buffer, p.mimetype, 'promedicoz/reports');
        if (url && url.startsWith('http')) { r.filePath = url; migrated++; await r.save(); } else { failed++; }
      }
    }

    res.json({ message: 'Image migration complete', migrated, failed });
  } catch (error) {
    console.error('Migrate images error:', error.message);
    res.status(500).json({ message: 'Migration failed' });
  }
};

module.exports = { getStats, getAllUsers, getAllAppointments, deleteUser, setUserSuspension, getAnalytics, migrateBase64Images };
