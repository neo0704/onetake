const mongoose = require('mongoose');

const portfolioImageSchema = new mongoose.Schema({
  url:     { type: String, required: true },
  caption: { type: String, default: '' },
}, { _id: true });

const portfolioProjectSchema = new mongoose.Schema({
  client:      { type: String, required: true },
  title:       { type: String, required: true },
  tags:        [{ type: String }],
  description: { type: String, default: '' },
  coverImage:  { type: String, default: '' }, // primary card image (falls back to images[0])
  images:      [portfolioImageSchema],
  featured:    { type: Boolean, default: false }, // pinned to top as hero
  isActive:    { type: Boolean, default: true },
  order:       { type: Number, default: 0 },
}, { timestamps: true });

const homepageContentSchema = new mongoose.Schema({
  // Singleton document — only one ever exists
  featuredVideo: {
    isActive: { type: Boolean, default: false },
    url:      { type: String, default: '' },    // YouTube / Vimeo / direct .mp4 URL
    title:    { type: String, default: 'Behind the Lens' },
    subtitle: { type: String, default: 'See how we bring your events to life.' },
  },
  portfolio: [portfolioProjectSchema],
}, { timestamps: true });

module.exports = mongoose.model('HomepageContent', homepageContentSchema);