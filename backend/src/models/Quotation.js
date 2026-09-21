const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  quotationNumber: { type: String, unique: true },

  services: [{
    name: String,
    description: String,
    quantity: Number,
    unitPrice: Number,
    total: Number
  }],

  equipment: [{
    name: String,
    quantity: Number,
    unitPrice: Number,
    total: Number
  }],

  manpower: [{
    role: String,
    quantity: Number,
    ratePerDay: Number,
    days: Number,
    total: Number
  }],

  subtotal: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  paymentTerms: {
    downpaymentPercentage: { type: Number, default: 50 },
    downpaymentAmount: Number,
    balanceAmount: Number
  },

  conditions: [{ type: String }],
  notes: { type: String },

  comments: [{
    author:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, enum: ['admin', 'staff', 'client'], required: true },
    text:       { type: String, required: true, trim: true },
    createdAt:  { type: Date, default: Date.now }
  }],

  status: {
    type: String,
    enum: ['draft', 'sent', 'approved', 'rejected', 'revised'],
    default: 'draft'
  },

  validUntil: { type: Date },
  clientSignature: { type: String },
  approvedAt: { type: Date },
  quotationSendType: { type: String, enum: ['premade', 'pdf'], default: 'premade' },
  quotationPdfUrl:   { type: String, default: '' }
}, { timestamps: true });

quotationSchema.pre('save', async function(next) {
  if (!this.quotationNumber) {
    const count = await mongoose.model('Quotation').countDocuments();
    this.quotationNumber = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Quotation', quotationSchema);