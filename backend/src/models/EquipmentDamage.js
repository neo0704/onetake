const mongoose = require('mongoose');

const equipmentDamageSchema = new mongoose.Schema({
  equipment: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Equipment', 
    required: true 
  },
  event: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true 
  },
  freelancer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  reportedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },

  damageType: { 
    type: String, 
    enum: ['minor', 'moderate', 'major', 'destroyed', 'lost'], 
    required: true 
  },
  description: { type: String, required: true },
  photos: [{ type: String }],

  estimatedRepairCost: { type: Number, default: 0 },
  actualRepairCost: { type: Number },

  status: {
    type: String,
    enum: ['reported', 'under_review', 'disputed', 'resolved'],
    default: 'reported'
  },

  decision: {
    type: String,
    enum: ['pending', 'freelancer_pays', 'company_absorbs', 'waived']
  },
  notes: String,
  resolvedAt: Date,
  disputeReason: String
}, { timestamps: true });

module.exports = mongoose.model('EquipmentDamage', equipmentDamageSchema);