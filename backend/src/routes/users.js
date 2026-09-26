const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const cloudinary = require('cloudinary').v2;
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

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

// GET /api/users — admin gets all, filtered by role
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const query = {};
    if (req.query.role) query.role = req.query.role;
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
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
    const update = {};
    if (name)         update.name         = name;
    if (email)        update.email        = email;
    if (phone)        update.phone        = phone;
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

// DELETE /api/users/:id
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;