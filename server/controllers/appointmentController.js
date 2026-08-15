// ============================================
// Appointment Controller - Booking Logic
// ============================================
// This handles all the appointment operations:
// - Patient books an appointment
// - Patient views their appointments
// - Doctor views their appointments
// - Doctor updates appointment status (confirm/complete/cancel)
// - Either party cancels
//
// KEY CONCEPT: "populate()"
// When we fetch appointments, we don't just want the doctor's ID —
// we want their name, specialization, etc. populate() fills in the
// referenced data automatically.

const Appointment = require('../models/Appointment');
const User = require('../models/User');
const { sendAppointmentNotification, sendAppointmentConfirmation } = require('../utils/sendEmail');
const { sendPushToUser } = require('../utils/push');
const { getPagination, safeContainsRegex } = require('../utils/queryHelpers');

// ============================================
// BOOK APPOINTMENT - Patient only
// ============================================
// Endpoint: POST /api/appointments
// Body: { doctorId, date, timeSlot, reason, consultationType }
//
// Only patients can book. The patient is identified from their token (req.user).

const bookAppointment = async (req, res) => {
  try {
    const { doctorId, date, timeSlot, reason, consultationType, bookedFor, familyMemberName, originalAppointmentId, isFollowUp, consentGiven } = req.body;

    // Step 1: Validate required fields
    if (!doctorId || !date || !timeSlot || !reason) {
      return res.status(400).json({
        message: 'Please provide doctorId, date, timeSlot, and reason'
      });
    }

    // Step 1b: If booking for family member, validate family member name
    if (bookedFor === 'family' && !familyMemberName) {
      return res.status(400).json({
        message: 'Please provide the family member name when booking for a family member'
      });
    }

    // Step 1c: Require teleconsultation consent (legal requirement)
    if (!consentGiven) {
      return res.status(400).json({
        message: 'Consent to the teleconsultation terms is required to book an appointment'
      });
    }

    // Step 2: Verify the doctor exists and is actually a doctor
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }

    // Step 3: Check if the time slot is already taken
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: new Date(date),
      timeSlot: timeSlot,
      status: { $nin: ['cancelled'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        message: 'This time slot is already booked. Please choose another time.'
      });
    }

    // Step 4: Check the appointment date is not in the past (IST timezone)
    const nowInIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const todayIST = nowInIST.getFullYear() + '-' +
      String(nowInIST.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowInIST.getDate()).padStart(2, '0');

    if (date < todayIST) {
      return res.status(400).json({
        message: 'Cannot book appointments in the past'
      });
    }

    // Step 5: Validate follow-up eligibility
    if (isFollowUp && originalAppointmentId) {
      const originalApt = await Appointment.findById(originalAppointmentId);
      if (!originalApt || !originalApt.followUpDeadline || new Date() > new Date(originalApt.followUpDeadline)) {
        return res.status(400).json({
          message: 'Free follow-up period has expired. Please book a regular appointment.'
        });
      }
    }

    // Step 6: Create the appointment
    const appointmentData = {
      patient: req.user._id,
      doctor: doctorId,
      date: new Date(date),
      timeSlot,
      reason,
      consultationType: consultationType || 'in-person',
      status: 'pending',
      bookedFor: bookedFor || 'self',
      familyMemberName: bookedFor === 'family' ? familyMemberName : '',
      isFollowUp: isFollowUp || false,
      paymentStatus: isFollowUp ? 'paid' : 'pending',  // Follow-ups skip payment
      consentGiven: true,
      consentAt: new Date(),
      consentIP: req.headers['x-forwarded-for'] || req.ip || ''
    };

    // If this is a repeat booking, link to original appointment
    if (originalAppointmentId) {
      appointmentData.originalAppointment = originalAppointmentId;
    }

    const appointment = await Appointment.create(appointmentData);

    // Step 6: Populate doctor info before sending response
    // So the frontend gets the doctor's name, not just their ID
    await appointment.populate('doctor', 'name specialization profilePhoto');
    // Second argument = which fields to include (space-separated)

    // Send email notification to doctor (non-blocking — don't wait for it)
    const patient = await User.findById(req.user._id).select('name phone email');
    sendAppointmentNotification(doctor, patient, appointment);

    res.status(201).json({
      message: 'Appointment booked successfully! Waiting for doctor confirmation.',
      appointment
    });

  } catch (error) {
    console.error('Book appointment error:', error.message);
    res.status(500).json({
      message: 'Error booking appointment'
    });
  }
};

