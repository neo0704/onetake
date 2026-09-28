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

// ── Atomic quotation numbering ───────────────────────────────────────────────
// A counter document per year is incremented atomically, so numbers stay unique even
// when quotations are deleted or two are created at the same moment.
// (The old approach — countDocuments() + 1 — reused numbers after any deletion.)
const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

async function nextQuotationNumber() {
  const year = new Date().getFullYear();
  const key  = `quotation-${year}`;

  // Make sure the counter is never behind the highest number already in the database
  // (this also seeds it correctly the first time this code runs on existing data).
  const latest = await mongoose.model('Quotation')
    .findOne({ quotationNumber: new RegExp(`^QT-${year}-`) })
    .sort({ quotationNumber: -1 })
    .select('quotationNumber')
    .lean();
  const floor = latest ? parseInt(latest.quotationNumber.split('-')[2], 10) || 0 : 0;

  const bump = async () => {
    await Counter.findOneAndUpdate({ _id: key }, { $max: { seq: floor } }, { upsert: true });
    return Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true });
  };

  let counter;
  try {
    counter = await bump();
  } catch (err) {
    if (err.code === 11000) counter = await bump(); // two first-time requests raced on the upsert
    else throw err;
  }
  return `QT-${year}-${String(counter.seq).padStart(4, '0')}`;
}

quotationSchema.pre('save', async function (next) {
  try {
    if (!this.quotationNumber) this.quotationNumber = await nextQuotationNumber();
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Quotation', quotationSchema);