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

// ── Login lockout ──────────────────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
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
      existing.role = role || 'client';
      existing.phone = phone;
      existing.accountStatus = accountStatus;
      existing.verificationCode = { code, expiresAt: codeExpiry };
      user = await existing.save();
    } else {
      user = await User.create({
        name, email, password, role: role || 'client', phone,
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
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
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
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    // No such account — same generic message as a wrong password, so this
    // can't be used to enumerate which emails are registered.
    if (!user) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    // Already locked out from too many recent failed attempts — block before
    // even checking the password, and don't consume another attempt.
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        locked: true,
        message: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      });
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      let message = 'Incorrect email or password';
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
        user.loginAttempts = 0; // fresh count once the lock expires
        message = `Too many failed attempts. Your account is locked for ${LOCK_TIME_MS / 60000} minutes.`;
        await user.save({ validateModifiedOnly: true });
        logAuditEvent(user._id, 'account_locked', req);
        sendAccountLockedAlert(user, LOCK_TIME_MS / 60000).catch(e => console.error('Lockout email error:', e.message));
        return res.status(401).json({ success: false, message });
      } else {
        const remaining = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
        message = `Incorrect email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before your account is temporarily locked.`;
      }

      await user.save({ validateModifiedOnly: true });
      return res.status(401).json({ success: false, message });
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
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
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