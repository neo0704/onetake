const PlatformSettings = require('../models/PlatformSettings');

// ── Get platform settings (admin) ─────────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update platform settings (admin) ──────────────────────────────────────────
// Body: { allowClientFreelancerDirectMessages?: boolean, allowFreelancerFreelancerDirectMessages?: boolean }
exports.updateSettings = async (req, res) => {
  try {
    const { allowClientFreelancerDirectMessages, allowFreelancerFreelancerDirectMessages } = req.body;
    const settings = await PlatformSettings.getSettings();

    if (typeof allowClientFreelancerDirectMessages === 'boolean') {
      settings.allowClientFreelancerDirectMessages = allowClientFreelancerDirectMessages;
    }
    if (typeof allowFreelancerFreelancerDirectMessages === 'boolean') {
      settings.allowFreelancerFreelancerDirectMessages = allowFreelancerFreelancerDirectMessages;
    }
    await settings.save();

    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};