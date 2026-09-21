const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: {
    type: String,
    enum: ['lights', 'sounds', 'video', 'photography', 'other'],
    required: true
  },
  description: { type: String },

  // Global fallback condition (used when qty === 1 or as a summary)
  condition: {
    type: String,
    enum: ['excellent', 'good', 'fair', 'needs_repair'],
    default: 'good'
  },

  quantity:          { type: Number, default: 1 },
  availableQuantity: { type: Number, default: 1 },

  // Per-unit serial numbers — one entry per unit in `quantity`.
  // e.g. quantity=3 → serialNumbers=['SN001','SN002',''] (empty = not recorded yet)
  serialNumbers: [{ type: String, default: '' }],

  // Per-unit condition — one entry per unit in `quantity`.
  // Falls back to top-level `condition` if not set.
  unitConditions: [{
    type: String,
    enum: ['excellent', 'good', 'fair', 'needs_repair'],
    default: 'good'
  }],

  // Per-unit availability — one entry per unit in `quantity`.
  // Falls back to top-level `availability` if not set.
  unitAvailabilities: [{
    type: String,
    enum: ['available', 'in_use', 'maintenance', 'retired'],
    default: 'available'
  }],

  // Global fallback availability
  availability: {
    type: String,
    enum: ['available', 'in_use', 'maintenance', 'retired'],
    default: 'available'
  },

  image:    { type: String },
  isActive: { type: Boolean, default: true },

  bookings: [{
    event:     { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    quantity:  Number,
    startDate: Date,
    endDate:   Date
  }]
}, { timestamps: true });

equipmentSchema.index({ name: 1 });
equipmentSchema.index({ category: 1, availability: 1 });

module.exports = mongoose.model('Equipment', equipmentSchema);