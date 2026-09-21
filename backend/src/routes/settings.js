const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

// Any authenticated user can read the setting (client/freelancer apps need this
// to know whether to show direct-message contacts). Only admins can change it.
router.get('/', protect, getSettings);
router.patch('/', protect, authorize('admin'), updateSettings);

module.exports = router;

// Mounted in index.js as:
//   app.use('/api/settings', require('./routes/settings'));
// combining with the '/' paths above to give GET/PATCH /api/settings