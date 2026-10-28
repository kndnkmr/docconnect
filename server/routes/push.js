// ============================================
// Push Routes - browser push notification subscription management
// ============================================

const express = require('express');
const router = express.Router();

const { getPublicKey, subscribe, unsubscribe, testAlarm, snooze, ack, testStatus } = require('../controllers/pushController');
const { protect } = require('../middleware/auth');

// GET /api/push/public-key - public, needed before login to prime the browser
router.get('/public-key', getPublicKey);

// POST /api/push/subscribe - save a subscription for the logged-in user
router.post('/subscribe', protect, subscribe);

// POST /api/push/unsubscribe - remove a subscription for the logged-in user
router.post('/unsubscribe', protect, unsubscribe);
// "🔔 Test my alarm" — rings the caller's own devices (rate-limited)
router.post('/test-alarm', protect, testAlarm);
// Call notification "In 5 min" — signed ring token instead of a login
router.post('/snooze', snooze);
// Delivery receipt from the phone (signed token, no login) — see pushController.ack
router.post('/ack', ack);
// Did my last alarm test reach my phone?
router.get('/test-status', protect, testStatus);

module.exports = router;