// ============================================
// GET MY APPOINTMENTS - For logged-in user (patient or doctor)
// ============================================
// Endpoint: GET /api/appointments/my
// Query params: ?status=pending&page=1&limit=10
//
// Returns different results based on role:
// - If patient: shows appointments they've booked
// - If doctor: shows appointments patients booked with them

const getMyAppointments = async (req, res) => {
  try {
    // Build filter based on user's role
    const filter = {};

    if (req.user.role === 'patient') {
      filter.patient = req.user._id;
      // Show appointments where I am the patient
    } else if (req.user.role === 'doctor') {
      filter.doctor = req.user._id;
      // Show appointments where I am the doctor
    }

    // Optional status filter
    if (req.query.status) {
      filter.status = req.query.status;
      // Example: ?status=pending → only show pending appointments
    }

    // Optional search — lets a doctor with many appointments find a specific
    // one without paging through everything. Matches the OTHER party's name,
    // phone, or (for patients) their Patient ID. We resolve matching user ids
    // first, then fold that into the existing filter, so the rest of the
    // query/sort/pagination pipeline below is unchanged.
    if (req.query.search && req.query.search.trim()) {
      const re = safeContainsRegex(req.query.search.trim());
      const otherPartyRole = req.user.role === 'doctor' ? 'patient' : 'doctor';
      const matches = await User.find({
        role: otherPartyRole,
        $or: [{ name: re }, { phone: re }, { patientId: re }]
      }).select('_id');
      const matchedIds = matches.map((m) => m._id);
      // No matches at all → force an empty result instead of accidentally
      // matching everything (an empty $in matches nothing, which is correct).
      filter[otherPartyRole] = { $in: matchedIds };
    }

    // Pagination
    const { page, limit, skip } = getPagination(req, { defaultLimit: 10 });

    // ---- Ordering ----
    // Upcoming (pending/confirmed) first, EARLIEST date first (soonest at top).
    // Then past (completed/cancelled), NEWEST date first (most recent at top).
    // We compute this order with a small aggregation that returns the ordered
    // ids for this page, then fetch those with the usual populate (so nothing
    // downstream changes).
    const ordered = await Appointment.aggregate([
      { $match: filter },
      { $addFields: {
          _grp: { $cond: [{ $in: ['$status', ['pending', 'confirmed']] }, 0, 1] },
          _ts: { $toLong: '$date' }
      } },
      { $addFields: {
          // Upcoming: sort ascending by date. Past: ascending by -date = newest first.
          _key: { $cond: [{ $eq: ['$_grp', 0] }, '$_ts', { $multiply: ['$_ts', -1] }] }
      } },
      { $sort: { _grp: 1, _key: 1, createdAt: 1 } },
      { $skip: skip },
      { $limit: limit },
      { $project: { _id: 1 } }
    ]);

    const orderedIds = ordered.map((o) => o._id);

    // Fetch the page's appointments with the usual populate, then restore order.
    const docs = await Appointment.find({ _id: { $in: orderedIds } })
      .populate('doctor', 'name specialization profilePhoto consultationFee upiId upiQrCode phone city googleMapsLink consultationModes')
      .populate('patient', 'name email phone patientId');

    const byId = {};
    docs.forEach((d) => { byId[d._id.toString()] = d; });
    const appointments = orderedIds
      .map((id) => byId[id.toString()])
      .filter(Boolean);

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
    console.error('Get appointments error:', error.message);
    res.status(500).json({
      message: 'Error fetching appointments'
    });
  }
};

// ============================================
// GET SINGLE APPOINTMENT - View details
// ============================================
// Endpoint: GET /api/appointments/:id
// Only the patient or doctor involved can view it

