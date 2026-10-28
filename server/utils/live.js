// ============================================
// Live updates — tell the other person's open dashboard something changed
// ============================================
// Socket.io rooms are per user (`user:<id>`, joined on connect in socket.js).
// Clients refetch on 'appointment-updated' (Dashboard.jsx), so payloads stay
// tiny and carry no personal data. Never throws: a live update is a nicety on
// top of the saved change, and the client also catches up on reconnect /
// when the tab becomes visible.

function tellUsers(req, userIds, event = 'appointment-updated', payload = {}) {
  try {
    const io = req && req.app && typeof req.app.get === 'function' ? req.app.get('io') : null;
    if (!io) return;
    const seen = new Set();
    for (const raw of [].concat(userIds || [])) {
      const id = raw && raw._id ? String(raw._id) : raw ? String(raw) : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      io.to(`user:${id}`).emit(event, payload);
    }
  } catch (error) {
    console.error('live update error:', error.message);
  }
}

// The usual case: an appointment changed → both sides refresh.
const appointmentChanged = (req, apt, extra = {}) =>
  tellUsers(req, [apt.patient, apt.doctor], 'appointment-updated', { appointmentId: String(apt._id), ...extra });

module.exports = { tellUsers, appointmentChanged };
