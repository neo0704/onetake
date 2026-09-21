const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  event:      { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  quotation:  { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  client:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  paymentNumber: { type: String },   // NOT unique — generated safely in pre-save
  type:   { type: String, enum: ['downpayment', 'balance', 'full'], required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['gcash', 'maya', 'bank_transfer', 'cash', 'check', 'other'], required: true },
  referenceNumber: { type: String },
  proofUrl:        { type: String },

  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },

  notes:           { type: String },
  verifiedAt:      { type: Date },
  rejectionReason: { type: String }
}, { timestamps: true });

// Safe paymentNumber generation — uses timestamp+random to avoid duplicates
paymentSchema.pre('save', async function(next) {
  try {
    if (!this.paymentNumber) {
      const ts    = Date.now().toString().slice(-6);
      const rand  = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      this.paymentNumber = `PAY-${new Date().getFullYear()}-${ts}${rand}`;
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Payment', paymentSchema);