const getAppointmentById = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'name specialization profilePhoto consultationFee clinicAddress')
      .populate('patient', 'name email phone patientId');

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    // Security check: only the involved patient or doctor can view
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor._id.toString() === req.user._id.toString();
    // .toString() because MongoDB ObjectIds aren't plain strings —
    // you can't compare them directly with ===

    if (!isPatient && !isDoctor) {
      return res.status(403).json({
        message: 'You are not authorized to view this appointment'
      });
    }

    res.json({ appointment });

  } catch (error) {
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ message: 'Invalid appointment ID' });
    }
    console.error('Get appointment error:', error.message);
    res.status(500).json({
      message: 'Error fetching appointment details'
    });
  }
};

// ============================================
// UPDATE APPOINTMENT STATUS - Doctor only
// ============================================
// Endpoint: PUT /api/appointments/:id/status
// Body: { status, notes }
//
// Doctors can: confirm, complete, or cancel appointments
// Valid transitions:
//   pending → confirmed (doctor accepts)
//   confirmed → completed (consultation done)
//   pending/confirmed → cancelled (doctor cancels)

const updateAppointmentStatus = async (req, res) => {
  try {
    const { status, notes, meetingLink } = req.body;

    if (!status) {
      return res.status(400).json({
        message: 'Please provide a status'
      });
    }

    // Find the appointment
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    // Verify this doctor owns the appointment
    if (appointment.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only update your own appointments'
      });
    }

    // Validate status transitions
    // We don't want random jumps like "completed → pending"
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],      // Final state — no changes allowed
      cancelled: []       // Final state — no changes allowed
    };

    if (!validTransitions[appointment.status].includes(status)) {
      return res.status(400).json({
        message: `Cannot change status from "${appointment.status}" to "${status}". Valid options: ${validTransitions[appointment.status].join(', ') || 'none (final state)'}`
      });
    }

    // Update ONLY the fields that should change — protect timeSlot and date
    appointment.status = status;
    if (notes) {
      appointment.notes = notes;
    }
    if (meetingLink) {
      appointment.meetingLink = meetingLink;
    }

    // Mark only modified paths to prevent Mongoose from touching other fields
    appointment.markModified('status');
    await appointment.save({ validateModifiedOnly: true });

    // Populate before sending back
    await appointment.populate('doctor', 'name specialization consultationFee');
    await appointment.populate('patient', 'name email phone');

    // Send confirmation email to patient when doctor confirms
    if (status === 'confirmed') {
      sendAppointmentConfirmation(appointment.patient, appointment.doctor, appointment);
    }

    // Push notification to the patient — works even if they have no email on
    // file (phone-only accounts), as long as they've enabled notifications.
    if (status === 'confirmed') {
      sendPushToUser(appointment.patient._id, {
        title: 'Appointment confirmed',
        body: `Dr. ${appointment.doctor.name} confirmed your appointment on ${new Date(appointment.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${appointment.timeSlot}.`,
        url: '/dashboard',
        tag: `appointment-${appointment._id}`
      });
    } else if (status === 'cancelled') {
      sendPushToUser(appointment.patient._id, {
        title: 'Appointment cancelled',
        body: `Dr. ${appointment.doctor.name} was unable to confirm your appointment on ${new Date(appointment.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`,
        url: '/dashboard',
        tag: `appointment-${appointment._id}`
      });
    }

    res.json({
      message: `Appointment ${status} successfully`,
      appointment
    });

  } catch (error) {
    console.error('Update appointment status error:', error.message);
    res.status(500).json({
      message: 'Error updating appointment status'
    });
  }
};

// ============================================
// CANCEL APPOINTMENT - Patient cancels their own
// ============================================
// Endpoint: PUT /api/appointments/:id/cancel
// Body: { cancellationReason }
//
// Patients can cancel pending or confirmed appointments

