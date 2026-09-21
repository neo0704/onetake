const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  freelancer:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event:         { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  payrollNumber: { type: String },

  period: {
    from: { type: Date, required: true },
    to:   { type: Date, required: true },
  },

  role:       { type: String, default: '' },
  daysWorked: { type: Number, default: 1 },
  ratePerDay: { type: Number, required: true, default: 0 },
  grossPay:   { type: Number, default: 0 },

  deductions: [{ label: { type: String }, amount: { type: Number, default: 0 } }],
  totalDeductions: { type: Number, default: 0 },

  bonuses: [{ label: { type: String }, amount: { type: Number, default: 0 } }],
  totalBonuses: { type: Number, default: 0 },

  netPay: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['draft', 'pending', 'paid'],
    default: 'draft'
  },

  paymentMethod:   { type: String, enum: ['gcash', 'bank_transfer', 'cash', 'other'], default: 'gcash' },
  referenceNumber: { type: String, default: '' },
  notes:           { type: String, default: '' },
  paidAt:          { type: Date },

}, { timestamps: true });

// Auto-calculate pay on every save
payrollSchema.pre('save', async function (next) {
  try {
    // Generate payroll number if not set
    if (!this.payrollNumber) {
      const count = await this.constructor.countDocuments();
      this.payrollNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    }

    // Recalculate totals
    this.grossPay        = (parseFloat(this.daysWorked) || 0) * (parseFloat(this.ratePerDay) || 0);
    this.totalDeductions = (this.deductions || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
    this.totalBonuses    = (this.bonuses    || []).reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
    this.netPay          = this.grossPay + this.totalBonuses - this.totalDeductions;

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Payroll', payrollSchema);
