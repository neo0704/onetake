const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Event = require('../models/Event');

router.get('/:eventId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).select('preEventChecklist');
    res.json({ success: true, checklist: event?.preEventChecklist || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:eventId/item/:itemId', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    const item = event.preEventChecklist.id(req.params.itemId);
    if (item) {
      item.completed = req.body.completed;
      item.completedBy = req.user.id;
      item.completedAt = new Date();
      await event.save();
    }
    res.json({ success: true, checklist: event.preEventChecklist });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
