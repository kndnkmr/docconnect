const express = require('express');
const router = express.Router();
const { getMessages, sendMessage, getUnreadCount, blockPatient, unblockPatient } = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Messages for an appointment
router.get('/:appointmentId', getMessages);
router.post('/:appointmentId', sendMessage);

// Unread count
router.get('/unread/count', getUnreadCount);

// Block/unblock patient (doctor only)
router.post('/block/:patientId', authorize('doctor'), blockPatient);
router.post('/unblock/:patientId', authorize('doctor'), unblockPatient);

module.exports = router;
