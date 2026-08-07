const express = require('express');
const router = express.Router();
const { getMessages, sendMessage, getUnreadCount, blockPatient, unblockPatient } = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Static routes FIRST (before :appointmentId parameter route)
router.get('/unread/count', getUnreadCount);
router.post('/block/:patientId', authorize('doctor'), blockPatient);
router.post('/unblock/:patientId', authorize('doctor'), unblockPatient);

// Dynamic routes AFTER
router.get('/:appointmentId', getMessages);
router.post('/:appointmentId', sendMessage);

module.exports = router;
