const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/paymentQRController');
const { protect, authorize } = require('../middleware/auth');

// Clients can read active QR codes (to show during payment submission)
router.get('/', protect, ctrl.getQRCodes);

// Admin-only mutations
router.post(
  '/',
  protect,
  authorize('admin'),
  ctrl.upload.single('qrImage'),
  ctrl.upsertQRCode
);

router.delete(
  '/:method',
  protect,
  authorize('admin'),
  ctrl.deleteQRCode
);

router.patch(
  '/:method/toggle',
  protect,
  authorize('admin'),
  ctrl.toggleQRCode
);

module.exports = router;