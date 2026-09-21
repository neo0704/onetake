const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Event = require('../models/Event');
const { protect, authorize } = require('../middleware/auth');
const { sendNotification } = require('../services/notificationService');
const { expireStaleMeetings } = require('../utils/expireMeetings');

// Shared validation: a meeting can't be scheduled in the past, and if it's
// linked to an event, it can't be scheduled after that event's date.
function validateMeetingDate(dateValue, event) {
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return 'Invalid date';
  if (date.getTime() < Date.now()) return 'Meeting time cannot be in the past';
  if (event?.eventDate && date.getTime() > new Date(event.eventDate).getTime()) {
    return 'Meeting time cannot be after the linked event\'s date';
  }
  return null;
}

// ── GET /api/meetings ─────────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    // Lock any meetings whose window has passed before returning the list,
    // so what the client renders is never stale.
    await expireStaleMeetings();

    let query = {};

    if (req.user.role === 'client') {
      // Only show meetings the client actually requested or was added to as
      // a participant — being tied to one of their events isn't enough.
      // Previously any meeting linked to their event showed up here even if
      // the client was never invited (e.g. a freelancer's private request).
      query.$or = [
        { participants: req.user.id },
        { requestedBy: req.user.id }
      ];
    } else if (req.user.role === 'freelancer') {
      // Only show meetings where the freelancer is explicitly added as a participant
      query.participants = req.user.id;
    } else if (req.query.eventId) {
      query.event = req.query.eventId;
    }

    const meetings = await Meeting.find(query)
      .populate('event', 'eventName eventDate location client')
      .populate('scheduledBy', 'name email role')
      .populate('requestedBy', 'name email role')
      .populate('participants', 'name email role avatar')
      .sort({ scheduledAt: 1 });

    res.json({ success: true, meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/meetings/:id ─────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('event', 'eventName eventDate location client assignedFreelancers')
      .populate('scheduledBy', 'name email role')
      .populate('participants', 'name email role avatar');

    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

    if (req.user.role === 'client') {
      const isParticipant = (meeting.participants || []).some(
        p => (p._id || p).toString() === req.user.id
      );
      const isRequester = meeting.requestedBy?.toString() === req.user.id;
      if (!isParticipant && !isRequester) return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user.role === 'freelancer') {
      const isAssigned = (meeting.participants || []).some(
        p => (p._id || p).toString() === req.user.id
      );
      if (!isAssigned) return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/meetings/room/:roomId/access ─────────────────────────────────────
// Authoritative check the video page calls before letting anyone into a call.
// Hiding the Join button in the UI is cosmetic — anyone can paste a room URL
// directly — so joinability and membership are decided here, server-side.
router.get('/room/:roomId/access', protect, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ roomId: req.params.roomId })
      .populate('event', 'client');

    if (!meeting) {
      return res.status(404).json({ success: false, code: 'not_found', message: 'Meeting not found' });
    }

    // Lazily lock this one if its window has passed
    if (meeting.shouldExpire()) {
      meeting.status = 'expired';
      await meeting.save();
    }

    // Membership check (admins can always join)
    if (req.user.role !== 'admin') {
      const isParticipant = (meeting.participants || []).some(
        p => (p._id || p).toString() === req.user.id
      );
      const clientId = meeting.event?.client?._id?.toString() || meeting.event?.client?.toString();
      const isClientOwner = req.user.role === 'client' && clientId === req.user.id;

      if (!isParticipant && !isClientOwner) {
        return res.status(403).json({ success: false, code: 'unauthorized', message: 'You are not a participant in this meeting' });
      }
    }

    if (!meeting.isJoinable()) {
      const reason = {
        expired:   'This meeting has ended and can no longer be joined.',
        requested: 'This meeting has not been confirmed yet.',
        cancelled: 'This meeting was cancelled.',
        declined:  'This meeting request was declined.',
        done:      'This meeting has already finished.',
      }[meeting.status] || 'This meeting is not available to join.';

      return res.status(403).json({ success: false, code: 'not_joinable', status: meeting.status, message: reason });
    }

    res.json({
      success: true,
      meeting: {
        _id: meeting._id,
        title: meeting.title,
        status: meeting.status,
        scheduledAt: meeting.scheduledAt,
        duration: meeting.duration,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/meetings/request ────────────────────────────────────────────────
// Client-initiated meeting request. Creates a meeting with status 'requested'
// that admins can review, adjust, and confirm (or decline) from the admin panel.
router.post('/request', protect, authorize('client', 'freelancer'), async (req, res) => {
  try {
    const { eventId, title, preferredAt, duration = 30, notes = '' } = req.body;

    if (!title)       return res.status(400).json({ success: false, message: 'title is required' });
    if (!preferredAt) return res.status(400).json({ success: false, message: 'preferredAt is required' });

    // If an event was specified, make sure this user actually has a stake in it
    let event = null;
    if (eventId) {
      const eventQuery = req.user.role === 'freelancer'
        ? { _id: eventId, 'assignedFreelancers.freelancer': req.user.id }
        : { _id: eventId, client: req.user.id };
      event = await Event.findOne(eventQuery);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const dateError = validateMeetingDate(preferredAt, event);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    // Give every meeting a genuinely unique roomId from creation, even before
    // it's approved. This isn't a joinable room yet (status is 'requested'),
    // but it guarantees the unique index never sees two documents sharing a
    // value, regardless of how the index's sparse behavior is configured.
    const placeholderRoomId = `pending_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

    const meeting = await Meeting.create({
      event:       eventId || null,
      title,
      scheduledAt: new Date(preferredAt),
      duration,
      notes,
      requestedBy: req.user._id,
      participants: [req.user._id],
      status:      'requested',
      roomId:      placeholderRoomId,
    });

    await meeting.populate([
      { path: 'event',       select: 'eventName eventDate' },
      { path: 'requestedBy', select: 'name email' },
    ]);

    // Notify admins that a new request came in
    try {
      const User = require('../models/User');
      const admins = await User.find({ role: 'admin' }).select('_id');
      for (const admin of admins) {
        await sendNotification({
          recipient: admin._id,
          type: 'meeting_requested',
          title: 'New Meeting Request',
          message: `${req.user.name} requested a meeting: "${title}".`,
          data: { meetingId: meeting._id },
          link: `/admin/meetings`,
        });
      }
    } catch (e) { console.log('Notify error:', e.message); }

    res.status(201).json({ success: true, message: 'Meeting request sent', meeting });
  } catch (err) {
    console.error('❌ POST /meetings/request Error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Failed to send request' });
  }
});

// ── POST /api/meetings ────────────────────────────────────────────────────────
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { eventId, title, scheduledAt, duration = 60, notes = '', participantIds = [], isPrivate = false } = req.body;

    if (!scheduledAt) return res.status(400).json({ success: false, message: 'scheduledAt is required' });
    if (!title)       return res.status(400).json({ success: false, message: 'title is required' });

    const roomId = `meet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    // Build participants — the admin's checkbox selection (participantIds)
    // is the actual, complete list. It used to be layered on top of an
    // auto-added event client + assigned freelancers, which meant
    // unchecking someone in the UI didn't actually remove them; still
    // need the event for date validation, just not for participants.
    const participantSet = new Set([req.user._id.toString()]);

    let event = null;
    if (eventId) {
      event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const dateError = validateMeetingDate(scheduledAt, event);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    participantIds.forEach(id => participantSet.add(id.toString()));

    const meeting = await Meeting.create({
      event:       eventId || null,
      title,
      scheduledAt: new Date(scheduledAt),
      duration,
      notes,
      scheduledBy: req.user._id,
      participants: Array.from(participantSet),
      status:      'scheduled',
      roomId,
      isPrivate,
    });

    await meeting.populate([
      { path: 'event',        select: 'eventName eventDate' },
      { path: 'scheduledBy',  select: 'name email' },
      { path: 'participants', select: 'name email role' },
    ]);

    // Notify participants (except the admin who created it)
    const others = Array.from(participantSet).filter(id => id !== req.user._id.toString());
    for (const pid of others) {
      try {
        await sendNotification({
          recipient: pid,
          type: 'meeting_scheduled',
          title: 'Meeting Scheduled',
          message: `You have a meeting "${title}" scheduled for ${new Date(scheduledAt).toLocaleString('en-PH')}.`,
          data: { meetingId: meeting._id, roomId },
          link: `/meeting/${roomId}`,
        });
      } catch (e) { console.log('Notify error:', e.message); }
    }

    res.status(201).json({ success: true, message: 'Meeting created successfully', meeting });
  } catch (err) {
    console.error('❌ POST /meetings Error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Failed to create meeting' });
  }
});

// ── PATCH /api/meetings/:id/approve ───────────────────────────────────────────
// Admin confirms a client's requested meeting, filling in/overriding details
// and choosing final participants, which turns it into a real scheduled meeting.
router.patch('/:id/approve', protect, authorize('admin'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (meeting.status !== 'requested') {
      return res.status(400).json({ success: false, message: 'This meeting is not a pending request' });
    }

    const { eventId, title, scheduledAt, duration, notes = '', participantIds = [], isPrivate = false } = req.body;

    const roomId = `meet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const targetEventId = eventId !== undefined ? (eventId || null) : meeting.event;

    // participantIds (from the admin's checkboxes) is now the sole source
    // of truth. The requester and the event's client/freelancers used to
    // be force-added here regardless of what the admin selected — the
    // frontend already pre-checks the requester as a sensible default, so
    // this no longer needs a backend-side override of admin's own choices.
    const participantSet = new Set();

    let event = null;
    if (targetEventId) {
      event = await Event.findById(targetEventId);
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    }

    const finalScheduledAt = scheduledAt || meeting.scheduledAt;
    const dateError = validateMeetingDate(finalScheduledAt, event);
    if (dateError) return res.status(400).json({ success: false, message: dateError });

    participantIds.forEach(id => participantSet.add(id.toString()));

    meeting.event       = targetEventId;
    meeting.title        = title || meeting.title;
    meeting.scheduledAt  = scheduledAt ? new Date(scheduledAt) : meeting.scheduledAt;
    meeting.duration     = duration || meeting.duration;
    meeting.notes        = notes;
    meeting.participants = Array.from(participantSet);
    meeting.status       = 'scheduled';
    meeting.roomId       = roomId;
    meeting.isPrivate    = isPrivate;
    meeting.scheduledBy  = req.user._id;

    await meeting.save();
    await meeting.populate([
      { path: 'event',        select: 'eventName eventDate' },
      { path: 'scheduledBy',  select: 'name email' },
      { path: 'participants', select: 'name email role' },
    ]);

    const others = Array.from(participantSet).filter(id => id !== req.user._id.toString());
    for (const pid of others) {
      try {
        await sendNotification({
          recipient: pid,
          type: 'meeting_scheduled',
          title: 'Meeting Confirmed',
          message: `Your meeting "${meeting.title}" is confirmed for ${meeting.scheduledAt.toLocaleString('en-PH')}.`,
          data: { meetingId: meeting._id, roomId },
          link: `/meeting/${roomId}`,
        });
      } catch (e) { console.log('Notify error:', e.message); }
    }

    res.json({ success: true, message: 'Meeting confirmed', meeting });
  } catch (err) {
    console.error('❌ PATCH /meetings/:id/approve Error:', err.message);
    res.status(500).json({ success: false, message: err.message || 'Failed to confirm meeting' });
  }
});

// ── PATCH /api/meetings/:id/decline ───────────────────────────────────────────
router.patch('/:id/decline', protect, authorize('admin'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    if (meeting.status !== 'requested') {
      return res.status(400).json({ success: false, message: 'This meeting is not a pending request' });
    }

    const reason = (req.body.reason || '').trim();

    meeting.status = 'declined';
    if (reason) meeting.declineReason = reason;
    await meeting.save();

    if (meeting.requestedBy) {
      try {
        await sendNotification({
          recipient: meeting.requestedBy,
          type: 'meeting_declined',
          title: 'Meeting Request Declined',
          message: reason
            ? `Your meeting request "${meeting.title}" was declined: ${reason}`
            : `Your meeting request "${meeting.title}" was declined.`,
          data: { meetingId: meeting._id },
        });
      } catch (e) { console.log('Notify error:', e.message); }
    }

    res.json({ success: true, message: 'Meeting request declined', meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/meetings/:id/toggle-lock ───────────────────────────────────────
// Admin override for the automatic expiry lock. On an expired meeting, this
// re-enables it (and marks it exempt from the sweep so it doesn't just get
// re-locked on the next pass). On an already-reactivated meeting, this
// disables it again, handing control back to the automatic sweep.
router.patch('/:id/toggle-lock', protect, authorize('admin'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

    if (meeting.status === 'expired') {
      meeting.status = 'scheduled';
      meeting.manuallyReactivated = true;
    } else if (meeting.manuallyReactivated) {
      meeting.status = 'expired';
      meeting.manuallyReactivated = false;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Only an expired (or manually reactivated) meeting can be toggled.',
      });
    }

    await meeting.save();
    await meeting.populate([
      { path: 'event', select: 'eventName eventDate' },
      { path: 'scheduledBy', select: 'name email' },
      { path: 'participants', select: 'name email role' },
    ]);

    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/meetings/:id ──────────────────────────────────────────────────
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;