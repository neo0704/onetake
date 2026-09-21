const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMyNotificationPreference,
  updateMyNotificationPreference,
} = require('../controllers/notificationPreferenceController');

// No role restriction — every logged-in user manages only their own record
// (req.user.id), so there's nothing to gate by role here.
router.get('/', protect, getMyNotificationPreference);
router.patch('/', protect, updateMyNotificationPreference);

module.exports = router;

// Mounted in index.js as:
//   app.use('/api/notification-preferences', require('./routes/notificationPreferences'));