const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');

// Define model inline to avoid any require() chain issues
const equipmentRequestSchema = new mongoose.Schema({
  event:      { type: mongoose.Schema.Types.ObjectId, ref: 'Event',    required: true },
  freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },
  equipment:  { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' },
  itemName:   { type: String, required: true },
  quantity:   { type: Number, default: 1 },
  reason:     { type: String },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  adminNote:  { type: String },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date }
}, { timestamps: true });

// Use existing model if already registered (hot reload safety)
const EquipmentRequest = mongoose.models.EquipmentRequest ||
  mongoose.model('EquipmentRequest', equipmentRequestSchema);

// ── POST / — Freelancer submits request ───────────────────────────────────
router.post('/', protect, authorize('freelancer'), async (req, res) => {
  try {
    const Event = require('../models/Event');
    const { sendNotification, notifyAdmins } = require('../services/notificationService');
    const { eventId, itemName, quantity, reason } = req.body;

    if (!itemName) return res.status(400).json({ success: false, message: 'Item name is required' });

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Block requests for completed or cancelled projects
    if (['completed_paid', 'completed_pending_balance', 'cancelled'].includes(event.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request equipment for a completed or cancelled project'
      });
    }

    const isAssigned = event.assignedFreelancers.some(
      af => af.freelancer?.toString() === req.user.id
    );
    if (!isAssigned) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this event' });
    }

    const request = await EquipmentRequest.create({
      event: eventId,
      freelancer: req.user.id,
      itemName,
      quantity: parseInt(quantity) || 1,
      reason: reason || ''
    });

    await request.populate([
      { path: 'freelancer', select: 'name email' },
      { path: 'event', select: 'eventName' }
    ]);

    try {
      await notifyAdmins({
        type: 'general',
        title: '🔧 Equipment Request',
        message: `${req.user.name} requested "${itemName}" ×${quantity || 1} for "${event.eventName}"`,
        data: { requestId: request._id, eventId },
        link: '/admin/equipment-requests'
      });
    } catch (notifErr) {
      console.log('Notify error:', notifErr.message);
    }

    res.status(201).json({ success: true, request });
  } catch (err) {
    console.error('Create equipment request error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET / — Get requests (admin = all, freelancer = own) ──────────────────
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'freelancer') query.freelancer = req.user.id;
    if (req.query.eventId) query.event = req.query.eventId;
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;

    const requests = await EquipmentRequest.find(query)
      .populate('freelancer', 'name email')
      .populate('event', 'eventName eventDate')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /:id/review — Admin approves or rejects ───────────────────────────
router.put('/:id/review', protect, authorize('admin'), async (req, res) => {
  try {
    const { sendNotification } = require('../services/notificationService');
    const { status, adminNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }

    const request = await EquipmentRequest.findByIdAndUpdate(req.params.id, {
      status,
      adminNote: adminNote || '',
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    }, { new: true })
      .populate('freelancer', 'name email')
      .populate('event', 'eventName');

    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    // NEW: On approval, assign to event
    if (status === 'approved') {
      const Event = require('../models/Event');
      const Equipment = require('../models/Equipment');
      const mongoose = require('mongoose');

      const event = await Event.findById(request.event._id);
      if (!event) {
        console.error('Event not found for equipment assignment:', request.event._id);
      } else {
        const freelancerIdx = event.assignedFreelancers.findIndex(
          af => af.freelancer.toString() === request.freelancer._id.toString()
        );
        if (freelancerIdx === -1) {
          console.error('Freelancer not assigned to event:', request.freelancer._id, event._id);
        } else {
          let equipmentId;
          if (request.equipment) {
            equipmentId = request.equipment._id;
          } else {
            // Create minimal Equipment for custom item
            const newEq = await Equipment.create({
              name: request.itemName,
              category: 'other',
              description: `Custom equipment for ${request.itemName}`,
              quantity: request.quantity,
              availableQuantity: 0,
              availability: 'in_use',
              condition: 'good'
            });
            equipmentId = newEq._id;
          }

          // Upsert to freelancer's equipment
          const eqExists = event.assignedFreelancers[freelancerIdx].equipment?.some(
            e => e.equipment.toString() === equipmentId.toString()
          );
          if (eqExists) {
            // Increase quantity
            const eqIdx = event.assignedFreelancers[freelancerIdx].equipment.findIndex(
              e => e.equipment.toString() === equipmentId.toString()
            );
            event.assignedFreelancers[freelancerIdx].equipment[eqIdx].quantity += request.quantity;
          } else {
            // Add new
            event.assignedFreelancers[freelancerIdx].equipment = event.assignedFreelancers[freelancerIdx].equipment || [];
            event.assignedFreelancers[freelancerIdx].equipment.push({
              equipment: equipmentId,
              quantity: request.quantity,
              assignedAt: new Date()
            });
          }

          // Add to project equipment
          const projEqExists = event.assignedEquipment?.some(
            e => e.equipment.toString() === equipmentId.toString()
          );
          if (!projEqExists) {
            event.assignedEquipment = event.assignedEquipment || [];
            event.assignedEquipment.push({
              equipment: equipmentId,
              quantity: request.quantity,
              assignedAt: new Date()
            });
          }

          event.markModified('assignedFreelancers');
          event.markModified('assignedEquipment');
          await event.save();
        }
      }
    }

    try {
          await sendNotification({
        recipient: request.freelancer._id,
        type: status === 'approved' ? 'equipment_approved' : 'general',
        title: status === 'approved' ? '✅ Equipment Request Approved' : '❌ Equipment Request Rejected',
        message: status === 'approved'
          ? `Your request for "${request.itemName}" ×${request.quantity} has been approved and assigned to your project profile!${adminNote ? ` Note: ${adminNote}` : ''}`
          : `Your request for "${request.itemName}" was not approved.${adminNote ? ` Reason: ${adminNote}` : ''}`,
        data: { 
          requestId: request._id, 
          eventId: request.event._id,
          ...(status === 'approved' && { equipmentName: request.itemName })
        },
        link: `/freelancer/events/${request.event._id}`
      });
    } catch (notifErr) {
      console.log('Notify error:', notifErr.message);
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /:id — Freelancer cancels pending request ─────────────────────
router.delete('/:id', protect, authorize('freelancer'), async (req, res) => {
  try {
    const request = await EquipmentRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Not found' });
    if (request.freelancer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Can only cancel pending requests' });
    }
    await request.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
