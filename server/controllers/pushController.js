// ============================================
// Push Controller - manage browser push subscriptions
// ============================================
// Endpoints the frontend uses to turn push notifications on/off.

const User = require('../models/User');
const { sendPushToUser, RING_PUSH_OPTS } = require('../utils/push');
const { readRingToken } = require('../utils/ringToken');
const { snoozeRing } = require('../utils/callReminder');

const MAX_SUBSCRIPTIONS = 10; // devices/browsers per account

// A browser push subscription: https endpoint + two short base64url keys.
function isValidSubscription(sub) {
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length > 1000) return false;
  try {
    if (new URL(sub.endpoint).protocol !== 'https:') return false;
  } catch (e) {
    return false;
  }
  const { p256dh, auth } = sub.keys || {};
  const keyOk = (k) => typeof k === 'string' && k.length > 0 && k.length <= 200 && /^[A-Za-z0-9_\-=+/]+$/.test(k);
  return keyOk(p256dh) && keyOk(auth);
}

// GET /api/push/public-key (public — needed before the browser can subscribe)
const getPublicKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
};

// POST /api/push/subscribe (protected)
// Body: { subscription: { endpoint, keys: { p256dh, auth } } }
// Called after the browser grants notification permission and the frontend
// calls pushManager.subscribe(). Dedupes by endpoint so re-subscribing the
// same device/browser doesn't create duplicate entries.
const subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }
    // The server later POSTs to this endpoint, so it must be a real https
    // URL (browser push services always are). This stops the server being
    // pointed at internal/plain-http addresses.
    if (!isValidSubscription(subscription)) {
      return res.status(400).json({ message: 'Invalid subscription' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushSubscriptions: { endpoint: subscription.endpoint } }
    });
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        pushSubscriptions: {
          // Keep only the newest few devices per account.
          $each: [{
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
          }],
          $slice: -MAX_SUBSCRIPTIONS
        }
      }
    });

    res.json({ message: 'Subscribed to push notifications' });
  } catch (error) {
    console.error('Push subscribe error:', error.message);
    res.status(500).json({ message: 'Error saving subscription' });
  }
};

// POST /api/push/unsubscribe (protected)
// Body: { endpoint }
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ message: 'endpoint is required' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushSubscriptions: { endpoint } }
    });

    res.json({ message: 'Unsubscribed from push notifications' });
  } catch (error) {
    console.error('Push unsubscribe error:', error.message);
    res.status(500).json({ message: 'Error removing subscription' });
  }
};

// POST /api/push/test-alarm (protected)
// "🔔 Test my alarm": rings THIS account's devices with the same alarm-style
// notification a call uses, so people can check sound/volume/permission
// before their appointment. At most once every 30 s per account.
const lastTest = new Map();
const testAlarm = async (req, res) => {
  try {
    const key = String(req.user._id);
    const now = Date.now();
    if (now - (lastTest.get(key) || 0) < 30 * 1000) {
      return res.status(429).json({ message: 'Just sent one. Please wait a few seconds and try again.' });
    }
    lastTest.set(key, now);
    const delivered = await sendPushToUser(req.user._id, {
      kind: 'call',
      title: '🔔 Test alarm — ProMedicoz',
      body: 'If your phone rang or vibrated, call alerts work. Tap to close.',
      url: '/dashboard',
      tag: 'test-alarm',
    }, RING_PUSH_OPTS);
    if (!delivered) {
      return res.status(400).json({ message: 'No phone or browser with call alerts was found for your account. Turn on call alerts first.' });
    }
    res.json({ message: `Test alarm sent to ${delivered} device${delivered === 1 ? '' : 's'}.`, delivered });
  } catch (error) {
    console.error('Test alarm error:', error.message);
    res.status(500).json({ message: 'Error sending test alarm' });
  }
};

// POST /api/push/snooze (public, signed token)
// The call notification's "In 5 min" button. The service worker has no login
// token, so the notification carries a signed ring token (utils/ringToken.js)
// that only allows snoozing this one ring for this one person.
const snooze = async (req, res) => {
  try {
    const t = readRingToken(req.body && req.body.token);
    if (!t) return res.status(400).json({ message: 'Invalid or expired' });
    const r = await snoozeRing(t.appointmentId, t.userId);
    if (!r.ok) return res.status(400).json({ message: r.reason });
    res.json({ message: 'OK, ringing again in 5 minutes', at: r.at });
  } catch (error) {
    console.error('Snooze error:', error.message);
    res.status(500).json({ message: 'Error' });
  }
};

module.exports = { getPublicKey, subscribe, unsubscribe, testAlarm, snooze };
