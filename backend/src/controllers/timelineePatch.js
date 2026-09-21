/**
 * ADD THIS to your eventController.js — replace your existing updateStatus function.
 *
 * Every time the status changes it records WHO did it and WHEN in event.timeline.
 * This powers the project timeline view.
 */

exports.updateStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const event = await Event.findById(req.params.id).populate('client', 'name email');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const prevStatus = event.status;
    event.status     = status;

    // Record the step in the timeline with timestamp + who did it
    event.addTimelineEntry(status, req.user, note || '');
    await event.save();

    // Notifications (keep your existing notification logic here)
    const notifyMessages = {
      inquiry_accepted:          { title: 'Inquiry Accepted',          message: `Your inquiry for "${event.eventName}" has been accepted. Our team will schedule a needs assessment meeting.` },
      meeting_scheduled:         { title: 'Meeting Scheduled',         message: `Your needs assessment meeting for "${event.eventName}" has been scheduled.` },
      quotation_sent:            { title: 'Quotation Ready',           message: `Your quotation for "${event.eventName}" is ready for review.` },
      confirmed:                 { title: 'Booking Confirmed',         message: `"${event.eventName}" is now confirmed. Please await team assignment.` },
      in_progress:               { title: 'Event In Progress',         message: `Your event "${event.eventName}" has started.` },
      completed_pending_balance: { title: 'Event Completed',           message: `"${event.eventName}" is done. Please pay the remaining balance.` },
      completed_paid:            { title: 'Payment Complete',          message: `"${event.eventName}" is fully paid. Thank you!` },
    };

    if (notifyMessages[status] && event.client) {
      try {
        await sendNotification({
          recipient: event.client._id,
          type:      'status_update',
          title:     notifyMessages[status].title,
          message:   notifyMessages[status].message,
          data:      { eventId: event._id },
          link:      `/client/events/${event._id}`,
        });
      } catch (notifErr) { console.log('Notify err:', notifErr.message); }
    }

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ALSO update these functions to call addTimelineEntry:
 *
 * In updateNeedsAssessment, after saving, add:
 *   event.addTimelineEntry('needs_assessed', req.user, 'Assessment completed');
 *   await event.save();
 *
 * In scheduleMeeting, after saving, add:
 *   await Event.findByIdAndUpdate(req.params.id, {
 *     $push: { timeline: {
 *       status: 'meeting_scheduled',
 *       label:  'Meeting Scheduled',
 *       note:   `${meetingType === 'ftf' ? 'Face-to-face' : 'Online'} meeting on ${confirmedDate} at ${confirmedTime}`,
 *       doneByName: req.user.name,
 *       completedAt: new Date(),
 *     }}
 *   });
 *
 * In assignResources, after saving, add the same pattern for 'assigned'.
 */
