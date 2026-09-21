const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const upload  = require('../middleware/multerConfig');
const { protect, authorize } = require('../middleware/auth');

// ── POST /api/upload  ──────────────────────────────────────────────────────
// Body: multipart/form-data
//   field "images"  — 1–10 image files
//   field "folder"  — optional subfolder name (default: "general")
//
// Returns: { success: true, urls: ['/uploads/portfolio/abc.jpg', …] }
//
router.post(
  '/',
  protect,
  authorize('admin'),
  (req, res, next) => {
    // Let the route choose the subfolder via the "folder" body field
    req.uploadFolder = req.body?.folder || req.query?.folder || 'general';
    next();
  },
  upload.array('images', 10),
  (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const urls = req.files.map(file => {
      // Build a public URL — matches the static middleware in index.js
      const relative = path.relative(
        path.join(__dirname, '../uploads'),
        file.path
      ).replace(/\\/g, '/');
      return `/uploads/${relative}`;
    });

    res.json({ success: true, urls });
  }
);

// ── DELETE /api/upload  ────────────────────────────────────────────────────
// Body: { url: '/uploads/portfolio/abc.jpg' }
// Deletes the file from disk (admin only, best-effort)
//
router.delete('/', protect, authorize('admin'), (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.startsWith('/uploads/')) {
      return res.status(400).json({ success: false, message: 'Invalid URL' });
    }
    const filePath = path.join(__dirname, '..', url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;