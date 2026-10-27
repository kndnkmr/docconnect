// ============================================
// Admin Controller - Admin Panel Logic
// ============================================
// Only users with role: 'admin' can access these.
// Provides overview of all users, appointments, and stats.

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const CallLog = require('../models/CallLog');
const MedicalReport = require('../models/MedicalReport');
const { getNextSequence } = require('../models/Counter');
const { uploadFile } = require('../utils/uploadFile');
const crypto = require('crypto');
const { sendEmail, sendAppointmentConfirmation } = require('../utils/sendEmail');
const { sendPushToUser } = require('../utils/push');
const { fixEmailIndex } = require('../utils/fixIndexes');
const { safeContainsRegex, getPagination } = require('../utils/queryHelpers');

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

    // Search by name, email, phone, or (for patients) Patient ID
    if (req.query.search) {
      const searchRegex = safeContainsRegex(req.query.search);
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { patientId: searchRegex }
      ];
    }

    // Pagination
    const { page, limit, skip } = getPagination(req, { defaultLimit: 20 });

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

    const { page, limit, skip } = getPagination(req, { defaultLimit: 20 });

    const appointments = await Appointment.find(filter)
      .populate('doctor', 'name specialization phone')
      .populate('patient', 'name email phone patientId')
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
// CONFIRM APPOINTMENT (admin, on the doctor's behalf)
// ============================================
// Endpoint: PUT /api/admin/appointments/:id/confirm
// Body: { meetingLink? }
//
// Doctors sometimes forget to confirm a pending appointment. This lets the
// admin confirm it for them. It deliberately does NOT reuse the doctor-only
// PUT /api/appointments/:id/status (that endpoint hard-blocks anyone who isn't
// the owning doctor). It enforces the same pending→confirmed rule and fires the
// SAME patient-facing side effects (confirmation email + push) the doctor path
// uses, so the patient's experience is identical.
const confirmAppointmentAsAdmin = async (req, res) => {
  try {
    const { meetingLink } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Only a pending appointment can be confirmed (same rule as the doctor path).
    if (appointment.status !== 'pending') {
      return res.status(400).json({
        message: `Only pending appointments can be confirmed. This one is "${appointment.status}".`
      });
    }

    appointment.status = 'confirmed';
    if (meetingLink) appointment.meetingLink = meetingLink;
    appointment.markModified('status');
    await appointment.save({ validateModifiedOnly: true });

    // Populate the fields the confirmation email/push need (doctor email +
    // fee for the template; patient email for the email, _id for the push).
    await appointment.populate('doctor', 'name specialization consultationFee email');
    await appointment.populate('patient', 'name email phone patientId');

    // Identical side effects to the doctor-confirm path — so the patient gets
    // the same confirmation they'd get if the doctor had clicked confirm.
    sendAppointmentConfirmation(appointment.patient, appointment.doctor, appointment);
    sendPushToUser(appointment.patient._id, {
      title: 'Appointment confirmed',
      body: `Dr. ${appointment.doctor.name} confirmed your appointment on ${new Date(appointment.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${appointment.timeSlot}.`,
      url: '/dashboard',
      tag: `appointment-${appointment._id}`
    });

    res.json({
      message: `Appointment confirmed on behalf of Dr. ${appointment.doctor.name}. The patient has been notified.`,
      appointment
    });
  } catch (error) {
    console.error('Admin confirm appointment error:', error.message);
    res.status(500).json({ message: 'Error confirming appointment' });
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
// SET DOCTOR VERIFICATION - "Verified by ProMedicoz" trust badge
// ============================================
// Endpoint: PUT /api/admin/users/:id/verify
// Body: { verified: true|false }
//
// Manually set by an admin after checking the doctor's credentials. This is
// NOT automatic — the badge only shows for doctors an admin has actually
// reviewed, so it stays honest rather than showing for everyone by default.

const setDoctorVerification = async (req, res) => {
  try {
    const { verified } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'doctor') {
      return res.status(400).json({ message: 'Only doctors can be verified' });
    }

    user.isAdminVerified = !!verified;
    user.adminVerifiedAt = verified ? new Date() : null;
    await user.save({ validateModifiedOnly: true });

    res.json({
      message: verified ? `"${user.name}" marked as verified` : `Verification removed for "${user.name}"`,
      user: { _id: user._id, name: user.name, isAdminVerified: user.isAdminVerified }
    });
  } catch (error) {
    console.error('Set doctor verification error:', error.message);
    res.status(500).json({ message: 'Error updating verification status' });
  }
};

// ============================================
// FIND DUPLICATE PHONES - Data integrity check (read-only)
// ============================================
// Endpoint: GET /api/admin/duplicate-phones
//
// `phone` has no unique index (only `email` does), and a formatting bug in
// register() used to let two accounts end up sharing the same real phone
// number (see authController.js register() for the fix + full explanation).
// This surfaces any such duplicates so an admin can review and resolve each
// one manually (e.g. via the existing Delete/Deactivate actions) - this
// endpoint only reads data, it never modifies anything itself.

const findDuplicatePhones = async (req, res) => {
  try {
    const duplicates = await User.aggregate([
      { $match: { phone: { $nin: ['', null] } } },
      { $group: { _id: '$phone', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);

    if (duplicates.length === 0) {
      return res.json({ duplicates: [] });
    }

    const allIds = duplicates.flatMap((d) => d.ids);
    const users = await User.find({ _id: { $in: allIds } })
      .select('name email phone patientId role isDeleted isSuspended deletedAt createdAt');

    const byId = {};
    users.forEach((u) => { byId[u._id.toString()] = u; });

    const groups = duplicates.map((d) => ({
      phone: d._id,
      accounts: d.ids.map((id) => byId[id.toString()]).filter(Boolean)
    }));

    res.json({ duplicates: groups });
  } catch (error) {
    console.error('Find duplicate phones error:', error.message);
    res.status(500).json({ message: 'Error checking for duplicate phone numbers' });
  }
};

// ============================================
// FREE UP CONTACT INFO - Non-destructive duplicate resolution / re-registration reset
// ============================================
// Endpoint: POST /api/admin/users/:id/free-contact-info
//
// The permanent Delete action removes the account AND cascade-deletes all
// of their appointments - too destructive both for resolving a duplicate-
// account bug AND for the common "let this person re-register fresh with
// the same phone/email" case (e.g. a doctor's profile needs to be redone
// from scratch). This does the SAME thing register() already does
// automatically when it detects a deleted account blocking a new signup:
// rename the phone/email out of the way with a "deleted_<time>_" prefix,
// freeing that contact info for a new registration to use. The record
// itself, and all of its appointments/prescriptions/reports, are left
// completely untouched either way.
//
// Two cases:
//   - Already soft-deleted (isDeleted: true): just frees the contact info
//     (unchanged from before) - this is the duplicate-account cleanup case.
//   - Still active: ALSO deactivates it (isSuspended: true) as part of the
//     same action - an active account with its contact info renamed out
//     from under it would otherwise be a confusing half-state (still
//     "active" per the system, but unreachable and no longer really them).
//     This is the "reset for re-registration" case.

const freeUpContactInfo = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot modify admin accounts' });
    }

    const wasActive = !user.isDeleted;

    const stamp = Date.now();
    if (user.phone && !user.phone.startsWith('deleted_')) {
      user.phone = `deleted_${stamp}_${user.phone}`;
    }
    if (user.email && !user.email.startsWith('deleted_')) {
      user.email = `deleted_${stamp}_${user.email}`;
    }

    if (wasActive) {
      user.isSuspended = true;
      user.suspendedAt = new Date();
      user.suspendedReason = user.suspendedReason || 'Contact info freed up for re-registration by admin';
    }

    await user.save({ validateBeforeSave: false });

    res.json({
      message: wasActive
        ? `"${user.name}" has been deactivated and their phone/email freed up — they (or someone else) can now register fresh with the same details. All existing appointment/prescription/report history is untouched.`
        : `Freed up "${user.name}"'s phone/email for reuse. The account and all its history (appointments, prescriptions, reports) are untouched.`
    });
  } catch (error) {
    console.error('Free up contact info error:', error.message);
    res.status(500).json({ message: 'Error freeing up contact info' });
  }
};

// ============================================
// GENERATE RESET LINK - Manual account-recovery assist
// ============================================
// Endpoint: POST /api/admin/users/:id/reset-link
//
// For patients who registered with phone-only (no email), the self-service
// "forgot password" flow has no automatic way to deliver the link (no SMS
// gateway configured). This gives an admin a way to generate a valid reset
// link on the patient's behalf — after verifying their identity some other
// way (e.g. a phone call) — and relay it manually (e.g. via WhatsApp).
// If the account DOES have an email on file, we also email it automatically
// as a convenience, so this doubles as a "resend" tool too.

const generateResetLink = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save({ validateBeforeSave: false });

    const resetUrl = `https://www.promedicoz.in/reset-password/${resetToken}`;

    let emailed = false;
    if (user.email) {
      const result = await sendEmail({
        to: user.email,
        subject: 'Reset Your ProMedicoz Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 20px;">🏥 ProMedicoz</h1>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1f2937;">Reset Your Password</h2>
              <p style="color: #4b5563;">Our support team generated a password reset link for your account. Click below to set a new password.</p>
              <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">
                Reset My Password
              </a>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">This link expires in 30 minutes.</p>
            </div>
          </div>
        `
      });
      emailed = !!result.success;
    }

    res.json({
      message: emailed
        ? `Reset link generated and emailed to "${user.name}". You can also copy the link below to send it directly (e.g. via WhatsApp).`
        : `Reset link generated for "${user.name}" (no email on file). Copy the link below and send it to them manually, e.g. via WhatsApp.`,
      resetUrl,
      emailed,
      expiresInMinutes: 30
    });
  } catch (error) {
    console.error('Generate reset link error:', error.message);
    res.status(500).json({ message: 'Error generating reset link' });
  }
};

// ============================================
// SEND DOCTOR SETUP REMINDER
// ============================================
// Endpoint: POST /api/admin/users/:id/setup-reminder
// Emails an incomplete doctor a friendly nudge listing exactly what's still
// missing (verify email / set availability / complete profile) so they can
// finish onboarding and become visible/bookable to patients.

// Shared helper so the admin list and this reminder agree on what "complete"
// means. Returns the list of still-missing setup steps for a doctor.
const getDoctorMissingSteps = (user) => {
  const missing = [];
  if (user.email && !user.isVerified) missing.push('verify your email address');
  if (!user.availability || user.availability.length === 0) missing.push('set your weekly availability');
  if (!user.specialization || !user.consultationFee) missing.push('complete your profile (specialization & consultation fee)');
  return missing;
};

// ============================================
// MARK EMAIL VERIFIED (admin bypass)
// ============================================
// Endpoint: POST /api/admin/users/:id/verify-email
// Sets isVerified = true directly. This is the EMAIL-verified flag that
// gates whether a doctor is visible/bookable by patients — distinct from
// isAdminVerified (the trust badge). Needed because verification emails can
// land in spam, leaving a legitimate doctor stuck and invisible. When the
// admin has confirmed the doctor is real out-of-band, this makes them live
// without waiting on the email link.

const markEmailVerified = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: `"${user.name}"'s email is already verified.` });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpire = undefined;
    await user.save({ validateBeforeSave: false });

    res.json({
      message: `"${user.name}"'s email marked as verified. If their profile and availability are complete, they're now live and visible to patients.`,
      user: { _id: user._id, name: user.name, isVerified: true }
    });
  } catch (error) {
    console.error('Mark email verified error:', error.message);
    res.status(500).json({ message: 'Error marking email verified' });
  }
};

const sendDoctorSetupReminder = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'doctor') {
      return res.status(400).json({ message: 'Setup reminders are only for doctors' });
    }

    const missing = getDoctorMissingSteps(user);
    if (missing.length === 0) {
      return res.status(400).json({ message: `"${user.name}" has already completed their setup.` });
    }

    if (!user.email) {
      return res.status(400).json({
        message: `"${user.name}" has no email on file, so a reminder can't be emailed. Please reach out via phone/WhatsApp instead.`,
        missing
      });
    }

    const stepsHtml = missing.map((s) => `<li style="margin-bottom: 6px;">${s.charAt(0).toUpperCase() + s.slice(1)}</li>`).join('');
    const result = await sendEmail({
      to: user.email,
      subject: 'Finish setting up your ProMedicoz profile',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 20px;">🏥 ProMedicoz</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">You're almost there, Dr. ${user.name}!</h2>
            <p style="color: #4b5563;">Your ProMedicoz account is created, but patients can't find or book you yet because a few steps are still pending:</p>
            <ul style="color: #1f2937; padding-left: 20px;">${stepsHtml}</ul>
            <p style="color: #4b5563;">It only takes a couple of minutes — log in to finish and start receiving appointments.</p>
            <a href="https://www.promedicoz.in/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">
              Complete My Setup
            </a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">If you've already done this, please ignore this email.</p>
          </div>
        </div>
      `
    });

    res.json({
      message: result.success
        ? `Setup reminder emailed to "${user.name}" (${missing.length} step${missing.length > 1 ? 's' : ''} pending).`
        : `Could not send the email right now. Pending steps: ${missing.join(', ')}. You may want to reach out manually.`,
      emailed: !!result.success,
      missing
    });
  } catch (error) {
    console.error('Send doctor setup reminder error:', error.message);
    res.status(500).json({ message: 'Error sending setup reminder' });
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

const cloudinary = require('cloudinary').v2;

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

    // Configure Cloudinary directly so upload errors surface (not swallowed)
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });

    const directUpload = async (buffer, mimetype, folder) => {
      const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
      const result = await cloudinary.uploader.upload(dataUri, { folder, resource_type: 'auto' });
      return result.secure_url;
    };

    let migrated = 0;
    let failed = 0;
    const errors = [];

    const tryMigrate = async (getVal, setVal, folder) => {
      const val = getVal();
      if (!isBase64(val)) return;
      const p = parseDataUri(val);
      if (!p) { failed++; errors.push('unparseable data URI'); return; }
      try {
        const url = await directUpload(p.buffer, p.mimetype, folder);
        setVal(url);
        migrated++;
      } catch (e) {
        failed++;
        errors.push(e.message || String(e));
      }
    };

    // Doctors: QR codes + profile photos
    const users = await User.find({ $or: [{ upiQrCode: /^data:/ }, { profilePhoto: /^data:/ }] });
    for (const u of users) {
      await tryMigrate(() => u.upiQrCode, (url) => { u.upiQrCode = url; }, 'promedicoz/qr');
      await tryMigrate(() => u.profilePhoto, (url) => { u.profilePhoto = url; }, 'promedicoz/profile');
      await u.save({ validateBeforeSave: false });
    }

    // Appointments: payment screenshots
    const appts = await Appointment.find({ paymentScreenshot: /^data:/ });
    for (const a of appts) {
      await tryMigrate(() => a.paymentScreenshot, (url) => { a.paymentScreenshot = url; }, 'promedicoz/payments');
      await a.save();
    }

    // Medical reports
    const reports = await MedicalReport.find({ filePath: /^data:/ });
    for (const r of reports) {
      await tryMigrate(() => r.filePath, (url) => { r.filePath = url; }, 'promedicoz/reports');
      await r.save();
    }

    // Return the first couple of error messages so the cause is visible
    res.json({
      message: 'Image migration complete',
      migrated,
      failed,
      errors: errors.slice(0, 3)
    });
  } catch (error) {
    console.error('Migrate images error:', error.message);
    res.status(500).json({
      message: 'Migration failed',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
};

// ============================================
// BACKFILL PATIENT IDS (admin, one-time)
// ============================================
// Endpoint: POST /api/admin/backfill-patient-ids
// Patients who registered before the Patient ID field existed have
// patientId: null. Assigns each of them the next sequential id, oldest
// account first (so ids roughly track "how long they've been a patient").
// Idempotent - only touches patients that don't have one yet, so it's safe
// to run more than once (e.g. after new patients register without one for
// some reason).

const backfillPatientIds = async (req, res) => {
  try {
    const patients = await User.find({ role: 'patient', patientId: null }).sort({ createdAt: 1 });

    let assigned = 0;
    for (const p of patients) {
      const seq = await getNextSequence('patientId');
      p.patientId = `PT${String(seq).padStart(6, '0')}`;
      await p.save({ validateBeforeSave: false });
      assigned++;
    }

    res.json({ message: `Assigned Patient IDs to ${assigned} existing patient(s).`, assigned });
  } catch (error) {
    console.error('Backfill patient ids error:', error.message);
    res.status(500).json({ message: 'Error backfilling patient ids' });
  }
};

// ============================================
// BACKFILL DOCTOR LANGUAGES (admin, one-time)
// ============================================
// Endpoint: POST /api/admin/backfill-doctor-languages
//
// The "languages you can consult in" field didn't exist when the current
// doctors registered, so they couldn't have set it — their languagesSpoken
// is empty. Since all current doctors speak Hindi + English, seed that as a
// sensible default so the "Speaks: ..." line and the patient language filter
// have real data immediately, while doctors are told to refine it themselves.
//
// SAFETY: only touches doctors whose languagesSpoken is empty or missing —
// it never overwrites a doctor who has already chosen their own languages.
// Idempotent: running it again after doctors have set languages is a no-op
// for them (they no longer match the filter). Default is configurable via
// the request body { languages: [...] } but falls back to Hindi + English.

const backfillDoctorLanguages = async (req, res) => {
  try {
    const defaults = Array.isArray(req.body?.languages) && req.body.languages.length > 0
      ? req.body.languages
      : ['Hindi', 'English'];

    // Match doctors with no languages set yet: field missing, empty array.
    const filter = {
      role: 'doctor',
      $or: [
        { languagesSpoken: { $exists: false } },
        { languagesSpoken: { $size: 0 } }
      ]
    };

    const result = await User.updateMany(filter, { $set: { languagesSpoken: defaults } });
    const updated = result.modifiedCount != null ? result.modifiedCount : result.nModified || 0;

    res.json({
      message: `Set languages (${defaults.join(', ')}) on ${updated} doctor(s) who hadn't set any. Doctors can change this in Edit Profile.`,
      updated,
      languages: defaults
    });
  } catch (error) {
    console.error('Backfill doctor languages error:', error.message);
    res.status(500).json({ message: 'Error backfilling doctor languages' });
  }
};

