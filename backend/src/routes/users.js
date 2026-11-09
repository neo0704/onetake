const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const cloudinary = require('cloudinary').v2;
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { countUnfinishedProjects, unfinishedMessage } = require('../utils/userRecords');
const crypto  = require('crypto');
const { sendAccountDeletionCodeEmail } = require('../services/emailService');

// ── Cloudinary (permanent image storage) ───────────────────────────────────
// Uses the same CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
// env vars already configured for uploadRoute.js / paymentController.js.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Multer for profile avatars ────────────────────────────────────────────────
// Keep the file in memory, then send it straight to Cloudinary.
// Nothing is written to the server's disk (Render wipes it on every restart).
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed')),
});

const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `onetake/${folder}`, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
// ─────────────────────────────────────────────────────────────────────────────

// ── Input rules for admin-created / admin-edited users ─────────────────────
const NAME_RE  = /^[\p{L}][\p{L}\p{M}\s.'-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES    = ['admin', 'client', 'freelancer'];

// Checks only the fields that are present (pass { create: true } to require the core ones).
// Returns { error } or { clean } with trimmed / normalised values.
const validateUserFields = (body, { create = false } = {}) => {
  const clean = {};

  if (create || body.name !== undefined) {
    const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 60) return { error: 'Name must be 2 to 60 characters' };
    if (!NAME_RE.test(name)) return { error: 'Name can only contain letters, spaces, periods, apostrophes and hyphens' };
    clean.name = name;
  }
  if (create || body.email !== undefined) {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (email.length > 100 || !EMAIL_RE.test(email)) return { error: 'Enter a valid email address (max 100 characters)' };
    clean.email = email;
  }
  if (create || body.password !== undefined) {
    const pw = String(body.password ?? '');
    if (pw.length < 8 || pw.length > 64) return { error: 'Password must be 8 to 64 characters' };
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return { error: 'Password must include at least one letter and one number' };
    clean.password = pw;
  }
  if (body.phone !== undefined && String(body.phone).trim() !== '') {
    const phone = String(body.phone).trim().replace(/[\s()-]/g, '');
    if (!/^\+?\d{7,15}$/.test(phone)) return { error: 'Phone number must be 7 to 15 digits (it can start with +)' };
    clean.phone = phone;
  }
  if (body.role !== undefined && body.role !== '' && !ROLES.includes(body.role)) {
    return { error: 'Invalid role' };
  }
  return { clean };
};

