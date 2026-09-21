const PaymentQR = require('../models/PaymentQR');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ── Multer setup ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/qrcodes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const method = req.body.method || 'unknown';
    cb(null, `qr_${method}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
exports.upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// ── GET /payment-qr  (public-ish — clients need this) ───────────────────────
exports.getQRCodes = async (req, res) => {
  try {
    const filter = {};
    // Clients only see active ones; admins see all
    if (req.user.role === 'client') filter.isActive = true;
    if (req.query.method) filter.method = req.query.method;

    const qrs = await PaymentQR.find(filter)
      .populate('updatedBy', 'name')
      .sort({ method: 1 });

    res.json({ success: true, qrs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /payment-qr  (admin — create or update a method's QR) ───────────────
exports.upsertQRCode = async (req, res) => {
  try {
    const { method, label, accountName, accountNumber, instructions, isActive } = req.body;

    // Build update payload
    const update = {
      label,
      accountName,
      accountNumber,
      instructions,
      updatedBy: req.user.id,
      ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true })
    };

    // If a new image was uploaded, set it and delete the old one
    if (req.file) {
      const existing = await PaymentQR.findOne({ method });
      if (existing?.qrImageUrl) {
        const oldPath = path.join(__dirname, '../../', existing.qrImageUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      update.qrImageUrl = `/uploads/qrcodes/${req.file.filename}`;
    }

    const qr = await PaymentQR.findOneAndUpdate(
      { method },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).populate('updatedBy', 'name');

    res.json({ success: true, qr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /payment-qr/:method  (admin — removes QR image & config) ──────────
exports.deleteQRCode = async (req, res) => {
  try {
    const qr = await PaymentQR.findOne({ method: req.params.method });
    if (!qr) return res.status(404).json({ success: false, message: 'QR config not found' });

    if (qr.qrImageUrl) {
      const imgPath = path.join(__dirname, '../../', qr.qrImageUrl);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await qr.deleteOne();
    res.json({ success: true, message: 'QR config removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /payment-qr/:method/toggle  (admin — flip isActive) ────────────────
exports.toggleQRCode = async (req, res) => {
  try {
    const qr = await PaymentQR.findOne({ method: req.params.method });
    if (!qr) return res.status(404).json({ success: false, message: 'QR config not found' });

    qr.isActive = !qr.isActive;
    qr.updatedBy = req.user.id;
    await qr.save();

    res.json({ success: true, qr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};