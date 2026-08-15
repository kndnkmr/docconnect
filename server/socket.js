// ============================================
// Socket.io - Real-time chat + call ringing
// ============================================
// Adds a WebSocket layer on top of the existing REST + polling APIs.
// Polling stays in place as a fallback (see ChatBox.jsx / Dashboard.jsx on
// the client) so everything keeps working if a socket connection drops,
// gets blocked by a network/proxy, or fails to reconnect.
//
// AUTH: the client sends its JWT (the same one used for REST calls) in the
// connection handshake (`socket.handshake.auth.token`). We verify it exactly
// like middleware/auth.js does and attach the user to the socket.
//
// ROOMS:
//   - "user:<userId>"        - every connected socket joins its own user room
//                               automatically. Used to push events (incoming
//                               call, new message notification) to a user
//                               regardless of which page/appointment they
//                               currently have open.
//   - "appointment:<id>"     - joined only after the client explicitly asks
//                               (via "join-appointment"), and only if we
//                               confirm the connecting user is the doctor or
//                               patient on that appointment. Used for chat
//                               messages within an open ChatBox.

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Appointment = require('./models/Appointment');

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || '*',
      credentials: true
    }
  });

  // ---- Authenticate every connecting socket (same check as middleware/auth.js) ----
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('No token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User no longer exists'));

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Every connected user automatically gets their own room so events can
    // reach them no matter what page they're on.
    socket.join(`user:${socket.user._id}`);

    // Join the room for a specific appointment's chat - only if the
    // connecting user is actually the doctor or patient on it.
    socket.on('join-appointment', async (appointmentId) => {
      try {
        if (!appointmentId) return;
        const appointment = await Appointment.findById(appointmentId).select('doctor patient');
        if (!appointment) return;

        const uid = socket.user._id.toString();
        const isParticipant =
          appointment.doctor.toString() === uid || appointment.patient.toString() === uid;
        if (!isParticipant) return;

        socket.join(`appointment:${appointmentId}`);
      } catch (error) {
        // Silent - the client's polling fallback still works either way
      }
    });

    socket.on('leave-appointment', (appointmentId) => {
      if (appointmentId) socket.leave(`appointment:${appointmentId}`);
    });
  });

  return io;
}

module.exports = { initSocket };
