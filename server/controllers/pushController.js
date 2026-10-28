// ============================================
// Push Controller - manage browser push subscriptions
// ============================================
// Endpoints the frontend uses to turn push notifications on/off.

const User = require('../models/User');
const { sendPushToUser, RING_PUSH_OPTS } = require('../utils/push');
const { readRingToken, makeRingToken, ackUrl } = require('../utils/ringToken');
// Locked-screen test: ring after this delay so the person can lock the phone.
const LOCKED_TEST_DELAY_MS = 15 * 1000;
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
    // Locked-screen test: wait 15 s so the person can lock their phone first.
    const locked = Boolean(req.body && req.body.locked);
    const delayMs = locked ? LOCKED_TEST_DELAY_MS : 0;
    const me = await User.findById(req.user._id).select('pushSubscriptions');
    const devices = (me && me.pushSubscriptions ? me.pushSubscriptions.length : 0);
    if (!devices) {
      return res.status(400).json({ message: 'No phone or browser with call alerts was found for your account. Turn on call alerts first.' });
    }
    const sendAt = new Date(now + delayMs);
    await User.updateOne({ _id: req.user._id }, { $set: { alarmTest: { sentAt: sendAt, locked, seenAt: null } } });
    const url = ackUrl();
    const payload = {
      kind: 'call',
      title: locked ? '🔒 Locked-screen test — ProMedicoz' : '🔔 Test alarm — ProMedicoz',
      body: 'If your phone rang or vibrated, call alerts work. Tap to close.',
      url: '/dashboard',
      tag: 'test-alarm',
      // Receipt: the phone confirms it showed this (see /push/ack).
      ackUrl: url || undefined,
      ackToken: url ? makeRingToken('test', String(req.user._id), now + delayMs + 10 * 60 * 1000) : undefined,
    };
    const send = () => sendPushToUser(req.user._id, payload, RING_PUSH_OPTS);
    if (delayMs) {
      setTimeout(() => { send().catch(() => {}); }, delayMs).unref?.();
      return res.json({ message: `Lock your phone now — it will ring in ${Math.round(delayMs / 1000)} seconds.`, delayMs, sendAt, receipts: Boolean(url) });
    }
    const delivered = await send();
    if (!delivered) {
      return res.status(400).json({ message: 'No phone or browser with call alerts was found for your account. Turn on call alerts first.' });
    }
    res.json({ message: `Test alarm sent to ${delivered} device${delivered === 1 ? '' : 's'}.`, delivered, delayMs: 0, sendAt, receipts: Boolean(url) });
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

// ---- Delivery receipt from the phone (service worker, no login) ----
// POST /api/push/ack  { token }  — token = signed { appointment|'test', user }
// from the alert payload. Records that the alert really reached that phone.
const ack = async (req, res) => {
  try {
    const t = readRingToken(req.body && req.body.token);
    if (!t) return res.status(400).json({ message: 'Invalid or expired' });
    const now = new Date();
    if (t.appointmentId === 'test') {
      await User.updateOne({ _id: t.userId, 'alarmTest.seenAt': null }, { $set: { 'alarmTest.seenAt': now } });
      return res.json({ ok: true });
    }
    const Appointment = require('../models/Appointment');
    const apt = await Appointment.findById(t.appointmentId).select('doctor patient callAlerts');
    if (!apt) return res.status(400).json({ message: 'not found' });
    const role = String(apt.doctor) === t.userId ? 'doctor' : String(apt.patient) === t.userId ? 'patient' : null;
    if (!role) return res.status(400).json({ message: 'not a participant' });
    if (!(apt.callAlerts && apt.callAlerts[role] && apt.callAlerts[role].seenAt)) {
      await Appointment.updateOne({ _id: apt._id }, { $set: { [`callAlerts.${role}.seenAt`]: now } });
      // Tell both open Dashboards so "their phone didn't get it" clears live.
      try { require('../utils/live').appointmentChanged(req, apt); } catch { /* best effort */ }
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Push ack error:', error.message);
    res.status(500).json({ message: 'Error' });
  }
};

// ---- Result of my last alarm test (for the "did it ring?" check) ----
const testStatus = async (req, res) => {
  const me = await User.findById(req.user._id).select('alarmTest');
  res.json({ alarmTest: (me && me.alarmTest) || null });
};

module.exports = { getPublicKey, subscribe, unsubscribe, testAlarm, snooze, ack, testStatus };
