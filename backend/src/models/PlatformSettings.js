const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  // When false, clients and freelancers can no longer message each other
  // directly (conversations.type === 'freelancer_client'). All messages
  // still route through the admin (client_admin / admin_freelancer).
  allowClientFreelancerDirectMessages: { type: Boolean, default: true },

  // When false, freelancers assigned to the same event can no longer message
  // each other directly (conversations.type === 'freelancer_freelancer').
  allowFreelancerFreelancerDirectMessages: { type: Boolean, default: true },
}, { timestamps: true });

// Singleton accessor — always returns (and lazily creates) the one settings doc.
// Using this everywhere instead of `findOne()` directly guarantees callers
// never have to null-check a missing settings document.
platformSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);