const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const ctrl     = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/auth');

// ── Multer for check-in proof photos ─────────────────────────────────────────
const uploadDir = path.join(__dirname, '../../uploads/checkin');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `checkin-${Date.now()}-${file.originalname.replace(/\s/g, '_')}`),
});
const upload = multer({
  storage,
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

router.get('/dashboard', protect, authorize('admin'), ctrl.getDashboardStats);
router.get('/booked-dates', protect, ctrl.getBookedDates);
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
router.post('/:id/checkin', protect, authorize('freelancer'), upload.array('proofPhotos', 5), ctrl.checkIn);
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