// ============================================
// UPDATE DOCTOR CONTACT - Admin edits a doctor's phone / WhatsApp on their behalf
// ============================================
// Endpoint: PUT /api/admin/users/:id/contact
// Body: { phone?: string, whatsappNumber?: string }
//
// For the common support case where a doctor asks to change their contact
// number but can't (or would rather not) do it themselves in Edit Profile.
// Only these two fields; nothing else on the account is touched. Both are
// optional in the body — send only the one being changed. Passing an empty
// string clears WhatsApp (turns off the public "Message on WhatsApp" button);
// phone cannot be blanked (it's a required contact/onboarding field).
const { formatIndianPhone, isValidIndianPhone } = require('../utils/formatPhone');

const updateDoctorContact = async (req, res) => {
  try {
    const { phone, whatsappNumber } = req.body;

    // Nothing to change?
    if (phone === undefined && whatsappNumber === undefined) {
      return res.status(400).json({ message: 'Provide a phone and/or whatsappNumber to update' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Doctors: phone + WhatsApp. Patients: phone only (support case — e.g. a
    // patient who registered before phone became mandatory and gives the
    // admin their number). Never admins.
    if (user.role !== 'doctor' && user.role !== 'patient') {
      return res.status(400).json({ message: 'This action is only for doctor or patient accounts' });
    }
    if (user.role === 'patient' && whatsappNumber !== undefined) {
      return res.status(400).json({ message: 'WhatsApp number is only for doctor profiles. For a patient, update the phone number only.' });
    }

    // ---- Phone (main contact / login number) ----
    if (phone !== undefined) {
      const raw = String(phone).trim();
      if (!raw) {
        return res.status(400).json({ message: 'Phone number cannot be empty. Leave it out of the request to keep it unchanged.' });
      }
      if (!isValidIndianPhone(raw)) {
        return res.status(400).json({ message: 'Please enter a valid Indian mobile number (10 digits, starting 6-9).' });
      }
      const formatted = formatIndianPhone(raw);

      // Phone has no unique index, so guard against handing this doctor a
      // number that already belongs to a DIFFERENT active account — that
      // would create exactly the duplicate-phone situation the admin panel
      // otherwise has to clean up.
      const clash = await User.findOne({
        phone: formatted,
        _id: { $ne: user._id },
        isDeleted: { $ne: true }
      }).select('_id name role');
      if (clash) {
        return res.status(400).json({
          message: `That number is already in use by another account (${clash.name}). Use a different number, or resolve the existing account first.`
        });
      }
      user.phone = formatted;
    }

    // ---- WhatsApp (public "Message on WhatsApp" button; may be cleared) ----
    if (whatsappNumber !== undefined) {
      const raw = String(whatsappNumber).trim();
      if (!raw) {
        user.whatsappNumber = ''; // clearing turns the public button off
      } else if (!isValidIndianPhone(raw)) {
        return res.status(400).json({ message: 'Please enter a valid Indian WhatsApp number, or leave it blank to remove it.' });
      } else {
        user.whatsappNumber = formatIndianPhone(raw);
      }
    }

    await user.save({ validateModifiedOnly: true });

    res.json({
      message: `Updated contact details for "${user.name}".`,
      user: { _id: user._id, name: user.name, phone: user.phone, whatsappNumber: user.whatsappNumber }
    });
  } catch (error) {
    console.error('Update doctor contact error:', error.message);
    res.status(500).json({ message: 'Error updating contact details' });
  }
};

// ============================================
// UPDATE DOCTOR LOCATION (admin, on the doctor's behalf)
// ============================================
// Endpoint: PUT /api/admin/users/:id/location
// Body: { city?, clinicAddress? }
//
// Lets an admin correct a doctor's City and/or Clinic Address (support case —
// e.g. a doctor who put their STATE in the City field, like "Chhattisgarh"
// instead of "Bhilai"). Only these two fields are touched; both are optional,
// so send just the one being changed. Values are trimmed (stray trailing
// spaces are a common cause of odd display/search behaviour). City cannot be
// blanked (it drives search/landing pages); clinicAddress may be cleared.
const updateDoctorLocation = async (req, res) => {
  try {
    const { city, clinicAddress } = req.body;

    if (city === undefined && clinicAddress === undefined) {
      return res.status(400).json({ message: 'Provide a city and/or clinicAddress to update' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'doctor') {
      return res.status(400).json({ message: 'This action is only for doctor accounts' });
    }

    if (city !== undefined) {
      const trimmed = String(city).trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'City cannot be empty. Leave it out of the request to keep it unchanged.' });
      }
      user.city = trimmed;
    }

    if (clinicAddress !== undefined) {
      user.clinicAddress = String(clinicAddress).trim(); // may be cleared
    }

    await user.save({ validateModifiedOnly: true });

    res.json({
      message: `Updated location for "${user.name}".`,
      user: { _id: user._id, name: user.name, city: user.city, clinicAddress: user.clinicAddress }
    });
  } catch (error) {
    console.error('Update doctor location error:', error.message);
    res.status(500).json({ message: 'Error updating location' });
  }
};

// ============================================
// UPDATE DOCTOR AVAILABILITY (admin, on the doctor's behalf)
// ============================================
// Endpoint: PUT /api/admin/users/:id/availability
// Body: { availability: [{ day, startTime, endTime }], slotDuration }
//
// Lets an admin set a doctor's weekly schedule for them (common support case:
// doctors ask the admin to set it up). This writes the SAME data shape and
// runs the SAME validation as the doctor-side PUT /api/availability, so what
// the admin saves is indistinguishable from what the doctor would save — and
// every consumer (free-slot generation, next-available, list ranking) keeps
// working. Replaces the whole availability array + slotDuration (full replace,
// matching the doctor-side behaviour). Does NOT touch blockedDates.
const updateDoctorAvailability = async (req, res) => {
  try {
    const { availability, slotDuration } = req.body;

    if (!availability || !Array.isArray(availability)) {
      return res.status(400).json({ message: 'Please provide availability as an array' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'doctor') {
      return res.status(400).json({ message: 'This action is only for doctor accounts' });
    }

    // ---- Validate each entry (identical rules to availabilityController.setAvailability) ----
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // 09:00, 14:30 — not 25:00 or 9:00
    const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

    for (const slot of availability) {
      if (!slot || !slot.day || !slot.startTime || !slot.endTime) {
        return res.status(400).json({ message: 'Each availability entry must have day, startTime, and endTime' });
      }
      if (!validDays.includes(slot.day)) {
        return res.status(400).json({ message: `Invalid day: "${slot.day}". Must be one of: ${validDays.join(', ')}` });
      }
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return res.status(400).json({ message: 'Invalid time format. Use 24-hour format like "09:00" or "14:30"' });
      }
      const startM = toMinutes(slot.startTime);
      let endM = toMinutes(slot.endTime);
      if (endM === 0) endM = 24 * 60; // midnight = end of day
      if (startM >= endM) {
        return res.status(400).json({ message: `Start time (${slot.startTime}) must be before end time (${slot.endTime})` });
      }
    }

    // ---- Validate slot duration (same whitelist as the doctor-side) ----
    const validDurations = [15, 30, 45, 60];
    const duration = slotDuration || 30;
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ message: `Slot duration must be one of: ${validDurations.join(', ')} minutes` });
    }

    // Normalise entries to exactly { day, startTime, endTime } (drop any extra
    // client-sent fields), then full-replace — mirrors the doctor-side write.
    user.availability = availability.map((s) => ({ day: s.day, startTime: s.startTime, endTime: s.endTime }));
    user.slotDuration = duration;
    await user.save({ validateModifiedOnly: true });

    res.json({
      message: `Updated availability for "${user.name}" (${user.availability.length} session${user.availability.length === 1 ? '' : 's'}).`,
      user: { _id: user._id, name: user.name, availability: user.availability, slotDuration: user.slotDuration }
    });
  } catch (error) {
    console.error('Update doctor availability error:', error.message);
    res.status(500).json({ message: 'Error updating availability' });
  }
};

// ============================================
// UPDATE DOCTOR PROFILE (admin, on the doctor's behalf)
// ============================================
// Endpoint: PUT /api/admin/users/:id/profile
// Body: any of { specialization, qualification, experience, consultationFee,
//                bio, consultationModes }
//
// Lets an admin edit a doctor's professional profile + how they consult, for
// doctors who ask the admin to set it up. Contact (phone/WhatsApp) and location
// (city/address) already have their own admin actions, so they're intentionally
// NOT here. Only the fields actually sent are changed; writes the same shapes
// the doctor-side profile form writes, so nothing downstream breaks.
const updateDoctorProfileAdmin = async (req, res) => {
  try {
    const { specialization, qualification, experience, consultationFee, bio, consultationModes } = req.body;

    const anyProvided = [specialization, qualification, experience, consultationFee, bio, consultationModes]
      .some((v) => v !== undefined);
    if (!anyProvided) {
      return res.status(400).json({ message: 'Provide at least one field to update' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role !== 'doctor') {
      return res.status(400).json({ message: 'This action is only for doctor accounts' });
    }

    // Free-text fields — trim; may be cleared.
    if (specialization !== undefined) user.specialization = String(specialization).trim();
    if (qualification !== undefined) user.qualification = String(qualification).trim();
    if (bio !== undefined) user.bio = String(bio).trim();

    // Experience — number, 0..70 (matches the schema bounds).
    if (experience !== undefined) {
      const exp = Number(experience);
      if (Number.isNaN(exp) || exp < 0 || exp > 70) {
        return res.status(400).json({ message: 'Experience must be a number between 0 and 70 years.' });
      }
      user.experience = exp;
    }

    // Consultation fee — non-negative number.
    if (consultationFee !== undefined) {
      const fee = Number(consultationFee);
      if (Number.isNaN(fee) || fee < 0) {
        return res.status(400).json({ message: 'Consultation fee must be a non-negative number.' });
      }
      user.consultationFee = fee;
    }

    // Consultation modes — array limited to the schema enum.
    if (consultationModes !== undefined) {
      if (!Array.isArray(consultationModes)) {
        return res.status(400).json({ message: 'consultationModes must be an array.' });
      }
      const allowed = ['in-person', 'video', 'phone'];
      const cleaned = [...new Set(consultationModes)].filter((m) => allowed.includes(m));
      if (consultationModes.some((m) => !allowed.includes(m))) {
        return res.status(400).json({ message: `Consultation modes must be any of: ${allowed.join(', ')}.` });
      }
      user.consultationModes = cleaned;
    }

    await user.save({ validateModifiedOnly: true });

    res.json({
      message: `Updated profile for "${user.name}".`,
      user: {
        _id: user._id, name: user.name,
        specialization: user.specialization, qualification: user.qualification,
        experience: user.experience, consultationFee: user.consultationFee,
        bio: user.bio, consultationModes: user.consultationModes,
      }
    });
  } catch (error) {
    console.error('Update doctor profile (admin) error:', error.message);
    res.status(500).json({ message: 'Error updating profile' });
  }
};

// ============================================
// FIX EMAIL INDEX (admin, on demand)
// ============================================
// Endpoint: POST /api/admin/fix-email-index
// Re-runs the idempotent email-index repair (rebuilds User.email as a sparse
// unique index and unsets any ''/null emails). This is the fix for the bug
// where a SECOND phone-only patient (no email) gets "email already exists" —
// caused by a legacy NON-sparse unique index. Safe to run anytime; returns a
// report of what it changed and the before/after index state.
const fixEmailIndexAdmin = async (req, res) => {
  try {
    const report = await fixEmailIndex();
    res.json({
      message: report.changed
        ? 'Email index repaired — phone-only patients can register again.'
        : 'Email index already correct (sparse unique). No change needed.',
      report
    });
  } catch (error) {
    console.error('Fix email index (admin) error:', error.message);
    res.status(500).json({ message: 'Error repairing email index', error: error.message });
  }
};

// ============================================
// GET USER BY ID - Full detail drill-down (admin)
// ============================================
// Endpoint: GET /api/admin/users/:id
// Returns the complete user record (minus password) PLUS a compact appointment
// history, so the admin can click a name anywhere (Users list, Appointments
// list) and see everything about that person in one place — medical info and
// family members (patients), or full professional profile (doctors). The
// Appointments list only populates a few patient fields, so this endpoint is
// what lets that name open the same rich view as the Users tab.
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Recent appointments for this user, as patient OR doctor. Capped and
    // lightly populated — enough for an at-a-glance history, not a full export.
    const match = user.role === 'doctor' ? { doctor: user._id } : { patient: user._id };
    const appointments = await Appointment.find(match)
      .populate('doctor', 'name specialization')
      .populate('patient', 'name patientId')
      .sort({ date: -1 })
      .limit(20)
      .select('date timeSlot status consultationType reason paymentStatus amountCollected doctor patient');

    res.json({ user, appointments });
  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    console.error('Get user by id error:', error.message);
    res.status(500).json({ message: 'Error fetching user details' });
  }
};

module.exports = { getStats, getAllUsers, getUserById, getAllAppointments, deleteUser, setUserSuspension, setDoctorVerification, getAnalytics, migrateBase64Images, generateResetLink, findDuplicatePhones, freeUpContactInfo, backfillPatientIds, backfillDoctorLanguages, sendDoctorSetupReminder, markEmailVerified, updateDoctorContact, updateDoctorLocation, updateDoctorAvailability, updateDoctorProfileAdmin, confirmAppointmentAsAdmin, fixEmailIndexAdmin };
