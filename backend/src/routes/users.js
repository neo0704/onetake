const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const cloudinary = require('cloudinary').v2;
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { countUnfinishedProjects, unfinishedMessage } = require('../utils/userRecords');

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