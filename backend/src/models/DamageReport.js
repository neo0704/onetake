const mongoose = require('mongoose');

const damageReportSchema = new mongoose.Schema({
  event:      { type: mongoose.Schema.Types.ObjectId, ref: 'Event',     required: true },
  equipment:  { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User',      required: true },
  damageType: { type: String, enum: ['minor','major','destroyed','lost'], required: true },
  description:{ type: String, required: true },
  photos:     [{ type: String }],
  repairCost:        { type: Number, default: 0 },
  deductFromPayroll: { type: Boolean, default: false },
  deductionAmount:   { type: Number, default: 0 },
  status:     { type: String, enum: ['open','under_review','resolved'], default: 'open' },
  resolution: { type: String, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('DamageReport', damageReportSchema);
