const Quotation = require('../models/Quotation');
const Event = require('../models/Event');
const { sendNotification, notifyAdmins } = require('../services/notificationService');
const { sendQuotationEmail } = require('../services/emailService');

exports.createQuotation = async (req, res) => {
  try {
    const { eventId, services, equipment, manpower, subtotal, tax, discount, totalAmount, conditions, notes, validUntil } = req.body;
    
    const event = await Event.findById(eventId).populate('client', 'name email');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const downpaymentAmount = totalAmount * 0.5;

    const quotation = await Quotation.create({
      event: eventId,
      client: event.client._id,
      createdBy: req.user.id,
      services, equipment, manpower,
      subtotal, tax, discount, totalAmount,
      paymentTerms: {
        downpaymentPercentage: 50,
        downpaymentAmount,
        balanceAmount: totalAmount - downpaymentAmount
      },
      conditions,
      notes,
      validUntil,
      status: 'draft'
    });

    res.status(201).json({ success: true, quotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const pushTimelineEntry = async (eventId, status, user, note = '') => {
  const LABELS = {
    quotation_sent: 'Quotation Sent to Client',
    confirmed:      'Quotation Approved by Client',
    downpayment_paid: '50% Downpayment Received',
  };
  try {
    const Event = require('../models/Event');
    await Event.updateOne(
      { _id: eventId, 'timeline.status': { $ne: status } },
      {
        $push: {
          timeline: {
            status,
            label:       LABELS[status] || status,
            note:        note || '',
            doneBy:      user?._id || user || null,
            doneByName:  user?.name || '',
            completedAt: new Date(),
          }
        }
      }
    );
  } catch (err) { console.log('[pushTimeline quotation]', err.message); }
};



exports.sendQuotation = async (req, res) => {
  try {
    const sendType = req.body.type || 'premade'; // 'premade' | 'pdf'

    if (sendType === 'pdf' && !req.file) {
      return res.status(400).json({ success: false, message: 'PDF file is required when send type is pdf' });
    }

    // Build update payload
    const update = {
      status:            'sent',
      quotationSendType: sendType,
      quotationPdfUrl:   sendType === 'pdf'
        ? `/uploads/quotations/${req.file.filename}`
        : '',
    };

    const quotation = await Quotation.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('event')
      .populate('client', 'name email emailNotificationsEnabled');

    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    await Event.findByIdAndUpdate(quotation.event._id, { status: 'quotation_sent' });

    await sendNotification({
      recipient: quotation.client._id,
      type: 'quotation_sent',
      title: 'Quotation Ready',
      message: `Your quotation for "${quotation.event.eventName}" has been sent. Total: ₱${quotation.totalAmount.toLocaleString()}`,
      data: { quotationId: quotation._id, eventId: quotation.event._id },
      link: `/client/quotations`
    });
    await pushTimelineEntry(quotation.event._id, 'quotation_sent', req.user, `Quotation #${quotation.quotationNumber} sent`);

    // Send email
    try {
      await sendQuotationEmail(quotation.client, quotation);
    } catch (emailErr) {
      console.log('Email error:', emailErr.message);
    }

    res.json({ success: true, quotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getQuotations = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'client') query.client = req.user.id;

    const quotations = await Quotation.find(query)
      .populate('event', 'eventName eventDate location')
      .populate('client', 'name email')
      .sort({ createdAt: -1 });

    res.json({ success: true, quotations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('event', 'eventName eventDate location attendees services')
      .populate('client', 'name email phone address')
      .populate('createdBy', 'name');

    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    res.json({ success: true, quotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(req.params.id, {
      status: 'approved',
      approvedAt: new Date()
    }, { new: true }).populate('event').populate('client', 'name email');

    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    // Update event status to quotation_sent -> confirmed happens after downpayment
    // but mark that the quote is approved so admin knows
    await Event.findByIdAndUpdate(quotation.event._id, {
      status: 'confirmed'
    });

    await pushTimelineEntry(quotation.event._id, 'confirmed', req.user, `Quotation #${quotation.quotationNumber} approved`);

    try {
      await notifyAdmins({
        type: 'quotation_approved',
        title: 'Quotation Approved',
        message: `${quotation.client.name} approved quotation ${quotation.quotationNumber} for "${quotation.event.eventName}"`,
        data: { quotationId: quotation._id },
        link: `/admin/quotations`
      });
    } catch (notifErr) {
      console.log('Notify error:', notifErr.message);
    }

    res.json({ success: true, quotation });
  } catch (err) {
    console.error('Approve quotation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(req.params.id, {
      status: 'rejected',
      notes: req.body.reason
    }, { new: true }).populate('event').populate('client', 'name email');

    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await sendNotification({
        recipient: admin._id,
        type: 'quotation_rejected',
        title: 'Quotation Rejected',
        message: `${quotation.client.name} rejected quotation ${quotation.quotationNumber}. Reason: ${req.body.reason}`,
        data: { quotationId: quotation._id },
        link: `/admin/quotations`
      });
    }

    res.json({ success: true, quotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getComments = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .select('client comments')
      .populate('comments.author', 'name');

    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    if (req.user.role === 'client') {
      const clientId = quotation.client?.toString();
      if (clientId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
    }

    res.json({ success: true, comments: quotation.comments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Comment text is required' });

    const quotation = await Quotation.findById(req.params.id).populate('client', 'name email');
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

    const clientId = quotation.client?._id?.toString();
    if (req.user.role === 'client' && clientId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    quotation.comments.push({
      author:     req.user.id,
      authorRole: req.user.role,
      text
    });
    await quotation.save();
    await quotation.populate('comments.author', 'name');

    const comment = quotation.comments[quotation.comments.length - 1];

    // Notify the other party — client comments notify admins, admin/staff comments notify the client
    try {
      if (req.user.role === 'client') {
        await notifyAdmins({
          type: 'quotation_comment',
          title: 'New Quotation Comment',
          message: `${quotation.client.name} commented on quotation ${quotation.quotationNumber}`,
          data: { quotationId: quotation._id },
          link: `/admin/quotations`
        });
      } else {
        await sendNotification({
          recipient: quotation.client._id,
          type: 'quotation_comment',
          title: 'New Comment on Your Quotation',
          message: `Our team left a comment on quotation ${quotation.quotationNumber}`,
          data: { quotationId: quotation._id },
          link: `/client/quotations`
        });
      }
    } catch (notifErr) {
      console.log('Notify error (comment):', notifErr.message);
    }

    res.status(201).json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, quotation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};