// GET /api/users — admin gets all, filtered by role
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const query = {};
    if (req.query.role) query.role = req.query.role;
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/users — admin creates a user (the Users page "Add User" form calls this)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!req.body.name || !req.body.email || !req.body.password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    const { error, clean } = validateUserFields(req.body, { create: true });
    if (error) return res.status(400).json({ success: false, message: error });

    const { name, email, password, phone } = clean;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });

    // Admin-created accounts are approved straight away (no pending state).
    const user = await User.create({
      name, email, password, phone, role: role || 'client',
      accountStatus: 'active', isActive: true,
      emailVerified: true,
    });
    const safe = user.toObject(); delete safe.password;
    res.status(201).json({ success: true, user: safe });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/users/:id — get single user (admin or self)
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/users/profile — update own profile (any authenticated user)
// NOTE: must be before /:id route so it matches first
router.put('/profile', protect, async (req, res) => {
  try {
    const ALLOWED = [
      'name', 'phone', 'address', 'age', 'bio',
      'skills', 'availability', 'rate', 'rateType',
      'emergencyContact', 'emergencyPhone',
      'socialFacebook', 'socialInstagram',
      'company',
    ];

    const update = {};
    ALLOWED.forEach(k => {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    });

    // Email change — check for duplicates
    if (req.body.email && req.body.email !== req.user.email) {
      const existing = await User.findOne({ email: req.body.email });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
      update.email = req.body.email.toLowerCase();
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/users/profile/avatar — upload/replace own avatar
router.post('/profile/avatar', protect, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: 'Image storage is not configured on the server' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'avatars');
    const avatarUrl = result.secure_url;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password');

    res.json({ success: true, user, avatar: avatarUrl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/profile/avatar — remove own avatar
router.delete('/profile/avatar', protect, async (req, res) => {
  try {
    const current = await User.findById(req.user.id).select('avatar');

    if (current?.avatar?.includes('res.cloudinary.com')) {
      // New-style avatar: stored on Cloudinary
      const m = current.avatar.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
      if (m) await cloudinary.uploader.destroy(m[1]).catch(() => {}); // best-effort
    } else if (current?.avatar?.startsWith('/uploads/')) {
      // Old-style avatar: was saved on the server's disk before this endpoint
      // moved to Cloudinary. Most of these are already gone (Render wipes disk
      // on restart), so this is just a best-effort cleanup for any that remain.
      const filePath = path.join(__dirname, '../..', current.avatar);
      fs.unlink(filePath, () => {});
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: '' },
      { new: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Self-service account deletion (clients) ────────────────────────────────
// Flow: POST /account/delete-request  → emails a 6-digit code
//       DELETE /account { code }       → verifies the code, then deletes
// These MUST stay above the '/:id' routes so 'account' isn't read as an id.
const DELETE_CODE_TTL_MS   = 10 * 60 * 1000; // code valid for 10 minutes
const DELETE_CODE_COOLDOWN = 60 * 1000;      // min gap between code emails
const DELETE_MAX_ATTEMPTS  = 5;              // wrong guesses before the code is burned

// Only a hash is stored, salted with the user id, so a DB leak doesn't expose live codes.
const hashDeleteCode = (userId, code) =>
  crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

// Returns a 409 payload if the user still has unfinished projects, else null.
const activeProjectsBlock = async (userId) => {
  const n = await countUnfinishedProjects(userId);
  if (n === 0) return null;
  return {
    success: false,
    code: 'USER_HAS_ACTIVE_PROJECTS',
    message: `You still have ${n} active project${n === 1 ? '' : 's'}. You can delete your account once all projects are completed or cancelled.`,
  };
};

// POST /api/users/account/delete-request — step 1: email a verification code
router.post('/account/delete-request', protect, async (req, res) => {
  try {
    if (!['client', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'This account type cannot be deleted this way' });
    }
    const user = await User.findById(req.user.id).select('name email deleteAccountCode');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const blocked = await activeProjectsBlock(user._id);
    if (blocked) return res.status(409).json(blocked);

    const sentAt = user.deleteAccountCode?.sentAt;
    if (sentAt && Date.now() - new Date(sentAt).getTime() < DELETE_CODE_COOLDOWN) {
      return res.status(429).json({ success: false, message: 'Please wait a minute before requesting another code' });
    }

    const code = String(crypto.randomInt(100000, 1000000)); // 6 digits
    await User.findByIdAndUpdate(user._id, {
      deleteAccountCode: {
        code:      hashDeleteCode(user._id, code),
        expiresAt: new Date(Date.now() + DELETE_CODE_TTL_MS),
        sentAt:    new Date(),
        attempts:  0,
      },
    });

    try {
      await sendAccountDeletionCodeEmail(user, code);
    } catch (mailErr) {
      await User.findByIdAndUpdate(user._id, { $unset: { deleteAccountCode: 1 } });
      return res.status(500).json({ success: false, message: 'Could not send the verification email. Please try again.' });
    }

    res.json({ success: true, message: 'Verification code sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/users/account — step 2: verify the code and delete the account
router.delete('/account', protect, async (req, res) => {
  try {
    if (!['client', 'freelancer'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'This account type cannot be deleted this way' });
    }
    const code = String(req.body?.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Enter the 6-digit code from your email' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const rec = user.deleteAccountCode;
    if (!rec?.code || !rec.expiresAt || new Date(rec.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, message: 'This code has expired. Please request a new one.' });
    }
    if ((rec.attempts || 0) >= DELETE_MAX_ATTEMPTS) {
      await User.findByIdAndUpdate(user._id, { $unset: { deleteAccountCode: 1 } });
      return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please request a new code.' });
    }

    const expected = Buffer.from(rec.code, 'hex');
    const given    = Buffer.from(hashDeleteCode(user._id, code), 'hex');
    const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
    if (!ok) {
      const attempts = (rec.attempts || 0) + 1;
      if (attempts >= DELETE_MAX_ATTEMPTS) {
        await User.findByIdAndUpdate(user._id, { $unset: { deleteAccountCode: 1 } });
        return res.status(429).json({ success: false, message: 'Too many incorrect attempts. Please request a new code.' });
      }
      await User.findByIdAndUpdate(user._id, { $inc: { 'deleteAccountCode.attempts': 1 } });
      return res.status(400).json({ success: false, message: `Incorrect code. ${DELETE_MAX_ATTEMPTS - attempts} attempt${DELETE_MAX_ATTEMPTS - attempts === 1 ? '' : 's'} left.` });
    }

    // Re-check right before deleting — a project may have been created since the code was sent
    const blocked = await activeProjectsBlock(user._id);
    if (blocked) return res.status(409).json(blocked);

    // Best-effort: remove the avatar from Cloudinary
    if (user.avatar?.includes('res.cloudinary.com')) {
      const m = user.avatar.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
      if (m) await cloudinary.uploader.destroy(m[1]).catch(() => {});
    }

    await user.deleteOne();
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/users/:id — admin update any user
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, phone, role, isActive, skills, availability, rate, rateType } = req.body;
    const { error, clean } = validateUserFields({ name, email, phone, role });
    if (error) return res.status(400).json({ success: false, message: error });
    const update = {};
    if (name)         update.name         = clean.name;
    if (email)        update.email        = clean.email;
    if (phone)        update.phone        = clean.phone;
    if (role)         update.role         = role;
    if (isActive !== undefined) update.isActive = isActive;
    if (skills)       update.skills       = skills;
    if (availability) update.availability = availability;
    if (rate !== undefined)     update.rate     = rate;
    if (rateType)     update.rateType     = rateType;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PUT /api/users/:id/toggle-status — admin activate/deactivate an account
// (the Users page calls this; it was missing, which is why the toggle returned 404)
router.put('/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Don't let an admin lock themselves out
    if (String(user._id) === String(req.user.id) && user.isActive) {
      return res.status(400).json({ success: false, message: "You can't deactivate your own account" });
    }

    // findByIdAndUpdate instead of save(): skips full validation / pre-save hooks
    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: !user.isActive },
      { new: true }
    ).select('-password');

    res.json({ success: true, user: updated });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/users/:id — admin permanently deletes a user
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ success: false, message: "You can't delete your own account" });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    // Refuse while the account still has a project that isn't finished
    const unfinished = await countUnfinishedProjects(target._id);
    if (unfinished > 0) {
      return res.status(409).json({ success: false, code: 'USER_HAS_ACTIVE_PROJECTS', message: unfinishedMessage(unfinished) });
    }

    await target.deleteOne();
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;