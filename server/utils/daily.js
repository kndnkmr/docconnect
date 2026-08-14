// ============================================
// Daily.co helper - Video/Audio call rooms & tokens
// ============================================
// We use Daily's REST API to:
//   1. Create a PRIVATE room per appointment (auto-expires so stale rooms clean up)
//   2. Mint a short-lived meeting token that lets a specific user join that room
//
// This removes any login/sign-in step: the token authorizes the user, so the
// doctor and patient click "Join Call" and go straight into the call.
//
// Requires environment variables:
//   DAILY_API_KEY  - secret API key (kept only on the server, never in the client)
//   DAILY_DOMAIN   - your Daily subdomain, e.g. "promedicoz.daily.co"

const DAILY_API = 'https://api.daily.co/v1';

const authHeaders = () => ({
  Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
  'Content-Type': 'application/json'
});

// Ensure a room exists for the given name. Returns the room object.
// Idempotent: if it already exists, we reuse it.
async function ensureRoom(roomName) {
  // 1. Does the room already exist?
  const existing = await fetch(`${DAILY_API}/rooms/${roomName}`, { headers: authHeaders() });
  if (existing.ok) {
    return await existing.json();
  }

  // 2. Create it — private, auto-expire in 6 hours from now.
  const exp = Math.floor(Date.now() / 1000) + 6 * 60 * 60;
  const createRes = await fetch(`${DAILY_API}/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name: roomName,
      privacy: 'private', // requires a meeting token to join
      properties: {
        exp,
        enable_prejoin_ui: false,
        enable_chat: false,
        enable_screenshare: true
      }
    })
  });

  if (createRes.ok) {
    return await createRes.json();
  }

  // 3. Handle race: another request may have created it a moment ago.
  const retry = await fetch(`${DAILY_API}/rooms/${roomName}`, { headers: authHeaders() });
  if (retry.ok) {
    return await retry.json();
  }

  const errText = await createRes.text();
  throw new Error(`Daily room creation failed: ${errText}`);
}

// Create a meeting token authorizing a user to join a specific room.
// - isOwner: true for the doctor (moderator privileges)
// - startVideoOff: true for phone (audio-only) consultations
async function createMeetingToken({ roomName, userName, isOwner, startVideoOff }) {
  const exp = Math.floor(Date.now() / 1000) + 2 * 60 * 60; // token valid 2 hours

  const res = await fetch(`${DAILY_API}/meeting-tokens`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        is_owner: !!isOwner,
        start_video_off: !!startVideoOff,
        exp
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Daily token creation failed: ${errText}`);
  }

  const data = await res.json();
  return data.token;
}

module.exports = { ensureRoom, createMeetingToken };
