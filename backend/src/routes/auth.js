const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { register, login, googleLogin, getMe, updateProfile, updateFCMToken, verifyEmail, resendVerification, approveFreelancer, getPendingFreelancers, forgotPassword, resetPassword, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// express-rate-limit v8 exports ipKeyGenerator (IPv6-safe); v7 doesn't. Works with both.
const { ipKeyGenerator } = require('express-rate-limit');
const ipKey = (req) => (ipKeyGenerator ? ipKeyGenerator(req.ip) : req.ip);

const emailOf = (req) => (typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '');

const tooMany = (message) => (req, res) => {
  const retryAfter = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000));
  res.status(429).json({ success: false, message, retryAfter });
};

// 5 failed logins per 15 min for the same IP + email.
// Counts emails that don't exist too, so attackers can't tell which accounts are real.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKey(req)}:${emailOf(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many login attempts. Please try again later.'),
});

// Stops one IP from cycling through many different emails.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => ipKey(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many login attempts from this network. Please try again later.'),
});

// Email spam / abuse: register, forgot-password, resend-verification.
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => ipKey(req),
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many requests. Please try again later.'),
});

// 6-digit codes can be brute-forced (only 900k combinations).
// Keyed by EMAIL ONLY so rotating IPs doesn't help an attacker.
const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `code:${emailOf(req) || ipKey(req)}`,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many attempts. Please request a new code or try again later.'),
});

router.post('/register', sensitiveLimiter, register);
router.post('/login', loginIpLimiter, loginLimiter, login);
router.post('/google', loginIpLimiter, googleLogin);
router.post('/verify-email', codeLimiter, verifyEmail);
router.post('/resend-verification', sensitiveLimiter, resendVerification);
router.post('/forgot-password', sensitiveLimiter, forgotPassword);
router.post('/reset-password', codeLimiter, resetPassword);
router.get('/pending-freelancers', protect, getPendingFreelancers);
router.put('/approve/:id', protect, approveFreelancer);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/fcm-token', protect, updateFCMToken);
router.put('/change-password', protect, changePassword);
module.exports = router;