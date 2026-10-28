// ============================================
// Ring snooze tokens — lets the notification's "In 5 min" button work
// ============================================
// The service worker has no login token (that lives in the page's
// localStorage), so a call notification carries a small signed token that
// says "user U may snooze the ring for appointment A until time T". It can
// do nothing else. Signed with JWT_SECRET (HMAC-SHA256), expires with the
// slot.

const crypto = require('crypto');

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (body) => crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev-only').update(body).digest('base64url');

function makeRingToken(appointmentId, userId, expiresAtMs) {
  const body = b64(JSON.stringify({ a: String(appointmentId), u: String(userId), e: Math.floor(expiresAtMs) }));
  return `${body}.${sign(body)}`;
}

// Returns { appointmentId, userId } or null (bad signature / expired / junk).
function readRingToken(token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 600 || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = sign(body);
  if (!sig || sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!p || typeof p.a !== 'string' || typeof p.u !== 'string' || typeof p.e !== 'number') return null;
    if (now > p.e) return null;
    return { appointmentId: p.a, userId: p.u };
  } catch {
    return null;
  }
}

// Absolute URL of the snooze endpoint for the service worker, or '' if the
// server doesn't know its own public address (then the Later button is hidden).
// The same token also signs delivery receipts (POST /api/push/ack): "this
// alert for appointment A reached user U's phone". For the alarm test the
// "appointment" is the literal 'test'.
function pushApiUrl(path) {
  const base = (process.env.PUBLIC_API_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '').replace(/\/api$/, '');
  return base ? `${base}/api/push/${path}` : '';
}
const snoozeUrl = () => pushApiUrl('snooze');
const ackUrl = () => pushApiUrl('ack');

module.exports = { makeRingToken, readRingToken, snoozeUrl, ackUrl };
