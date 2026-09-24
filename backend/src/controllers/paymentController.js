const Payment = require('../models/Payment');
const Event = require('../models/Event');
const Quotation = require('../models/Quotation');
const { sendNotification, notifyAdmins } = require('../services/notificationService');
const { getIO } = require('../socket');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// ── Cloudinary (permanent image storage) ───────────────────────────────────
// Uses the same CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
// env vars already configured for uploadRoute.js.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Keep the file in memory, then send it straight to Cloudinary.
// Nothing is written to the server's disk (Render wipes it on every restart).
const storage = multer.memoryStorage();
exports.upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

exports.submitPayment = async (req, res) => {
  try {
    const { eventId, quotationId, type, amount, method, referenceNumber, notes } = req.body;

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ success: false, message: 'Image storage is not configured on the server' });
    }

    let proofUrl = req.body.proofUrl;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'payments');
      proofUrl = result.secure_url;
    }

    const payment = await Payment.create({
      event: eventId,
      quotation: quotationId,
      client: req.user.id,
      type, amount: parseFloat(amount), method,
      referenceNumber, proofUrl, notes,
      status: 'pending'
    });

    await payment.populate([
      { path: 'event', select: 'eventName' },
      { path: 'client', select: 'name email' }
    ]);

    await notifyAdmins({
      type: 'payment_submitted',
      title: 'Payment Submitted',
      message: `${req.user.name} submitted a ${type} payment of ₱${parseFloat(amount).toLocaleString()} for "${payment.event.eventName}"`,
      data: { paymentId: payment._id, eventId },
      link: `/admin/payments`
    });

    res.status(201).json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    const payment = await Payment.findByIdAndUpdate(req.params.id, {
      status,
      verifiedBy: req.user.id,
      verifiedAt: new Date(),
      ...(rejectionReason && { rejectionReason })
    }, { new: true })
      .populate('event', 'eventName status')
      .populate('client', 'name email');

    if (status === 'verified') {
      const eventId = payment.event._id;
      const event = await Event.findById(eventId);

      // Downpayment verified → advance to downpayment_paid so timeline progresses
      if (payment.type === 'downpayment') {
        event.status = 'downpayment_paid';
        event.addTimelineEntry('downpayment_paid', req.user, `₱${payment.amount.toLocaleString()} downpayment verified`);
        await event.save();

        await sendNotification({
          recipient: payment.client._id,
          type: 'payment_verified',
          title: 'Downpayment Confirmed',
          message: `Your 50% downpayment for "${payment.event.eventName}" has been received. We will now assign your team.`,
          data: { paymentId: payment._id, eventId },
          link: `/client/events/${eventId}`
        });
      }
      // Balance or full payment → mark event fully paid
      else if (payment.type === 'balance' || payment.type === 'full') {
        event.status = 'completed_paid';
        event.addTimelineEntry('completed_paid', req.user, `₱${payment.amount.toLocaleString()} final payment verified`);
        await event.save();

        await sendNotification({
          recipient: payment.client._id,
          type: 'payment_verified',
          title: 'Payment Complete',
          message: `Final payment for "${payment.event.eventName}" confirmed. Project is fully closed. Thank you!`,
          data: { paymentId: payment._id, eventId },
          link: `/client/events/${eventId}`
        });

        await notifyAdmins({
          type: 'event_completed',
          title: 'Project Fully Paid',
          message: `Final payment verified for "${payment.event.eventName}". Project is now closed.`,
          data: { eventId },
          link: `/admin/events/${eventId}`
        });

        getIO().to(payment.client._id.toString()).emit('event_status_updated', { eventId, status: 'completed_paid' });
      }
      // Any other verified payment — just notify
      else {
        await sendNotification({
          recipient: payment.client._id,
          type: 'payment_verified',
          title: 'Payment Verified',
          message: `Your payment of ₱${payment.amount.toLocaleString()} for "${payment.event.eventName}" has been verified.`,
          data: { paymentId: payment._id, eventId: payment.event._id },
          link: `/client/events/${payment.event._id}`
        });
      }
    } else if (status === 'rejected') {
      await sendNotification({
        recipient: payment.client._id,
        type: 'payment_rejected',
        title: 'Payment Issue',
        message: `Your payment for "${payment.event.eventName}" needs attention. Reason: ${rejectionReason}`,
        data: { paymentId: payment._id },
        link: `/client/payments`
      });
    }

    getIO().to(payment.client._id.toString()).emit('payment_status_updated', {
      paymentId: payment._id, status
    });

    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPayments = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'client') query.client = req.user.id;
    if (req.query.eventId) query.event = req.query.eventId;

    const payments = await Payment.find(query)
      .populate('event', 'eventName eventDate')
      .populate('client', 'name email')
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('event', 'eventName eventDate location')
      .populate('client', 'name email phone')
      .populate('quotation')
      .populate('verifiedBy', 'name');
    
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPaymentSummary = async (req, res) => {
  try {
    const { eventId } = req.params;
    const quotation = await Quotation.findOne({ event: eventId, status: 'approved' });
    const payments = await Payment.find({ event: eventId, status: 'verified' });
    
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalAmount = quotation ? quotation.totalAmount : 0;
    const balance = totalAmount - totalPaid;

    res.json({ success: true, summary: { totalAmount, totalPaid, balance, payments, quotation } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};