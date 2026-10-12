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

// Reference number format rules per payment method — mirrors the validation
// already enforced client-side in Payments.jsx, so the API rejects the same
// malformed input even if someone bypasses the UI and hits this endpoint directly.
const REF_RULES = {
  gcash:         { pattern: /^\d{10,15}$/,             message: 'GCash reference number should be 10–15 digits, numbers only.' },
  maya:          { pattern: /^\d{10,15}$/,             message: 'Maya reference number should be 10–15 digits, numbers only.' },
  bank_transfer: { pattern: /^[A-Za-z0-9-]{6,30}$/,    message: 'Bank reference number should be 6–30 letters/numbers (dashes allowed).' },
};

exports.submitPayment = async (req, res) => {
  try {
    const { eventId, quotationId, type, amount, method, referenceNumber, notes } = req.body;

    // Reference number format (skip for cash, which has no rule / no reference).
    const rule = REF_RULES[method];
    if (rule && !rule.pattern.test(String(referenceNumber || '').trim())) {
      return res.status(400).json({ success: false, message: rule.message });
    }

    // Proof of payment is required for every method except cash.
    if (method !== 'cash' && !req.file && !req.body.proofUrl) {
      return res.status(400).json({ success: false, message: 'Proof of payment (screenshot or receipt) is required.' });
    }

    // Block a second submission while an earlier one for this event is still pending review.
    const existingPending = await Payment.findOne({ event: eventId, client: req.user.id, status: 'pending' });
    if (existingPending) {
      return res.status(409).json({ success: false, message: 'You already have a payment awaiting review for this project.' });
    }

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

// ── Cash arrangement ─────────────────────────────────────────────────────────
// Cash skips payment tracking entirely: no Payment record, no amount, no proof.
// Client requests → admin confirms → the 50% / payment-milestone checks are
// bypassed for that event (see eventController.updateStatus / assignResources).
const CASH_REQUESTABLE_STATUSES = ['quotation_sent', 'confirmed', 'downpayment_paid', 'assigned'];

exports.requestCash = async (req, res) => {
  try {
    const { eventId } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.client.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (!CASH_REQUESTABLE_STATUSES.includes(event.status)) {
      return res.status(400).json({ success: false, message: 'A cash arrangement can only be requested before the event starts.' });
    }
    if (event.cashArrangement?.confirmed) {
      return res.status(409).json({ success: false, message: 'The cash arrangement for this project is already confirmed.' });
    }
    if (event.cashArrangement?.requested) {
      return res.status(409).json({ success: false, message: 'You already requested a cash arrangement for this project.' });
    }

    const approved = await Quotation.findOne({ event: eventId, status: 'approved' });
    if (!approved) {
      return res.status(400).json({ success: false, message: 'Please approve the quotation before choosing a payment method.' });
    }

    const hasPayments = await Payment.exists({ event: eventId, status: { $in: ['pending', 'verified'] } });
    if (hasPayments) {
      return res.status(400).json({ success: false, message: 'This project already has a payment on record, so cash cannot be used.' });
    }

    event.cashArrangement = { requested: true, requestedAt: new Date(), confirmed: false };
    await event.save();

    await notifyAdmins({
      type: 'payment_submitted',
      title: 'Cash Payment Requested',
      message: `${req.user.name} chose to pay in cash for "${event.eventName}". Please confirm the arrangement.`,
      data: { eventId },
      link: `/admin/events/${eventId}`,
    });

    res.json({ success: true, cashArrangement: event.cashArrangement });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.confirmCash = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).populate('client', 'name email');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (!event.cashArrangement?.requested) {
      return res.status(400).json({ success: false, message: 'The client has not requested a cash arrangement.' });
    }
    if (event.cashArrangement.confirmed) {
      return res.status(400).json({ success: false, message: 'Already confirmed.' });
    }

    event.cashArrangement.confirmed   = true;
    event.cashArrangement.confirmedBy = req.user.id;
    event.cashArrangement.confirmedAt = new Date();

    // Move the project forward only if it hasn't reached the downpayment stage yet
    if (['quotation_sent', 'confirmed'].includes(event.status)) {
      event.status = 'downpayment_paid';
    }
    if (!event.timeline.some(t => t.status === 'downpayment_paid')) {
      event.timeline.push({
        status:      'downpayment_paid',
        label:       'Cash Arrangement Confirmed',
        note:        'Paid in cash — payment tracking skipped',
        doneBy:      req.user.id,
        doneByName:  req.user.name,
        completedAt: new Date(),
      });
    }
    await event.save();

    try {
      await sendNotification({
        recipient: event.client._id,
        type: 'payment_verified',
        title: 'Cash Arrangement Confirmed',
        message: `Your cash payment arrangement for "${event.eventName}" is confirmed. We will now assign your team.`,
        data: { eventId: event._id },
        link: `/client/events/${event._id}`,
      });
    } catch (e) { console.log('Notify err:', e.message); }

    try {
      getIO().to(event.client._id.toString()).emit('event_status_updated', { eventId: event._id, status: event.status });
    } catch {}

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.declineCash = async (req, res) => {
  try {
    const { reason } = req.body;
    const event = await Event.findById(req.params.eventId).populate('client', 'name email');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (!event.cashArrangement?.requested || event.cashArrangement.confirmed) {
      return res.status(400).json({ success: false, message: 'There is no pending cash request to decline.' });
    }

    event.cashArrangement = { requested: false, confirmed: false };
    await event.save();

    try {
      await sendNotification({
        recipient: event.client._id,
        type: 'payment_rejected',
        title: 'Cash Request Declined',
        message: `Your cash request for "${event.eventName}" was not accepted.${reason ? ` Reason: ${reason}` : ''} Please choose another payment method.`,
        data: { eventId: event._id },
        link: `/client/payments`,
      });
    } catch (e) { console.log('Notify err:', e.message); }

    res.json({ success: true });
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

    const ev = await Event.findById(eventId).select('cashArrangement').lean();
    const cash = {
      requested: !!ev?.cashArrangement?.requested,
      confirmed: !!ev?.cashArrangement?.confirmed,
    };

    res.json({ success: true, summary: { totalAmount, totalPaid, balance, payments, quotation, cash } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};