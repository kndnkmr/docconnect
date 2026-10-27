// ============================================
// Push Controller - manage browser push subscriptions
// ============================================
// Endpoints the frontend uses to turn push notifications on/off.

const User = require('../models/User');

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

module.exports = { getPublicKey, subscribe, unsubscribe };
