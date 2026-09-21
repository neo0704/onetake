const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },

  // Password is only required for accounts that sign in with email/password.
  // Google accounts authenticate via googleId instead.
  password: {
    type: String,
    required: function () { return !this.googleId; },
  },

  // Set when the user signs in with "Continue with Google"
  googleId: { type: String, unique: true, sparse: true },

  // Failed-login lockout — after MAX_LOGIN_ATTEMPTS wrong passwords in a row,
  // the account is locked until lockUntil passes. Resets to 0 on any
  // successful login. Not used for Google sign-in, which has no password.
  loginAttempts: { type: Number, default: 0 },
  lockUntil:     { type: Date },

  role:     { type: String, enum: ['admin', 'client', 'freelancer'], default: 'client' },

  // Contact
  phone:   { type: String, default: '' },
  address: { type: String, default: '' },

  // Freelancer profile fields
  age:     { type: Number },
  bio:     { type: String, default: '' },
  skills:  { type: [String], default: [] },
  avatar:  { type: String, default: '' },

  // Availability (freelancer)
  availability: {
    type:    String,
    enum:    ['available', 'busy', 'unavailable', 'on_leave'],
    default: 'available',
  },

  // Rate (freelancer)
  rate: { type: Number, default: null },
  rateType: {
    type:    String,
    enum:    ['hourly', 'fixed'],
    default: 'hourly',
  },

  // Emergency contact
  emergencyContact: { type: String, default: '' },
  emergencyPhone:   { type: String, default: '' },

  // Social media
  socialFacebook:  { type: String, default: '' },
  socialInstagram: { type: String, default: '' },

  // Client info
  company:  { type: String, default: '' },

  // Ratings / metadata
  rating:      { type: Number, default: 5 },
  isActive:    { type: Boolean, default: true },
  lastLogin:   { type: Date },

  // Whether this user gets emailed for their notifications (in-app
  // notifications always happen regardless). Defaults to on. Controlled via
  // the Notification Settings panel — PATCH /api/notification-preferences.
  emailNotificationsEnabled: { type: Boolean, default: true },

  // Email verification — Google accounts are auto-verified since Google
  // already confirms account ownership; email/password accounts must
  // confirm a one-time code sent to their inbox before they can log in.
  emailVerified: { type: Boolean, default: false },
  verificationCode: {
    code:      { type: String },
    expiresAt: { type: Date },
  },

  // Forgot-password flow — separate from verificationCode above so an
  // in-progress signup verification and an in-progress password reset
  // never clobber each other if both happen close together.
  resetPasswordCode: {
    code:      { type: String },
    expiresAt: { type: Date },
  },

  // Freelancers require admin approval before they can log in — clients
  // and admins are 'active' immediately. Set to 'pending' on creation for
  // any user registering with role: 'freelancer' (see authController).
  accountStatus: {
    type:    String,
    enum:    ['pending', 'active', 'rejected'],
    default: 'active',
  },

  // Set on every password change (initial signup, change-password, or
  // reset-password). Used to invalidate any JWT issued before this moment —
  // see middleware/auth.js — so a stolen/old token stops working the instant
  // the password changes, instead of remaining valid until it naturally expires.
  passwordChangedAt: { type: Date },

}, { timestamps: true });

// Hash password before save (skip if there's no password, e.g. Google accounts).
// Also stamps passwordChangedAt so existing tokens can be invalidated.
userSchema.pre('save', async function(next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false; // Google-only account, no password to compare
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);