const crypto = require('crypto');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { sendNotification } = require('../services/notificationService');
const { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedAlert, sendAccountLockedAlert } = require('../services/emailService');
const AuditLog = require('../models/AuditLog');

const logAuditEvent = async (userId, action, req) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      ip: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
    });
  } catch (err) {
    console.error('[audit log] failed to record event:', err.message);
  }
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateCode = () => String(crypto.randomInt(100000, 999999));
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Password rules ─────────────────────────────────────────────────────────
// Length matters more than symbols: min 8, generous max (bcrypt only reads the
// first 72 bytes and huge inputs waste CPU), and a blocklist of the passwords
// attackers try first. Returns an error message, or null if the password is OK.
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', '12345678', '123456789',
  '1234567890', '11111111', '00000000', '12341234', 'qwerty123', 'qwertyuiop', 'qwerty12',
  '1q2w3e4r', 'abc12345', 'abcd1234', 'iloveyou', 'welcome1', 'welcome123', 'letmein123',
  'admin123', 'administrator', 'changeme', 'football1', 'monkey123', 'dragon123',
  'onetake123', 'livetake123', 'onetake1', 'livetake1',
]);
const validatePassword = (pw) => {
  if (typeof pw !== 'string' || !pw) return 'Password is required';
  if (pw.length < 8) return 'Password must be at least 8 characters';
  if (pw.length > 128) return 'Password must be 128 characters or fewer';
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return 'That password is too common. Please choose one that is harder to guess.';
  return null;
};

// ── Login lockout ──────────────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

exports.register = async (req, res) => {
  try {
    // Force plain strings (blocks NoSQL injection like { "email": { "$ne": null } })
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const name  = str(req.body.name);
    const email = str(req.body.email).toLowerCase();
    const phone = str(req.body.phone);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    // Only these two roles can self-register. Admin accounts are never created here.
    const role = req.body.role === 'freelancer' ? 'freelancer' : 'client';

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ success: false, message: pwError });

    const existing = await User.findOne({ email });

    // Only block if that email belongs to a fully verified (or Google-linked)
    // account. An abandoned signup — created but never verified — is treated
    // as if it never happened, and gets overwritten by this new attempt.
    if (existing && (existing.emailVerified || existing.googleId)) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const code = generateCode();
    const accountStatus = role === 'freelancer' ? 'pending' : 'active';
    const codeExpiry = new Date(Date.now() + CODE_TTL_MS);

    let user;
    if (existing) {
      // Overwrite the stale, never-verified record with the fresh attempt.
      existing.name = name;
      existing.password = password; // pre-save hook re-hashes since it's modified
      existing.role = role;
      existing.phone = phone;
      existing.accountStatus = accountStatus;
      existing.verificationCode = { code, expiresAt: codeExpiry };
      user = await existing.save();
    } else {
      user = await User.create({
        name, email, password, role, phone,
        emailVerified: false,
        accountStatus,
        verificationCode: { code, expiresAt: codeExpiry },
      });
    }

    try {
      await sendVerificationEmail(user, code);
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr.message);
      // Account still exists — user can hit /auth/resend-verification to retry.
    }

    // No token yet — account isn't usable until the email is verified.
    res.status(201).json({ success: true, needsVerification: true, email: user.email });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/verify-email
