const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const ctrl     = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');

// ── Multer for check-in proof photos ─────────────────────────────────────────
// Same approach as uploadRoute.js / paymentController.js: keep the file in
// memory, then send it straight to Cloudinary. Nothing is written to the
// server's disk (Render wipes it on every restart — which is why check-in
// photos stopped loading).
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `onetake/${folder}`, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Images only')),
});

// ── Multer for message/comment attachments (any file type, incl. admin) ──────
const messageUploadDir = path.join(__dirname, '../../uploads/messages');
if (!fs.existsSync(messageUploadDir)) fs.mkdirSync(messageUploadDir, { recursive: true });

const messageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, messageUploadDir),
  filename:    (req, file, cb) => cb(null, `msg-${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\s/g, '_')}`),
});
const messageUpload = multer({
  storage: messageStorage,
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
});
// ─────────────────────────────────────────────────────────────────────────────

// Uploads each check-in proof photo to Cloudinary (onetake/checkin) and puts
// its https URL on the file object as `cloudinaryUrl` for the controller to save.
const uploadProofToCloudinary = async (req, res, next) => {
  const files = req.files || [];
  if (files.length === 0) return next();

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ success: false, message: 'Image storage is not configured on the server' });
  }

  try {
    const results = await Promise.all(files.map(f => uploadToCloudinary(f.buffer, 'checkin')));
    results.forEach((r, i) => { files[i].cloudinaryUrl = r.secure_url; });
    next();
  } catch (err) {
    console.error('❌ Cloudinary check-in upload failed:', err.message);
    res.status(500).json({ success: false, message: 'Upload failed: ' + err.message });
  }
};

router.get('/dashboard', protect, authorize('admin'), ctrl.getDashboardStats);
router.get('/booked-dates', protect, ctrl.getBookedDates);
router.get('/booked-meeting-slots', protect, ctrl.getBookedMeetingSlots);
router.post('/', protect, ctrl.createInquiry);
router.get('/', protect, ctrl.getEvents);
router.get('/:id', protect, ctrl.getEvent);
router.put('/:id/needs-assessment', protect, authorize('admin'), ctrl.updateNeedsAssessment);
router.put('/:id/status', protect, authorize('admin'), ctrl.updateStatus);
router.put('/:id/assign', protect, authorize('admin'), ctrl.assignResources);
router.patch('/:id/messaging-settings', protect, authorize('admin'), ctrl.updateMessagingSettings);
router.post('/:id/messages', protect, messageUpload.array('attachments', 5), ctrl.sendMessage);
router.post('/:id/comments', protect, ctrl.addComment);
router.put('/:id/checklist', protect, ctrl.updateChecklist);
router.post('/:id/checkin', protect, authorize('freelancer'), upload.array('proofPhotos', 5), uploadProofToCloudinary, ctrl.checkIn);
router.post('/:id/deliverables', protect, authorize('admin'), ctrl.uploadDeliverable);
router.put('/:id/schedule-meeting', protect, authorize('admin'), ctrl.scheduleMeeting);
router.put('/:id/meeting-done', protect, authorize('admin'), ctrl.markMeetingDone);
// ── Cancellation ──────────────────────────────────────────────────────────────
router.post('/:id/request-cancellation', protect, authorize('client'), ctrl.requestCancellation);
router.put('/:id/process-cancellation', protect, authorize('admin'), ctrl.processCancellationRequest);
router.post('/:id/withdraw-cancellation', protect, authorize('client'), ctrl.withdrawCancellation);
// ── Feedback ───────────────────────────────────────────────────────────────────
router.post('/:id/feedback', protect, authorize('client'), ctrl.submitFeedback);
router.patch('/:id/feedback/feature', protect, authorize('admin'), ctrl.toggleFeedbackFeatured);

module.exports = router;