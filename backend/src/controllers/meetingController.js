const Meeting = require('../models/Meeting');
const Event = require('../models/Event');
const { sendNotification } = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');

exports.createMeeting = async (req, res) => {
  try {
    const { eventId, title, scheduledAt, duration, participantIds, notes } = req.body;

    const roomId = uuidv4();
    // If using Daily.co, generate room URL here
    // const roomUrl = await createDailyRoom(roomId);
    const roomUrl = `${process.env.CLIENT_URL}/meeting/${roomId}`;

    const meeting = await Meeting.create({
      event: eventId || null,
      title,
      scheduledAt,
      duration: duration || 60,
      host: req.user.id,
      participants: participantIds || [],
      roomId,
      roomUrl,
      notes
    });

    await meeting.populate([
      { path: 'host', select: 'name email' },
      { path: 'participants', select: 'name email role' },
      { path: 'event', select: 'eventName' }
    ]);

    // Notify participants
    for (const pid of (participantIds || [])) {
      await sendNotification({
        recipient: pid,
        type: 'meeting_scheduled',
        title: 'Meeting Scheduled',
        message: `You have a meeting "${title}" scheduled for ${new Date(scheduledAt).toLocaleString()}`,
        data: { meetingId: meeting._id, roomId },
        link: `/meeting/${roomId}`
      });
    }

    res.status(201).json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMeetings = async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query.$or = [
        { host: req.user.id },
        { participants: req.user.id }
      ];
    }

    const meetings = await Meeting.find(query)
      .populate('host', 'name email avatar')
      .populate('participants', 'name email avatar role')
      .populate('event', 'eventName')
      .sort({ scheduledAt: -1 });

    res.json({ success: true, meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      $or: [{ _id: req.params.id }, { roomId: req.params.id }]
    })
      .populate('host', 'name email avatar')
      .populate('participants', 'name email avatar role')
      .populate('event', 'eventName');

    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.startMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, {
      status: 'in_progress',
      startedAt: new Date()
    }, { new: true });
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.endMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, {
      status: 'completed',
      endedAt: new Date(),
      ...(req.body.notes && { notes: req.body.notes })
    }, { new: true });
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, {
      status: 'cancelled'
    }, { new: true }).populate('participants', 'name email');

    for (const p of meeting.participants) {
      await sendNotification({
        recipient: p._id,
        type: 'general',
        title: 'Meeting Cancelled',
        message: `The meeting "${meeting.title}" has been cancelled.`,
        data: { meetingId: meeting._id }
      });
    }

    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin-only: permanently remove a meeting.
exports.deleteMeeting = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can delete meetings' });
    }

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

    await meeting.deleteOne();

    // Let participants know, but never fail the delete because a notification failed.
    // Skip meetings that were already finished/cancelled/declined/expired (nothing pending to tell them).
    if (['scheduled', 'ongoing', 'requested'].includes(meeting.status)) {
      const recipients = [...(meeting.participants || [])];
      if (meeting.requestedBy) recipients.push(meeting.requestedBy);
      const unique = [...new Set(recipients.map(String))];
      for (const pid of unique) {
        try {
          await sendNotification({
            recipient: pid,
            type: 'general',
            title: 'Meeting Removed',
            message: `The meeting "${meeting.title}" has been removed by an admin.`,
            data: { meetingId: meeting._id }
          });
        } catch (_) { /* ignore */ }
      }
    }

    res.json({ success: true, message: 'Meeting deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};