const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
router.get('/', protect, ctrl.getNotifications);
router.put('/mark-all-read', protect, ctrl.markAllRead);
router.put('/:id/read', protect, ctrl.markRead);
router.delete('/:id', protect, ctrl.deleteNotification);
module.exports = router;
