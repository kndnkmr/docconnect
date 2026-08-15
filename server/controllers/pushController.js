// ============================================
// Push Controller - manage browser push subscriptions
// ============================================
// Endpoints the frontend uses to turn push notifications on/off.

const User = require('../models/User');

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

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushSubscriptions: { endpoint: subscription.endpoint } }
    });
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        pushSubscriptions: {
          endpoint: subscription.endpoint,
          keys: subscription.keys
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
