// ============================================
// Push Routes - browser push notification subscription management
// ============================================

const express = require('express');
const router = express.Router();

const { getPublicKey, subscribe, unsubscribe } = require('../controllers/pushController');
const { protect } = require('../middleware/auth');

// GET /api/push/public-key - public, needed before login to prime the browser
router.get('/public-key', getPublicKey);

// POST /api/push/subscribe - save a subscription for the logged-in user
router.post('/subscribe', protect, subscribe);

// POST /api/push/unsubscribe - remove a subscription for the logged-in user
router.post('/unsubscribe', protect, unsubscribe);

module.exports = router;
