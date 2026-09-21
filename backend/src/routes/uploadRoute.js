const express    = require('express');
const router     = express.Router();
const path       = require('path');
const fs         = require('fs');
const multer     = require('multer');
const cloudinary = require('cloudinary').v2;
const { protect, authorize } = require('../middleware/auth');

// ── Cloudinary (permanent image storage) ───────────────────────────────────
// Set these 3 variables on Render → Environment (and in your local .env):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Keep the file in memory, then send it straight to Cloudinary.
// Nothing is written to the server's disk (Render wipes it on every restart).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },   // 10 MB each, max 10 files
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `onetake/${folder}`, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

// ── POST /api/upload  ──────────────────────────────────────────────────────
// Body: multipart/form-data
//   field "images"  — 1–10 image files
//   field "folder"  — optional subfolder name (default: "general")
//
// Returns: { success: true, urls: ['https://res.cloudinary.com/…/abc.jpg', …] }
//
router.post(
  '/',
  protect,
  authorize('admin'),
  upload.array('images', 10),
  async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: 'Image storage is not configured on the server' });
    }

    try {
      // Only letters, numbers, dash and underscore in the folder name
      const raw    = req.body?.folder || req.query?.folder || 'general';
      const folder = String(raw).replace(/[^a-zA-Z0-9_-]/g, '') || 'general';

      const results = await Promise.all(req.files.map(f => uploadToCloudinary(f.buffer, folder)));
      res.json({ success: true, urls: results.map(r => r.secure_url) });
    } catch (err) {
      console.error('❌ Cloudinary upload failed:', err.message);
      res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
    }
  }
);

// ── DELETE /api/upload  ────────────────────────────────────────────────────
// Body: { url: 'https://res.cloudinary.com/…/abc.jpg' }  (or an old '/uploads/…' path)
// Admin only, best-effort
//
router.delete('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ success: false, message: 'Invalid URL' });
    }

    // New images: stored on Cloudinary
    if (url.includes('res.cloudinary.com')) {
      const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
      if (!m) return res.status(400).json({ success: false, message: 'Invalid URL' });
      await cloudinary.uploader.destroy(m[1]);
      return res.json({ success: true });
    }

    // Old images: saved on the server's disk
    if (url.startsWith('/uploads/')) {
      const root     = path.join(__dirname, '..', 'uploads');
      const filePath = path.join(__dirname, '..', url);
      if (!filePath.startsWith(root)) {
        return res.status(400).json({ success: false, message: 'Invalid URL' });
      }
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.json({ success: true });
    }

    res.status(400).json({ success: false, message: 'Invalid URL' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;