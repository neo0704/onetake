const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const ctrl    = require('../controllers/quotationController');
const { protect, authorize } = require('../middleware/auth');

// Multer — stores uploaded PDFs in uploads/quotations/
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/quotations');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const uploadPdf = multer({
  storage: pdfStorage,
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});
router.post('/', protect, authorize('admin'), ctrl.createQuotation);
router.get('/', protect, ctrl.getQuotations);
router.get('/:id', protect, ctrl.getQuotation);

router.put('/:id', protect, authorize('admin'), ctrl.updateQuotation);
router.post('/:id/send', protect, authorize('admin'), uploadPdf.single('pdf'), ctrl.sendQuotation);
router.post('/:id/approve', protect, authorize('client'), ctrl.approveQuotation);
router.post('/:id/reject', protect, authorize('client'), ctrl.rejectQuotation);

// Comments — any authenticated user (admin/staff/client); controller enforces
// that a client can only view/post on their own quotation.
router.get('/:id/comments', protect, ctrl.getComments);
router.post('/:id/comments', protect, ctrl.addComment);

module.exports = router;