// Body: { email, code }
exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and code are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ success: false, message: 'Invalid email or code' });

    if (!user.emailVerified) {
      if (!user.verificationCode?.code || user.verificationCode.code !== code) {
        return res.status(400).json({ success: false, message: 'Incorrect code' });
      }
      if (!user.verificationCode.expiresAt || user.verificationCode.expiresAt < new Date()) {
        return res.status(400).json({ success: false, message: 'Code expired — request a new one' });
      }
      user.emailVerified = true;
      user.verificationCode = undefined;
      await user.save();
    }

    // Email confirmed, but freelancers still need an admin to approve them
    // before they can actually log in.
    if (user.accountStatus === 'pending') {
      return res.json({
        success: true,
        pending: true,
        message: 'Email verified! Your freelancer account is pending admin approval.',
      });
    }
    if (user.accountStatus === 'rejected') {
      return res.status(403).json({ success: false, message: 'This account was not approved. Contact support.' });
    }

    const token = generateToken(user._id);
    user.password = undefined;
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/resend-verification
// Body: { email }
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(400).json({ success: false, message: 'Account not found' });
    if (user.emailVerified) return res.status(400).json({ success: false, message: 'Email is already verified' });

    const code = generateCode();
    user.verificationCode = { code, expiresAt: new Date(Date.now() + CODE_TTL_MS) };
    await user.save();
    await sendVerificationEmail(user, code);

    res.json({ success: true, message: 'Verification code resent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/forgot-password
// Body: { email }
// Always responds with the same generic success message regardless of
// whether the email exists — prevents leaking which emails are registered.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const genericMessage = 'If an account exists for that email, a reset code has been sent.';
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // Google-only accounts (no password ever set) can't reset a password that
    // doesn't exist — they sign in via Google. Deliberately still returns the
    // same generic message either way, so this can't be used to fingerprint
    // which accounts are Google-linked.
    const eligible = user && user.isActive && user.password;

    if (eligible) {
      const code = generateCode();
      user.resetPasswordCode = { code, expiresAt: new Date(Date.now() + CODE_TTL_MS) };
      await user.save({ validateModifiedOnly: true });
      try {
        await sendPasswordResetEmail(user, code);
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr.message);
      }
    }

    res.json({ success: true, message: genericMessage });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/reset-password
// Body: { email, code, newPassword }
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, code, and new password are required' });
    }
    const newPwError = validatePassword(newPassword);
    if (newPwError) {
      return res.status(400).json({ success: false, message: newPwError });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    // Same wording whether the account doesn't exist or the code is wrong —
    // avoids confirming which emails are registered.
    if (!user || !user.resetPasswordCode?.code || user.resetPasswordCode.code !== code) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    }
    if (!user.resetPasswordCode.expiresAt || user.resetPasswordCode.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Code expired — request a new one' });
    }

    user.password = newPassword; // pre-save hook re-hashes since it's modified
    user.resetPasswordCode = undefined;
    await user.save({ validateModifiedOnly: true });

    logAuditEvent(user._id, 'password_reset', req);
    sendPasswordChangedAlert(user).catch(e => console.error('Password-changed alert error:', e.message));

    // Deliberately does NOT auto-login here — routes back through the normal
    // /login flow so isActive/accountStatus/emailVerified checks still apply.
    res.json({ success: true, message: 'Password reset successful. Please sign in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    // Force plain strings — blocks NoSQL injection such as { "email": { "$ne": null } }
    const email = typeof req.body.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');

    // No such account — same generic message as a wrong password, so this
    // can't be used to enumerate which emails are registered. The route-level
    // limiter still counts these attempts (IP + email).
    if (!user) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    // Already locked — block before checking the password. Same 429 shape as the
    // route limiter so the frontend handles both identically.
    if (user.lockUntil && user.lockUntil > new Date()) {
      const secondsLeft = Math.ceil((user.lockUntil - new Date()) / 1000);
      const minutesLeft = Math.ceil(secondsLeft / 60);
      return res.status(429).json({
        success: false,
        locked: true,
        retryAfter: secondsLeft,
        message: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      });
    }

    // Google-only accounts have no password — treat as a normal failed attempt.
    const passwordMatches = user.password ? await user.comparePassword(password) : false;
    if (!passwordMatches) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
        user.loginAttempts = 0; // fresh count once the lock expires
        await user.save({ validateModifiedOnly: true });
        logAuditEvent(user._id, 'account_locked', req);
        sendAccountLockedAlert(user, LOCK_TIME_MS / 60000).catch(e => console.error('Lockout email error:', e.message));
      } else {
        await user.save({ validateModifiedOnly: true });
      }

      // Identical response whether the account exists or not — no "N attempts
      // remaining" and no "locked" hint on the attempt that triggers the lock.
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    // Correct password — clear any prior failed-attempt count
    if (user.loginAttempts > 0 || user.lockUntil) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save({ validateModifiedOnly: true });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }
    if (!user.emailVerified && !user.googleId) {
      return res.status(403).json({
        success: false,
        needsVerification: true,
        email: user.email,
        message: 'Please verify your email before signing in',
      });
    }
    if (user.accountStatus === 'pending') {
      return res.status(403).json({
        success: false,
        pending: true,
        message: 'Your freelancer account is still pending admin approval',
      });
    }
    if (user.accountStatus === 'rejected') {
      return res.status(403).json({ success: false, message: 'This account was not approved. Contact support.' });
    }
    const token = generateToken(user._id);
    user.password = undefined;
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/google
// Body: { credential }  <- the ID token returned by Google Identity Services on the frontend
exports.googleLogin = async (req, res) => {
  try {
    const { credential, role } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Missing Google credential' });
    }

    // Verify the token with Google — this confirms it was really issued by Google
    // for OUR client ID and hasn't been tampered with.
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Google account has no email' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Existing account (e.g. originally registered with a password) — link Google to it.
      // Google has already confirmed this person owns the inbox, so treat it as verified too.
      if (!user.googleId || !user.emailVerified) {
        // If this account was never email-verified, whoever created it may not own the
        // inbox (someone could have pre-registered this address with their own password).
        // Drop that password now that the real owner has proven themselves via Google.
        if (!user.emailVerified) user.password = undefined;
        user.googleId = googleId;
        user.emailVerified = true;
        if (!user.avatar && picture) user.avatar = picture;
        await user.save();
      }
    } else {
      // Brand new user signing up via Google — role comes from the toggle on
      // the register page; defaults to client if it wasn't sent (e.g. login page).
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        avatar: picture || '',
        role: role === 'freelancer' ? 'freelancer' : 'client',
        emailVerified: true,
        accountStatus: role === 'freelancer' ? 'pending' : 'active',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }
    if (user.accountStatus === 'pending') {
      return res.status(403).json({
        success: false,
        pending: true,
        message: 'Your freelancer account is pending admin approval.',
      });
    }
    if (user.accountStatus === 'rejected') {
      return res.status(403).json({ success: false, message: 'This account was not approved. Contact support.' });
    }

    const token = generateToken(user._id);
    user.password = undefined;
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Google authentication failed' });
  }
};

