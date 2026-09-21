const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');

const Payroll = require('../models/Payroll');

// ── Admin: Create payroll entry ────────────────────────────────────────────
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      freelancerId, eventId, role, periodFrom, periodTo,
      daysWorked, ratePerDay, deductions, bonuses,
      paymentMethod, notes
    } = req.body;

    const payroll = new Payroll({
      freelancer:    freelancerId,
      event:         eventId || null,
      createdBy:     req.user.id,
      role,
      period: { from: periodFrom, to: periodTo },
      daysWorked:    parseFloat(daysWorked) || 1,
      ratePerDay:    parseFloat(ratePerDay) || 0,
      deductions:    deductions || [],
      bonuses:       bonuses    || [],
      paymentMethod: paymentMethod || 'gcash',
      notes
    });

    await payroll.save();
    await payroll.populate([
      { path: 'freelancer', select: 'name email skills' },
      { path: 'event',      select: 'eventName eventDate' },
    ]);

    // Notify freelancer that a payroll entry was created for them
    try {
      const { sendNotification } = require('../services/notificationService');
      const { getIO } = require('../socket');

      await sendNotification({
        recipient: freelancerId,
        type:      'general',
        title:     '📋 New Payroll Entry',
        message:   `A payroll entry of ${payroll.netPay ? '₱' + payroll.netPay.toLocaleString() : 'TBD'} has been created for you${payroll.event ? ` for "${payroll.event.eventName}"` : ''} covering ${new Date(periodFrom).toLocaleDateString()} – ${new Date(periodTo).toLocaleDateString()}.`,
        data:      { payrollId: payroll._id },
        link:      '/freelancer/payroll'
      });

      // Real-time socket push
      try {
        getIO().to(freelancerId.toString()).emit('payroll_created', {
          payrollId:     payroll._id,
          payrollNumber: payroll.payrollNumber,
          netPay:        payroll.netPay,
          status:        payroll.status
        });
      } catch {}
    } catch (notifErr) {
      console.log('Payroll create notify error:', notifErr.message);
    }

    res.status(201).json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Get payrolls ────────────────────────────────────────────────────────────
// Admin: all   |   Freelancer: own only
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'freelancer') query.freelancer = req.user.id;
    if (req.query.freelancerId) query.freelancer = req.query.freelancerId;
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    if (req.query.eventId) query.event = req.query.eventId;

    const payrolls = await Payroll.find(query)
      .populate('freelancer', 'name email skills avatar')
      .populate('event',      'eventName eventDate location')
      .populate('createdBy',  'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, payrolls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Get single payroll ──────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('freelancer', 'name email skills phone')
      .populate('event',      'eventName eventDate location')
      .populate('createdBy',  'name');

    if (!payroll) return res.status(404).json({ success: false, message: 'Not found' });

    // Freelancer can only see own
    if (req.user.role === 'freelancer' && payroll.freelancer._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin: Update payroll ───────────────────────────────────────────────────
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const {
      role, periodFrom, periodTo, daysWorked, ratePerDay,
      deductions, bonuses, paymentMethod, notes, status
    } = req.body;

    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ success: false, message: 'Not found' });

    const previousStatus = payroll.status;

    if (role)          payroll.role          = role;
    if (periodFrom)    payroll.period.from   = periodFrom;
    if (periodTo)      payroll.period.to     = periodTo;
    if (daysWorked)    payroll.daysWorked    = parseFloat(daysWorked);
    if (ratePerDay)    payroll.ratePerDay    = parseFloat(ratePerDay);
    if (deductions)    payroll.deductions    = deductions;
    if (bonuses)       payroll.bonuses       = bonuses;
    if (paymentMethod) payroll.paymentMethod = paymentMethod;
    if (notes)         payroll.notes         = notes;
    if (status)        payroll.status        = status;

    await payroll.save();
    await payroll.populate([
      { path: 'freelancer', select: 'name email skills' },
      { path: 'event',      select: 'eventName eventDate' },
    ]);

    // Notify freelancer when payroll is released (draft → pending)
    if (status === 'pending' && previousStatus !== 'pending') {
      try {
        const { sendNotification } = require('../services/notificationService');
        const { getIO } = require('../socket');

        await sendNotification({
          recipient: payroll.freelancer._id,
          type:      'general',
          title:     '⏳ Payroll Ready for Release',
          message:   `Your payroll ${payroll.payrollNumber} of ₱${payroll.netPay?.toLocaleString()} is ready and will be released soon via ${payroll.paymentMethod?.replace('_', ' ')}.`,
          data:      { payrollId: payroll._id },
          link:      '/freelancer/payroll'
        });

        try {
          getIO().to(payroll.freelancer._id.toString()).emit('payroll_updated', {
            payrollId: payroll._id,
            status:    'pending',
            netPay:    payroll.netPay
          });
        } catch {}
      } catch (notifErr) {
        console.log('Payroll release notify error:', notifErr.message);
      }
    }

    res.json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin: Mark as paid ─────────────────────────────────────────────────────
router.put('/:id/pay', protect, authorize('admin'), async (req, res) => {
  try {
    const { referenceNumber, paymentMethod } = req.body;
    const payroll = await Payroll.findByIdAndUpdate(req.params.id, {
      status: 'paid',
      paidAt: new Date(),
      referenceNumber: referenceNumber || '',
      ...(paymentMethod && { paymentMethod })
    }, { new: true })
      .populate('freelancer', 'name email')
      .populate('event', 'eventName');

    if (!payroll) return res.status(404).json({ success: false, message: 'Not found' });

    // Notify freelancer
    try {
      const { sendNotification } = require('../services/notificationService');
      await sendNotification({
        recipient: payroll.freelancer._id,
        type: 'general',
        title: '💰 Payroll Released',
        message: `Your payroll ${payroll.payrollNumber} of ₱${payroll.netPay?.toLocaleString()} has been released!`,
        data: { payrollId: payroll._id },
        link: '/freelancer/payroll'
      });
    } catch (e) { console.log('Notify error:', e.message); }

    res.json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin: Delete draft payroll ─────────────────────────────────────────────
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return res.status(404).json({ success: false, message: 'Not found' });
    if (payroll.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Cannot delete a paid payroll' });
    }
    await payroll.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.get('/stats/summary', protect, authorize('admin'), async (req, res) => {
  try {
    const all    = await Payroll.find();
    const paid   = all.filter(p => p.status === 'paid');
    const pending = all.filter(p => p.status === 'pending');
    const draft  = all.filter(p => p.status === 'draft');

    const totalReleased = paid.reduce((s, p) => s + (p.netPay || 0), 0);
    const totalPending  = pending.reduce((s, p) => s + (p.netPay || 0), 0);

    res.json({
      success: true,
      stats: {
        totalPayrolls: all.length,
        paid: paid.length,
        pending: pending.length,
        draft: draft.length,
        totalReleased,
        totalPending
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
