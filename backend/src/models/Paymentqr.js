const mongoose = require('mongoose');

const paymentQRSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['gcash', 'maya', 'bank_transfer', 'cash', 'check', 'other'],
    required: true,
    unique: true   // one active QR config per method
  },
  label:      { type: String, required: true },          // e.g. "GCash – Juan Dela Cruz"
  qrImageUrl: { type: String },                          // uploaded QR image path
  accountName:   { type: String },                       // optional display info
  accountNumber: { type: String },
  instructions:  { type: String },                       // extra instructions for client
  isActive: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('PaymentQR', paymentQRSchema);