const cancelAppointment = async (req, res) => {
  try {
    const { cancellationReason } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }

    // Verify this patient owns the appointment
    if (appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'You can only cancel your own appointments'
      });
    }

    // Can only cancel if not already completed or cancelled
    if (['completed', 'cancelled'].includes(appointment.status)) {
      return res.status(400).json({
        message: `Cannot cancel an appointment that is already ${appointment.status}`
      });
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = cancellationReason || 'Cancelled by patient';

    await appointment.save();

    // Let the doctor know instantly, without waiting for them to check the dashboard.
    sendPushToUser(appointment.doctor, {
      title: 'Appointment cancelled',
      body: `${req.user.name} cancelled their appointment on ${new Date(appointment.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at ${appointment.timeSlot}.`,
      url: '/dashboard',
      tag: `appointment-${appointment._id}`
    });

    res.json({
      message: 'Appointment cancelled successfully',
      appointment
    });

  } catch (error) {
    console.error('Cancel appointment error:', error.message);
    res.status(500).json({
      message: 'Error cancelling appointment'
    });
  }
};

// ============================================
// MARK PAYMENT RECEIVED - Doctor/Admin marks payment
// ============================================
// Endpoint: PUT /api/appointments/:id/payment
// Body: { paymentStatus: 'paid' }

const markPayment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id).populate('doctor', 'consultationFee');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Only the doctor of this appointment or admin can mark payment
    if (appointment.doctor._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update payment status' });
    }

    // Validate a custom amount before it ever reaches the database — a clean
    // 400 here is much more useful than a generic 500 from the schema's own
    // min-value check further down.
    if (req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '') {
      const amount = Number(req.body.amount);
      if (Number.isNaN(amount) || amount < 0) {
        return res.status(400).json({ message: 'Amount must be a positive number' });
      }
    }

    appointment.paymentStatus = 'paid';
    appointment.paidAt = new Date();
    // Use custom amount if provided, otherwise use doctor's consultation fee
    appointment.amountCollected = req.body.amount ? Number(req.body.amount) : (appointment.doctor.consultationFee || 0);
    await appointment.save();

    res.json({
      message: 'Payment marked as received',
      appointment
    });

  } catch (error) {
    console.error('Mark payment error:', error.message);
    res.status(500).json({ message: 'Error updating payment status' });
  }
};

// ============================================
// UPLOAD PAYMENT SCREENSHOT - Patient uploads proof
// ============================================
const uploadPaymentScreenshot = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (!req.file) return res.status(400).json({ message: 'Please upload a screenshot' });

    // Store screenshot (Cloudinary URL, or base64 fallback if Cloudinary not set)
    appointment.paymentScreenshot = await uploadFile(
      req.file.buffer,
      req.file.mimetype,
      'promedicoz/payments'
    );
    await appointment.save();

    res.json({ message: 'Payment screenshot uploaded', paymentScreenshot: appointment.paymentScreenshot });
  } catch (error) {
    console.error('Upload payment screenshot error:', error.message);
    res.status(500).json({ message: 'Error uploading screenshot' });
  }
};

// ============================================
// NOTIFY PAYMENT - Patient says they paid
// ============================================
const notifyPayment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    if (appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    appointment.paymentStatus = 'patient_claimed';
    await appointment.save();

    res.json({ message: 'Doctor notified', paymentStatus: 'patient_claimed' });
  } catch (error) {
    console.error('Notify payment error:', error.message);
    res.status(500).json({ message: 'Error notifying payment' });
  }
};

// ============================================
// SET CALL STATUS - Signal that a call is active (ringing)
// ============================================
// Endpoint: PUT /api/appointments/:id/call
// Body: { active: true|false }
//
// When a participant joins a video/audio call, this marks the appointment
// as "call active" so the OTHER participant's dashboard can show an
// incoming-call banner with a ringtone. Either the doctor or the patient
// on the appointment may set it.