// PUT /api/auth/change-password  (logged-in user changes their own password)
// Body: { currentPassword, newPassword }
// If the account has no password yet (Google-only), currentPassword isn't
// required — this lets them add a password login option for the first time.
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }
    const newPwError = validatePassword(newPassword);
    if (newPwError) {
      return res.status(400).json({ success: false, message: newPwError });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required' });
      }
      const matches = await user.comparePassword(currentPassword);
      if (!matches) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
    }
    // else: Google-only account with no password yet — skip the current-password
    // check and let this call set one for the first time.

    user.password = newPassword; // pre-save hook re-hashes since it's modified
    await user.save({ validateModifiedOnly: true });

    logAuditEvent(user._id, 'password_changed', req);
    sendPasswordChangedAlert(user).catch(e => console.error('Password-changed alert error:', e.message));

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address, bio, skills, hourlyRate } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, address, bio, skills, hourlyRate },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateFCMToken = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { fcmToken: req.body.fcmToken });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/approve/:id  (admin only)
// Body: { approve: true } to activate, { approve: false } to reject
exports.approveFreelancer = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role !== 'freelancer') {
      return res.status(400).json({ success: false, message: 'Only freelancer accounts require approval' });
    }

    const approve = req.body.approve !== false;
    user.accountStatus = approve ? 'active' : 'rejected';
    await user.save();

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/pending-freelancers  (admin only)
exports.getPendingFreelancers = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const users = await User.find({ role: 'freelancer', accountStatus: 'pending' }).sort('-createdAt');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};