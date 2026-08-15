const Message = require('../models/Message');
const Appointment = require('../models/Appointment');
const { sendPushToUser } = require('../utils/push');

// GET messages for an appointment
const getMessages = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    // Verify user is part of this appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const isPatient = appointment.patient.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor.toString() === req.user._id.toString();
    if (!isPatient && !isDoctor) return res.status(403).json({ message: 'Not authorized' });

    const messages = await Message.find({ appointment: appointmentId })
      .sort({ createdAt: 1 })
      .limit(100);

    // Mark messages as read for the current user
    await Message.updateMany(
      { appointment: appointmentId, sender: { $ne: req.user._id }, isRead: false },
      { isRead: true }
    );

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error.message);
    res.status(500).json({ message: 'Error fetching messages' });
  }
};

// SEND a message
const sendMessage = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) return res.status(400).json({ message: 'Message cannot be empty' });

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    const isPatient = appointment.patient.toString() === req.user._id.toString();
    const isDoctor = appointment.doctor.toString() === req.user._id.toString();
    if (!isPatient && !isDoctor) return res.status(403).json({ message: 'Not authorized' });

    // Check if patient is blocked by this doctor
    if (isPatient) {
      const User = require('../models/User');
      const doctor = await User.findById(appointment.doctor);
      if (doctor.blockedPatients && doctor.blockedPatients.includes(req.user._id.toString())) {
        return res.status(403).json({ message: 'You are blocked from messaging this doctor' });
      }
    }

    const message = await Message.create({
      appointment: appointmentId,
      sender: req.user._id,
      senderRole: req.user.role,
      text: text.trim()
    });

    // Push it over the socket for instant delivery. Polling (ChatBox's
    // fallback interval) still covers the case where the socket is down.
    const io = req.app.get('io');
    if (io) {
      const payload = {
        _id: message._id.toString(),
        appointment: appointmentId,
        sender: message.sender.toString(),
        senderRole: message.senderRole,
        text: message.text,
        isRead: message.isRead,
        createdAt: message.createdAt
      };
      io.to(`appointment:${appointmentId}`).emit('new-message', payload);

      // Also nudge the recipient's unread badge even if they don't have this
      // chat open right now.
      const recipientId = isPatient ? appointment.doctor.toString() : appointment.patient.toString();
      io.to(`user:${recipientId}`).emit('message-notification', { appointmentId });

      // Push notification too — reaches the recipient even if they don't have
      // the app open at all (socket alone only works while it's open).
      sendPushToUser(recipientId, {
        title: `New message from ${req.user.name}`,
        body: text.trim().slice(0, 120),
        url: '/dashboard',
        tag: `chat-${appointmentId}`
      });
    }

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({ message: 'Error sending message' });
  }
};

// GET unread message count for user
const getUnreadCount = async (req, res) => {
  try {
    const Appointment = require('../models/Appointment');
    const filter = req.user.role === 'patient'
      ? { patient: req.user._id }
      : { doctor: req.user._id };

    const appointments = await Appointment.find(filter).select('_id');
    const appointmentIds = appointments.map(a => a._id);

    const count = await Message.countDocuments({
      appointment: { $in: appointmentIds },
      sender: { $ne: req.user._id },
      isRead: false
    });

    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unread count' });
  }
};

// BLOCK patient (doctor only)
const blockPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const User = require('../models/User');

    const doctor = await User.findById(req.user._id);
    if (!doctor.blockedPatients.includes(patientId)) {
      doctor.blockedPatients.push(patientId);
      await doctor.save({ validateBeforeSave: false });
    }

    res.json({ message: 'Patient blocked successfully' });
  } catch (error) {
    console.error('Block patient error:', error.message);
    res.status(500).json({ message: 'Error blocking patient' });
  }
};

// UNBLOCK patient (doctor only)
const unblockPatient = async (req, res) => {
  try {
    const { patientId } = req.params;
    const User = require('../models/User');

    const doctor = await User.findById(req.user._id);
    doctor.blockedPatients = doctor.blockedPatients.filter(id => id.toString() !== patientId);
    await doctor.save({ validateBeforeSave: false });

    res.json({ message: 'Patient unblocked successfully' });
  } catch (error) {
    console.error('Unblock patient error:', error.message);
    res.status(500).json({ message: 'Error unblocking patient' });
  }
};

module.exports = { getMessages, sendMessage, getUnreadCount, blockPatient, unblockPatient };