const setCallStatus = async (req, res) => {
  try {
    const { active } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const uid = req.user._id.toString();
    const isParticipant =
      appointment.patient.toString() === uid || appointment.doctor.toString() === uid;

    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized for this appointment' });
    }

    appointment.callActive = !!active;
    appointment.callStartedAt = active ? new Date() : null;
    appointment.callStartedBy = active ? req.user._id : null;
    await appointment.save({ validateModifiedOnly: true });

    // Push an instant update to the OTHER participant over the socket, so
    // their ringing banner shows/clears immediately instead of waiting on
    // the next poll (getIncomingCalls, polled every 5s, stays as a fallback).
    const io = req.app.get('io');
    if (io) {
      const otherUserId =
        appointment.doctor.toString() === uid ? appointment.patient.toString() : appointment.doctor.toString();

      if (appointment.callActive) {
        const fromName = req.user.role === 'doctor' ? `Dr. ${req.user.name}` : req.user.name;
        io.to(`user:${otherUserId}`).emit('incoming-call', {
          appointmentId: appointment._id.toString(),
          consultationType: appointment.consultationType,
          fromName
        });
        // Push notification too — reaches the other participant even if the
        // app isn't open in a foreground tab right now (socket alone can't).
        sendPushToUser(otherUserId, {
          title: `Incoming ${appointment.consultationType === 'video' ? 'video' : 'audio'} call`,
          body: `${fromName} is calling you now.`,
          url: '/dashboard',
          tag: `call-${appointment._id}`
        });
      } else {
        io.to(`user:${otherUserId}`).emit('call-ended', {
          appointmentId: appointment._id.toString()
        });
      }
    }

    res.json({ message: 'Call status updated', callActive: appointment.callActive });
  } catch (error) {
    console.error('Set call status error:', error.message);
    res.status(500).json({ message: 'Error updating call status' });
  }
};

// ============================================
// GET INCOMING CALLS - Poll for calls started by the other party
// ============================================
// Endpoint: GET /api/appointments/incoming-calls
//
// Returns calls that are active, were started by the OTHER participant,
// and started within the last 2 minutes (so stale flags don't ring forever).

const getIncomingCalls = async (req, res) => {
  try {
    const uid = req.user._id;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    const calls = await Appointment.find({
      $or: [{ patient: uid }, { doctor: uid }],
      callActive: true,
      callStartedBy: { $ne: uid },
      callStartedAt: { $gte: twoMinutesAgo }
    })
      .populate('doctor', 'name')
      .populate('patient', 'name')
      .select('consultationType callStartedAt callStartedBy doctor patient')
      .limit(5);

    const incomingCalls = calls.map((c) => {
      const startedByDoctor =
        c.callStartedBy && c.doctor && c.callStartedBy.toString() === c.doctor._id.toString();
      const fromName = startedByDoctor
        ? `Dr. ${c.doctor?.name || 'Doctor'}`
        : (c.patient?.name || 'Patient');
      return {
        appointmentId: c._id,
        consultationType: c.consultationType,
        fromName
      };
    });

    res.json({ incomingCalls });
  } catch (error) {
    console.error('Get incoming calls error:', error.message);
    res.status(500).json({ message: 'Error fetching incoming calls' });
  }
};

// ============================================
// GET VIDEO TOKEN - Join a Daily.co call (no login needed)
// ============================================
// Endpoint: GET /api/appointments/:id/video-token
//
// Verifies the caller is the doctor or patient on the appointment, ensures a
// private Daily room exists for it, and returns a room URL + a short-lived
// meeting token so the user joins directly (doctor = moderator/owner).

const { ensureRoom, createMeetingToken } = require('../utils/daily');
const { uploadFile } = require('../utils/uploadFile');
const CallLog = require('../models/CallLog');

// ---- Time-slot window helpers (IST) ----
// The call is only allowed during the booked slot (+ a small grace window),
// so patients can't call the doctor at any random time of the day.
const CALL_GRACE_BEFORE = 5;  // minutes before slot start
const CALL_GRACE_AFTER = 20;  // minutes after slot end

function istNowMinutes() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date());
  let h = 0, m = 0;
  for (const p of parts) {
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') m = parseInt(p.value, 10);
  }
  if (h === 24) h = 0;
  return h * 60 + m;
}

