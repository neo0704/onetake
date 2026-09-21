const User = require('../models/User');

// ── Get my own notification preference ────────────────────────────────────────
exports.getMyNotificationPreference = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('emailNotificationsEnabled');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, emailNotificationsEnabled: user.emailNotificationsEnabled });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update my own notification preference ─────────────────────────────────────
// Body: { emailNotificationsEnabled: boolean }
exports.updateMyNotificationPreference = async (req, res) => {
  try {
    const { emailNotificationsEnabled } = req.body;
    if (typeof emailNotificationsEnabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'emailNotificationsEnabled must be a boolean' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { emailNotificationsEnabled },
      { new: true }
    ).select('emailNotificationsEnabled');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, emailNotificationsEnabled: user.emailNotificationsEnabled });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};