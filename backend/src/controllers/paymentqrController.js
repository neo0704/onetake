const PaymentQR  = require('../models/Paymentqr');
const cloudinary = require('cloudinary').v2;
const multer      = require('multer');

// ── Cloudinary (same config as uploadRoute.js) ──────────────────────────────
// Set these 3 variables on Render → Environment (and in your local .env):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Keep the file in memory, then send it straight to Cloudinary.
// Nothing is written to the server's disk (Render wipes it on every restart).
exports.upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

const uploadToCloudinary = (buffer, method) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'onetake/qrcodes', public_id: `qr_${method}_${Date.now()}`, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

// Pull the Cloudinary public_id back out of a stored secure_url so we can
// delete it later. Only handles Cloudinary URLs — old local '/uploads/...'
// paths (from before this migration) are skipped, not deleted, since
// they no longer exist on disk anyway after a Render restart.
const publicIdFromUrl = (url) => {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-z0-9]+$/i);
  return m ? m[1] : null;
};

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

    if (req.file && (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)) {
      return res.status(500).json({ success: false, message: 'Image storage is not configured on the server' });
    }

    // Build update payload
    const update = {
      label,
      accountName,
      accountNumber,
      instructions,
      updatedBy: req.user.id,
      ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true })
    };

    // If a new image was uploaded, send it to Cloudinary and delete the old one there
    if (req.file) {
      const existing = await PaymentQR.findOne({ method });
      const oldPublicId = publicIdFromUrl(existing?.qrImageUrl);

      const result = await uploadToCloudinary(req.file.buffer, method);
      update.qrImageUrl = result.secure_url;

      if (oldPublicId) {
        try { await cloudinary.uploader.destroy(oldPublicId); }
        catch (e) { console.warn('Cloudinary cleanup failed (non-fatal):', e.message); }
      }
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

    const publicId = publicIdFromUrl(qr.qrImageUrl);
    if (publicId) {
      try { await cloudinary.uploader.destroy(publicId); }
      catch (e) { console.warn('Cloudinary cleanup failed (non-fatal):', e.message); }
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