function istDateStr(d) {
  return new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function parseSlotMinutes(str) {
  if (!str) return null;
  const m = str.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

function isWithinSlotWindow(date, timeSlot) {
  // Must be the same calendar day in IST
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (istDateStr(date) !== today) return false;
  const parts = (timeSlot || '').split('-').map((s) => s.trim());
  const start = parseSlotMinutes(parts[0]);
  let end = parseSlotMinutes(parts[1]);
  if (start == null || end == null) return true; // can't parse → don't block
  if (end <= start) end += 24 * 60; // slot ends at/after midnight (e.g., 11:30 PM - 12:00 AM)
  const now = istNowMinutes();
  return now >= (start - CALL_GRACE_BEFORE) && now <= (end + CALL_GRACE_AFTER);
}

const getVideoToken = async (req, res) => {
  try {
    if (!process.env.DAILY_API_KEY || !process.env.DAILY_DOMAIN) {
      return res.status(500).json({ message: 'Video service is not configured' });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate('doctor', 'name')
      .populate('patient', 'name');

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const uid = req.user._id.toString();
    const isDoctor = appointment.doctor._id.toString() === uid;
    const isPatient = appointment.patient._id.toString() === uid;

    if (!isDoctor && !isPatient) {
      return res.status(403).json({ message: 'Not authorized for this appointment' });
    }

    // Strict rule: only allow joining during the booked time slot (+ grace window)
    if (!isWithinSlotWindow(appointment.date, appointment.timeSlot)) {
      return res.status(403).json({
        message: `This call is only available during the booked time slot (${appointment.timeSlot}).`
      });
    }

    const roomName = `promedicoz-${appointment._id}`;
    await ensureRoom(roomName);

    const userName = isDoctor
      ? `Dr. ${appointment.doctor.name}`
      : (appointment.patient.name || 'Patient');
    const startVideoOff = appointment.consultationType === 'phone';

    const token = await createMeetingToken({
      roomName,
      userName,
      isOwner: isDoctor, // doctor is the moderator
      startVideoOff
    });

    const roomUrl = `https://${process.env.DAILY_DOMAIN}/${roomName}`;
    res.json({ roomUrl, token });
  } catch (error) {
    console.error('Get video token error:', error.message);
    res.status(500).json({ message: 'Error starting the call. Please try again.' });
  }
};

// ============================================
// START CALL LOG - Record that the doctor joined a call
// ============================================
// Endpoint: POST /api/appointments/:id/call-log
// Only logs when the requester is the DOCTOR on the appointment, so calls
// aren't double-counted when the patient also joins. Returns { logId }.

const startCallLog = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    const uid = req.user._id.toString();
    const isDoctor = appointment.doctor.toString() === uid;
    const isPatient = appointment.patient.toString() === uid;
    if (!isDoctor && !isPatient) {
      return res.status(403).json({ message: 'Not authorized for this appointment' });
    }

    // Only the doctor's join creates a log (avoids double counting).
    if (!isDoctor) {
      return res.json({ logId: null });
    }

    const log = await CallLog.create({
      appointment: appointment._id,
      doctor: appointment.doctor,
      patient: appointment.patient,
      consultationType: appointment.consultationType,
      startedAt: new Date()
    });

    res.json({ logId: log._id });
  } catch (error) {
    console.error('Start call log error:', error.message);
    res.status(500).json({ message: 'Error logging call' });
  }
};

// ============================================
// END CALL LOG - Finalize a call log with duration
// ============================================
// Endpoint: PUT /api/appointments/:id/call-log/:logId/end

const endCallLog = async (req, res) => {
  try {
    const log = await CallLog.findById(req.params.logId);
    if (!log) {
      return res.status(404).json({ message: 'Call log not found' });
    }

    // Only the doctor who owns the log can finalize it
    if (log.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Ignore if already ended (avoid overwriting)
    if (log.endedAt) {
      return res.json({ message: 'Already ended', durationSeconds: log.durationSeconds });
    }

    const endedAt = new Date();
    const durationSeconds = Math.max(0, Math.round((endedAt - log.startedAt) / 1000));
    log.endedAt = endedAt;
    log.durationSeconds = durationSeconds;
    await log.save();

    res.json({ message: 'Call log finalized', durationSeconds });
  } catch (error) {
    console.error('End call log error:', error.message);
    res.status(500).json({ message: 'Error finalizing call log' });
  }
};

// ---- Export all controller functions ----
module.exports = {
  bookAppointment,
  getMyAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  cancelAppointment,
  markPayment,
  uploadPaymentScreenshot,
  notifyPayment,
  setCallStatus,
  getIncomingCalls,
  getVideoToken,
  startCallLog,
  endCallLog
};
