// ============================================
// Socket client - real-time chat + call ringing
// ============================================
// Thin wrapper around socket.io-client. One connection is shared across the
// whole app (ChatBox, Dashboard, etc. all call getSocket() and get the same
// instance). If the socket ever fails to connect, reconnect, or gets blocked
// by a network/proxy, the app keeps working via the existing REST polling -
// this is a pure enhancement, never a hard dependency.

import { io } from 'socket.io-client';

let socket = null;

// Same host the REST API uses, just without the "/api" suffix.
// VITE_API_URL is unset in dev (falls back to same-origin, matching the
// Vite proxy setup already used by services/api.js).
const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return apiUrl.replace(/\/api\/?$/, '') || undefined; // undefined = same origin
};

// Returns the shared socket, creating/reconnecting it as needed. Returns
// null if there's no logged-in user (no token) - callers should treat that
// as "no realtime available right now" and rely on polling.
export const getSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;

  if (!socket) {
    socket = io(getSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    });
    return socket;
  }

  // Token may have changed (re-login as a different user) - refresh it.
  if (socket.auth?.token !== token) {
    socket.auth = { token };
    if (socket.connected) socket.disconnect();
  }
  if (!socket.connected) socket.connect();

  return socket;
};

// Call on logout so the next login gets a fresh, correctly authenticated socket.
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
