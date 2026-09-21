const Event = require('../models/Event');
const Quotation = require('../models/Quotation');
const User = require('../models/User');
const { sendNotification, notifyAdmins } = require('../services/notificationService');
const { getIO } = require('../socket');

// Statuses where the event date is considered "locked in" — i.e. the inquiry
// has moved past the raw "just submitted, not yet reviewed" stage and hasn't
// been cancelled. Any of these on a given date should block new inquiries
// for that same date to prevent double-booking.
const BOOKED_STATUSES = [
  'inquiry_accepted', 'meeting_scheduled', 'needs_assessed', 'quotation_sent',
  'confirmed', 'downpayment_paid', 'assigned', 'in_progress',
  'completed_pending_balance', 'completed_paid', 'cancellation_requested',
];

// Returns the [start, end) UTC range for the calendar day of the given date/string
const dayRange = (dateInput) => {
  const d = new Date(dateInput);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end   = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

// Helper: append a timeline entry directly via $push (works even with lean updates)
const pushTimeline = async (eventId, status, user, note = '') => {
  const LABELS = {
    inquiry_received:          'Inquiry Received',
    inquiry_accepted:          'Inquiry Accepted',
    meeting_scheduled:         'Meeting Scheduled',
    needs_assessed:            'Needs Assessment Completed',
    quotation_sent:            'Quotation Sent to Client',
    confirmed:                 'Quotation Approved by Client',
    assigned:                  'Team & Equipment Assigned',
    in_progress:               'Event In Progress',
    completed_pending_balance: 'Event Completed — Pending Balance',
    completed_paid:            'Fully Paid & Completed',
    cancellation_requested:    'Cancellation Requested by Client',
    cancelled:                 'Cancelled',
  };
  try {
    await Event.updateOne(
      { _id: eventId, 'timeline.status': { $ne: status } }, // don't duplicate
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
  } catch (err) {
    console.log('[pushTimeline] error:', err.message);
  }
};

// ── Create event inquiry ──────────────────────────────────────────────────────
exports.createInquiry = async (req, res) => {
  try {
    const {
      eventName,
      eventDate,
      eventCategory,
      location,
      services,
      specialRequests,
      meetingPreference,
    } = req.body;

    if (!eventDate) {
      return res.status(400).json({ success: false, message: 'Event date is required' });
    }

    // ── Prevent double-booking: block the date once another inquiry on it
    // has been accepted (i.e. any status past raw "inquiry_received" and
    // not cancelled). This is re-checked here even though the client also
    // filters booked dates, since the UI check alone can't stop a race
    // condition between two people submitting around the same time.
    const { start, end } = dayRange(eventDate);
    const conflict = await Event.findOne({
      eventDate: { $gte: start, $lt: end },
      status: { $in: BOOKED_STATUSES },
    }).select('_id');

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: 'This date is already booked for another event. Please choose a different date.',
      });
    }

    const event = await Event.create({
      eventName,
      eventDate,
      eventCategory,
      location,
      services,
      specialRequests,
      meetingPreference,
      client: req.user.id,
      status: 'inquiry_received',
      // Record the first timeline entry immediately
      timeline: [{
        status:      'inquiry_received',
        label:       'Inquiry Received',
        note:        '',
        doneBy:      req.user.id,
        doneByName:  req.user.name,
        completedAt: new Date(),
      }],
    });

    await event.populate('client', 'name email phone');

    await notifyAdmins({
      type:    'inquiry_received',
      title:   'New Event Inquiry',
      message: `${req.user.name} submitted an inquiry for "${eventName}" on ${new Date(eventDate).toLocaleDateString()}`,
      data:    { eventId: event._id },
      link:    `/admin/events/${event._id}`,
    });

    res.status(201).json({ success: true, event });
  } catch (err) {
    console.error('Create Inquiry Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Get events (role-based) ───────────────────────────────────────────────────
exports.getEvents = async (req, res) => {
  try {
    const Equipment = require('../models/Equipment');
    let query = {};
    const { status, search } = req.query;

    if (req.user.role === 'client') {
      query.client = req.user.id;
    } else if (req.user.role === 'freelancer') {
      query['assignedFreelancers.freelancer'] = req.user.id;
    }

    if (status) query.status = status;
    if (search) query.eventName = { $regex: search, $options: 'i' };

    const events = await Event.find(query)
      .populate('client', 'name email phone avatar')
      .populate('assignedFreelancers.freelancer', 'name email skills avatar')
      .populate('assignedEquipment.equipment', 'name category')
      .sort({ createdAt: -1 })
      .lean();

    const allEquipment = await Equipment.find({}, 'name category condition availability quantity').lean();
    const equipMap = {};
    allEquipment.forEach(e => { equipMap[e._id.toString()] = e; });

    const populated = events.map(ev => ({
      ...ev,
      assignedFreelancers: (ev.assignedFreelancers || []).map(af => ({
        ...af,
        equipment: (af.equipment || []).map(eq => ({
          ...eq,
          equipment: equipMap[eq.equipment?.toString()] || eq.equipment,
        })),
      })),
    }));

    res.json({ success: true, events: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Booked dates (public-ish: any authenticated user submitting an inquiry
// needs this to know which dates are already taken) ──────────────────────────
exports.getBookedDates = async (req, res) => {
  try {
    const events = await Event.find(
      { status: { $in: BOOKED_STATUSES } },
      'eventDate -_id'
    ).lean();

    // Normalize to plain YYYY-MM-DD strings — the form only cares about the day
    const dates = [...new Set(
      events.map(e => new Date(e.eventDate).toISOString().slice(0, 10))
    )];

    res.json({ success: true, dates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Conversations: reshape into a uniform list scoped to what this requester
// is allowed to see, so the frontend doesn't need role-specific branching.
// Each entry carries `threadType`/`freelancerId` — pass those straight back
// on POST /:id/messages to reply in that exact thread.
function buildVisibleConversations(event, user, settings) {
  const allowDirect   = settings?.allowClientFreelancerDirectMessages     !== false;
  const allowTeammate = settings?.allowFreelancerFreelancerDirectMessages !== false;
  const convos = event.conversations || [];
  const findConvo = (type, freelancerId) => convos.find(c => {
    const cf = c.freelancer?._id?.toString() || c.freelancer?.toString() || null;
    return c.type === type && cf === (freelancerId || null);
  });
  // Freelancer↔freelancer threads are unordered pairs — check both directions
  const findPairConvo = (idA, idB) => convos.find(c => {
    if (c.type !== 'freelancer_freelancer') return false;
    const f1 = c.freelancer?._id?.toString() || c.freelancer?.toString() || null;
    const f2 = c.freelancer2?._id?.toString() || c.freelancer2?.toString() || null;
    return (f1 === idA && f2 === idB) || (f1 === idB && f2 === idA);
  });

  const result = [];

  if (user.role === 'client') {
    const ca = findConvo('client_admin', null);
    result.push({
      _id: ca?._id || null, threadType: 'admin', freelancerId: null,
      label: 'Admin', messages: ca?.messages || [],
    });
    (event.assignedFreelancers || []).forEach(af => {
      if (!allowDirect) return; // direct client↔freelancer messaging disabled admin-wide
      const fId = af.freelancer?._id?.toString() || af.freelancer?.toString();
      const convo = findConvo('freelancer_client', fId);
      result.push({
        _id: convo?._id || null, threadType: 'freelancer', freelancerId: fId,
        label: af.freelancer?.name || 'Freelancer', messages: convo?.messages || [],
      });
    });
  }

  if (user.role === 'admin') {
    const ca = findConvo('client_admin', null);
    result.push({
      _id: ca?._id || null, threadType: 'client', freelancerId: null,
      label: event.client?.name || 'Client', messages: ca?.messages || [],
    });
    (event.assignedFreelancers || []).forEach(af => {
      const fId = af.freelancer?._id?.toString() || af.freelancer?.toString();
      const convo = findConvo('admin_freelancer', fId);
      result.push({
        _id: convo?._id || null, threadType: 'freelancer', freelancerId: fId,
        label: af.freelancer?.name || 'Freelancer', messages: convo?.messages || [],
      });
    });
  }

  if (user.role === 'freelancer') {
    const myId = user.id;
    const withAdmin  = findConvo('admin_freelancer', myId);
    const withClient = findConvo('freelancer_client', myId);
    result.push({
      _id: withAdmin?._id || null, threadType: 'admin', freelancerId: null,
      label: 'Admin', messages: withAdmin?.messages || [],
    });
    if (allowDirect) {
      result.push({
        _id: withClient?._id || null, threadType: 'client', freelancerId: null,
        label: event.client?.name || 'Client', messages: withClient?.messages || [],
      });
    }
    // One private thread per OTHER assigned freelancer on this event
    (event.assignedFreelancers || []).forEach(af => {
      if (!allowTeammate) return; // freelancer↔freelancer messaging disabled admin-wide
      const otherId = af.freelancer?._id?.toString() || af.freelancer?.toString();
      if (!otherId || otherId === myId) return;
      const convo = findPairConvo(myId, otherId);
      result.push({
        _id: convo?._id || null, threadType: 'teammate', freelancerId: otherId,
        label: af.freelancer?.name || 'Teammate', messages: convo?.messages || [],
      });
    });
  }

  return result;
}

// ── Get single event ──────────────────────────────────────────────────────────
exports.getEvent = async (req, res) => {
  try {
    const Equipment = require('../models/Equipment');

    const event = await Event.findById(req.params.id)
      .populate('client', 'name email phone avatar address')
      .populate('assignedFreelancers.freelancer', 'name email skills avatar rating phone')
      .populate('assignedEquipment.equipment', 'name category condition availability')
      .populate('messages.sender', 'name avatar role')
      .populate('conversations.messages.sender', 'name avatar role')
      .populate('conversations.freelancer', 'name avatar')
      .populate('conversations.freelancer2', 'name avatar')
      .populate('attendance.freelancer', 'name email avatar')
      .lean();

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const allEquipment = await Equipment.find({}, 'name category condition availability').lean();
    const equipMap = {};
    allEquipment.forEach(e => { equipMap[e._id.toString()] = e; });

    event.assignedFreelancers = (event.assignedFreelancers || []).map(af => ({
      ...af,
      equipment: (af.equipment || []).map(eq => {
        const eqId = eq.equipment?.toString();
        return { ...eq, equipment: equipMap[eqId] || eq.equipment };
      }),
    }));

    if (req.user.role === 'client') {
      const clientId = event.client?._id?.toString() || event.client?.toString();
      if (clientId !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
    }
    if (req.user.role === 'freelancer') {
      const isAssigned = event.assignedFreelancers.some(af => {
        const fId = af.freelancer?._id?.toString() || af.freelancer?.toString();
        return fId === req.user.id;
      });
      if (!isAssigned) return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Replace the raw conversations array with only the threads this
    // requester is a party to, reshaped uniformly for the frontend
    event.conversations = buildVisibleConversations(event, req.user, event.messagingSettings);

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update needs assessment ───────────────────────────────────────────────────
exports.updateNeedsAssessment = async (req, res) => {
  try {
    const {
      attendees, videoType, specialRequests,
      selectedPackages,
      customItems,
      notes,
      needsAssessmentNotes,
    } = req.body;

    const event = await Event.findByIdAndUpdate(req.params.id, {
      attendees,
      videoType,
      specialRequests,
      status: 'needs_assessed',
      'needsAssessment.attendees':        attendees,
      'needsAssessment.videoType':        videoType,
      'needsAssessment.specialRequests':  specialRequests,
      'needsAssessment.selectedPackages': selectedPackages || [],
      'needsAssessment.customItems':      customItems     || [],
      'needsAssessment.notes':            notes || needsAssessmentNotes || '',
      'needsAssessment.assessedAt':       new Date(),
      'needsAssessment.assessedBy':       req.user.id,
    }, { new: true }).populate('client', 'name email phone');

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Record timeline
    await pushTimeline(
      event._id,
      'needs_assessed',
      req.user,
      `${(selectedPackages || []).length} package(s) agreed. Attendees: ${attendees || 'TBD'}`
    );

    try {
      await sendNotification({
        recipient: event.client._id,
        type:      'needs_assessment_scheduled',
        title:     'Needs Assessment Complete',
        message:   `Your event "${event.eventName}" needs have been assessed. A quotation will be prepared shortly.`,
        data:      { eventId: event._id },
        link:      `/client/events/${event._id}`,
      });
    } catch (notifErr) { console.log('Notify err:', notifErr.message); }

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update event status ───────────────────────────────────────────────────────
exports.updateStatus = async (req, res) => {
  try {
    const { status, completionNotes, note } = req.body;

    // Don't let a payment-milestone status be set by hand unless it's
    // actually backed by verified payments — mirrors the check
    // paymentController.getPaymentSummary already does, and keeps
    // 'downpayment_paid' consistent with the 'completed_paid' guard below.
    // 'downpayment_paid' requires 50% of the quotation total; 'completed_paid'
    // requires the full amount.
    const PAYMENT_MILESTONE_FRACTIONS = { downpayment_paid: 0.5, completed_paid: 1 };
    if (PAYMENT_MILESTONE_FRACTIONS[status] !== undefined) {
      const Payment = require('../models/Payment');
      const quotation = await Quotation.findOne({ event: req.params.id, status: 'approved' });
      if (quotation) {
        const verifiedPayments = await Payment.find({ event: req.params.id, status: 'verified' });
        const totalPaid = verifiedPayments.reduce((sum, p) => sum + p.amount, 0);
        const required = quotation.totalAmount * PAYMENT_MILESTONE_FRACTIONS[status];
        if (totalPaid < required) {
          const shortfall = required - totalPaid;
          const label = status === 'completed_paid' ? 'fully paid' : '50% downpayment';
          return res.status(400).json({
            success: false,
            message: `Cannot mark as ${label} — ₱${shortfall.toLocaleString()} still needed. Paid: ₱${totalPaid.toLocaleString()}, Required: ₱${required.toLocaleString()}`,
          });
        }
      }
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status, ...(completionNotes && { completionNotes }) },
      { new: true }
    ).populate('client', 'name email');

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Auto-return all assigned equipment when event is completed
    if (['completed_pending_balance', 'completed_paid'].includes(status)) {
      try {
        const Equipment = require('../models/Equipment');
        const fullEvent = await Event.findById(req.params.id).lean();
        const equippedIds = new Set();
        (fullEvent.assignedFreelancers || []).forEach(af => {
          (af.equipment || []).forEach(eq => {
            const eqId = eq.equipment?._id?.toString() || eq.equipment?.toString();
            if (eqId) equippedIds.add(eqId);
          });
        });
        if (equippedIds.size > 0) {
          await Equipment.updateMany(
            { _id: { $in: Array.from(equippedIds) }, availability: { $ne: 'retired' } },
            { availability: 'available' }
          );
        }
      } catch (eqErr) { console.log('[auto-return equipment]', eqErr.message); }
    }

    // Record timeline entry for every status change
    await pushTimeline(event._id, status, req.user, note || completionNotes || '');

    const statusMessages = {
      inquiry_accepted:          { type: 'general',         title: 'Inquiry Accepted',    message: `Your inquiry for "${event.eventName}" has been accepted. Our team will schedule a needs assessment meeting.` },
      meeting_scheduled:         { type: 'meeting_scheduled', title: 'Meeting Scheduled',   message: `Your needs assessment meeting for "${event.eventName}" has been scheduled.` },
      in_progress:               { type: 'general',         title: 'Event In Progress',   message: `Your event "${event.eventName}" has started!` },
      completed_pending_balance: { type: 'general',         title: 'Event Completed',     message: `Your event "${event.eventName}" has been completed. Please pay the remaining balance.` },
      completed_paid:            { type: 'event_completed', title: 'Payment Complete 🎉', message: `Your event "${event.eventName}" is fully paid and complete. We'd love to hear how it went — tap here to leave your feedback!` },
      cancelled:                 { type: 'general',         title: 'Event Cancelled',     message: `Your inquiry for "${event.eventName}" has been cancelled.` },
    };

    if (statusMessages[status] && event.client) {
      try {
        await sendNotification({
          recipient: event.client._id,
          type:      statusMessages[status].type,
          title:     statusMessages[status].title,
          message:   statusMessages[status].message,
          data:      { eventId: event._id },
          link:      status === 'completed_paid'
            ? `/client/events/${event._id}?feedback=true`
            : `/client/events/${event._id}`,
        });
      } catch (notifErr) { console.log('Notify err:', notifErr.message); }
    }

    try {
      getIO().to(event.client._id.toString()).emit('event_status_updated', { eventId: event._id, status });
    } catch {}

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Client requests cancellation ──────────────────────────────────────────────
exports.requestCancellation = async (req, res) => {
  try {
    const { reason } = req.body;
    const event = await Event.findById(req.params.id).populate('client', 'name email');

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Ownership check
    const clientId = event.client?._id?.toString() || event.client?.toString();
    if (clientId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Only allow cancellation on active/pre-completion statuses
    const cancellableStatuses = [
      'inquiry_received', 'inquiry_accepted', 'meeting_scheduled',
      'needs_assessed', 'quotation_sent', 'confirmed',
      'downpayment_paid', 'assigned', 'in_progress',
    ];
    if (!cancellableStatuses.includes(event.status)) {
      return res.status(400).json({
        success: false,
        message: `Event cannot be cancelled at status: ${event.status}`,
      });
    }

    // Check if cancellation was already requested
    if (event.status === 'cancellation_requested') {
      return res.status(400).json({ success: false, message: 'Cancellation already requested.' });
    }

    event.status = 'cancellation_requested';
    event.cancellationRequest = {
      requestedBy:  req.user.id,
      requestedAt:  new Date(),
      reason:       reason || '',
      status:       'pending',
    };
    await event.save();

    await pushTimeline(
      event._id,
      'cancellation_requested',
      req.user,
      reason ? `Reason: ${reason}` : 'No reason provided'
    );

    // Notify all admins
    await notifyAdmins({
      type:    'cancellation_requested',
      title:   'Cancellation Request',
      message: `${req.user.name} has requested to cancel "${event.eventName}".${reason ? ` Reason: ${reason}` : ''}`,
      data:    { eventId: event._id },
      link:    `/admin/events/${event._id}`,
    });

    // Confirm receipt to client
    await sendNotification({
      recipient: req.user.id,
      type:      'general',
      title:     'Cancellation Request Received',
      message:   `Your cancellation request for "${event.eventName}" has been submitted and is pending admin review.`,
      data:      { eventId: event._id },
      link:      `/client/events/${event._id}`,
    });

    try {
      getIO().to(req.user.id).emit('event_status_updated', {
        eventId: event._id,
        status: 'cancellation_requested',
      });
    } catch {}

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// ── Client withdraws a cancellation request ───────────────────────────────────
exports.withdrawCancellation = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('client', 'name email');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Ownership check
    const clientId = event.client?._id?.toString() || event.client?.toString();
    if (clientId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Can only withdraw if a cancellation is actually pending
    if (event.status !== 'cancellation_requested') {
      return res.status(400).json({ success: false, message: 'No pending cancellation request to withdraw.' });
    }

    // Derive the previous status from the timeline (same logic as reject path)
    const previousTimelineEntry = [...(event.timeline || [])]
      .reverse()
      .find(t => t.status !== 'cancellation_requested');
    const revertStatus = previousTimelineEntry?.status || 'inquiry_received';

    event.status = revertStatus;
    event.cancellationRequest.status     = 'withdrawn';
    event.cancellationRequest.resolvedBy = req.user.id;
    event.cancellationRequest.resolvedAt = new Date();
    await event.save();

    // Notify admins so they know the request is no longer pending
    await notifyAdmins({
      type:    'general',
      title:   'Cancellation Request Withdrawn',
      message: `${req.user.name} withdrew their cancellation request for "${event.eventName}".`,
      data:    { eventId: event._id },
      link:    `/admin/events/${event._id}`,
    });

    try {
      getIO().to(event.client._id.toString()).emit('event_status_updated', {
        eventId: event._id,
        status:  revertStatus,
      });
    } catch {}

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Admin approves or rejects a cancellation request ─────────────────────────
exports.processCancellationRequest = async (req, res) => {
  try {
    const { action, adminNote } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: "action must be 'approve' or 'reject'" });
    }

    const event = await Event.findById(req.params.id).populate('client', 'name email');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.status !== 'cancellation_requested') {
      return res.status(400).json({ success: false, message: 'No pending cancellation request for this event.' });
    }

    if (action === 'approve') {
      event.status = 'cancelled';
      event.cancellationRequest.status   = 'approved';
      event.cancellationRequest.resolvedBy   = req.user.id;
      event.cancellationRequest.resolvedAt   = new Date();
      event.cancellationRequest.adminNote    = adminNote || '';
      await event.save();

      await pushTimeline(
        event._id,
        'cancelled',
        req.user,
        adminNote ? `Approved. ${adminNote}` : 'Cancellation approved by admin.'
      );

      await sendNotification({
        recipient: event.client._id,
        type:      'general',
        title:     'Cancellation Approved',
        message:   `Your cancellation request for "${event.eventName}" has been approved. Please note: all payments made are non-refundable.${adminNote ? ` Note from admin: ${adminNote}` : ''}`,
        data:      { eventId: event._id },
        link:      `/client/events/${event._id}`,
      });

      try {
        getIO().to(event.client._id.toString()).emit('event_status_updated', {
          eventId: event._id,
          status: 'cancelled',
        });
      } catch {}

    } else {
      // Reject — revert to the status before cancellation was requested.
      // We derive the previous status from the second-to-last timeline entry.
      const previousTimelineEntry = [...(event.timeline || [])]
        .reverse()
        .find(t => t.status !== 'cancellation_requested');
      const revertStatus = previousTimelineEntry?.status || 'inquiry_received';

      event.status = revertStatus;
      event.cancellationRequest.status   = 'rejected';
      event.cancellationRequest.resolvedBy   = req.user.id;
      event.cancellationRequest.resolvedAt   = new Date();
      event.cancellationRequest.adminNote    = adminNote || '';
      await event.save();

      await sendNotification({
        recipient: event.client._id,
        type:      'general',
        title:     'Cancellation Request Declined',
        message:   `Your cancellation request for "${event.eventName}" was not approved and the event remains active.${adminNote ? ` Reason: ${adminNote}` : ''}`,
        data:      { eventId: event._id },
        link:      `/client/events/${event._id}`,
      });

      try {
        getIO().to(event.client._id.toString()).emit('event_status_updated', {
          eventId: event._id,
          status: revertStatus,
        });
      } catch {}
    }

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Assign freelancers & equipment ────────────────────────────────────────────
exports.assignResources = async (req, res) => {
  try {
    const Payment   = require('../models/Payment');
    const Equipment = require('../models/Equipment');
    const mongoose  = require('mongoose');
    const { assignedFreelancers } = req.body;

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Check 50% downpayment
    const verifiedPayments = await Payment.find({ event: event._id, status: 'verified' });
    const totalPaid = verifiedPayments.reduce((sum, p) => sum + p.amount, 0);
    const approvedQuotation = await Quotation.findOne({ event: event._id, status: 'approved' });

    if (approvedQuotation) {
      const requiredDownpayment = approvedQuotation.totalAmount * 0.5;
      if (totalPaid < requiredDownpayment) {
        return res.status(400).json({
          success: false,
          message: `50% downpayment required before assignment. Required: ₱${requiredDownpayment.toLocaleString()}, Paid: ₱${totalPaid.toLocaleString()}`,
        });
      }
    }

    // Roles that legitimately carry no gear — keep this in sync with
    // NO_EQUIPMENT_ROLES in the frontend's EventDetail.jsx.
    const NO_EQUIPMENT_ROLES = ['coordinator', 'assistant', 'host'];

    const missingEquipment = (assignedFreelancers || []).filter(af => {
      const role   = (af.role || '').trim().toLowerCase();
      const exempt = NO_EQUIPMENT_ROLES.includes(role);
      if (exempt) return false;
      const units = (af.equipment || []).reduce(
        (n, eq) => n + (Array.isArray(eq.unitIndices) ? eq.unitIndices.length : (parseInt(eq.quantity) || 0)),
        0
      );
      return units === 0;
    });

    if (missingEquipment.length > 0) {
      const ids = missingEquipment.map(af => af.freelancer);
      const named = await User.find({ _id: { $in: ids } }, 'name').lean();
      const nameMap = {};
      named.forEach(u => { nameMap[u._id.toString()] = u.name; });
      const names = ids.map(id => nameMap[id] || 'a team member');
      return res.status(400).json({
        success: false,
        message: `Please assign equipment to: ${names.join(', ')}`,
      });
    }

    const castFreelancers = (assignedFreelancers || []).map(af => ({
      _id:        new mongoose.Types.ObjectId(),
      freelancer: new mongoose.Types.ObjectId(af.freelancer),
      role:       af.role || '',
      assignedAt: new Date(),
      equipment:  (af.equipment || []).map(eq => ({
        _id:         new mongoose.Types.ObjectId(),
        equipment:   new mongoose.Types.ObjectId(eq.equipment),
        quantity:    parseInt(eq.quantity) || 1,
        unitIndices: Array.isArray(eq.unitIndices) ? eq.unitIndices.map(i => parseInt(i)) : [],
      })),
    }));

    await Event.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(req.params.id) },
      { $set: { assignedFreelancers: castFreelancers, status: 'assigned' } }
    );

    const saved = await Event.findById(req.params.id)
      .populate('client', 'name email')
      .populate('assignedFreelancers.freelancer', 'name email')
      .lean();

    if (!saved) return res.status(404).json({ success: false, message: 'Event not found after save' });

    // Record timeline
    const teamNames = castFreelancers.length > 0
      ? saved.assignedFreelancers.map(af => af.freelancer?.name || 'Freelancer').join(', ')
      : '';
    await pushTimeline(saved._id, 'assigned', req.user, `Team: ${teamNames}`);

    const allEq = await Equipment.find({}, 'name').lean();
    const equipMap = {};
    allEq.forEach(e => { equipMap[e._id.toString()] = e.name; });

    for (const af of saved.assignedFreelancers) {
      if (!af.freelancer) continue;
      const myEq = castFreelancers.find(
        c => c.freelancer.toString() === af.freelancer._id?.toString()
      );
      const eqNames = (myEq?.equipment || [])
        .map(e => equipMap[e.equipment.toString()] || 'Equipment')
        .filter(Boolean).join(', ');

      try {
        await sendNotification({
          recipient: af.freelancer._id,
          type:      'freelancer_assigned',
          title:     'New Project Assignment',
          message:   `You have been assigned to "${saved.eventName}" as ${af.role}${eqNames ? `. Your equipment: ${eqNames}` : ''}`,
          data:      { eventId: saved._id },
          link:      `/freelancer/events/${saved._id}`,
        });
      } catch (e) { console.log('Notify err:', e.message); }
    }

    try {
      await sendNotification({
        recipient: saved.client._id,
        type:      'event_confirmed',
        title:     'Team Assigned',
        message:   `Your project "${saved.eventName}" team has been assigned!`,
        data:      { eventId: saved._id },
        link:      `/client/events/${saved._id}`,
      });
    } catch (e) { console.log('Client notify err:', e.message); }

    res.json({ success: true, event: saved });
  } catch (err) {
    console.error('[assignResources] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Send message ──────────────────────────────────────────────────────────────
// ── Comments — one shared thread, visible to everyone on the event ───────────
exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Comment cannot be empty' });

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.status === 'completed_paid') {
      return res.status(403).json({ success: false, message: 'Comments are closed — this project is complete and fully paid.' });
    }

    // Same access rule as viewing the event — enforced again here since this
    // is its own write path, separate from getEvent's read-side check.
    if (req.user.role === 'client' && event.client.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (req.user.role === 'freelancer') {
      const isAssigned = event.assignedFreelancers.some(
        af => (af.freelancer?.toString() || '') === req.user.id
      );
      if (!isAssigned) return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const comment = {
      sender:     req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      content,
      createdAt:  new Date(),
    };
    event.messages.push(comment);
    await event.save();

    try {
      getIO().to(`event_${event._id}`).emit('new_comment', { ...comment, eventId: event._id });
    } catch {}

    res.json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Send a message into one of the three private thread types ────────────────
// Body: { content, threadType: 'admin' | 'client' | 'freelancer', freelancerId? }
// - client sending: threadType 'admin' (→ client_admin) or 'freelancer' + freelancerId (→ freelancer_client)
// - admin sending:  threadType 'client' (→ client_admin) or 'freelancer' + freelancerId (→ admin_freelancer)
// - freelancer sending: threadType 'admin' (→ admin_freelancer, self) or 'client' (→ freelancer_client, self)
exports.sendMessage = async (req, res) => {
  try {
    const { content, threadType, freelancerId } = req.body;
    const attachments = (req.files || []).map(f => ({
      url:  `/uploads/messages/${f.filename}`,
      name: f.originalname,
      type: f.mimetype,
      size: f.size,
    }));

    if (!content?.trim() && attachments.length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    if (event.status === 'completed_paid') {
      return res.status(403).json({ success: false, message: 'Messaging is closed — this project is complete and fully paid.' });
    }

    const role = req.user.role;
    let convoType, fId = null;

    const isAssignedFreelancer = (id) => event.assignedFreelancers.some(
      af => (af.freelancer?.toString() || '') === id
    );

    if (role === 'client') {
      const clientId = event.client?.toString();
      if (clientId !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized' });

      if (threadType === 'admin') {
        convoType = 'client_admin';
      } else if (threadType === 'freelancer' && freelancerId) {
        if (!isAssignedFreelancer(freelancerId)) {
          return res.status(400).json({ success: false, message: 'That freelancer is not assigned to this event' });
        }
        if (event.messagingSettings?.allowClientFreelancerDirectMessages === false) {
          return res.status(403).json({
            success: false,
            message: 'The admin has disabled direct messaging with freelancers on this project. Please message the admin instead.',
          });
        }
        convoType = 'freelancer_client';
        fId = freelancerId;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid thread' });
      }
    } else if (role === 'admin') {
      if (threadType === 'client') {
        convoType = 'client_admin';
      } else if (threadType === 'freelancer' && freelancerId) {
        if (!isAssignedFreelancer(freelancerId)) {
          return res.status(400).json({ success: false, message: 'That freelancer is not assigned to this event' });
        }
        convoType = 'admin_freelancer';
        fId = freelancerId;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid thread' });
      }
    } else if (role === 'freelancer') {
      if (!isAssignedFreelancer(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }
      if (threadType === 'client') {
        if (event.messagingSettings?.allowClientFreelancerDirectMessages === false) {
          return res.status(403).json({
            success: false,
            message: 'The admin has disabled direct messaging with the client on this project. Please message the admin instead.',
          });
        }
        convoType = 'freelancer_client'; fId = req.user.id;
      } else if (threadType === 'admin') {
        convoType = 'admin_freelancer'; fId = req.user.id;
      } else if (threadType === 'teammate' && freelancerId) {
        if (freelancerId === req.user.id) {
          return res.status(400).json({ success: false, message: "You can't message yourself" });
        }
        if (!isAssignedFreelancer(freelancerId)) {
          return res.status(400).json({ success: false, message: 'That teammate is not assigned to this event' });
        }
        if (event.messagingSettings?.allowFreelancerFreelancerDirectMessages === false) {
          return res.status(403).json({
            success: false,
            message: 'The admin has disabled direct messaging between freelancers on this project.',
          });
        }
        convoType = 'freelancer_freelancer';
        fId = freelancerId;
      } else {
        return res.status(400).json({ success: false, message: 'Invalid thread' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    let convo;
    if (convoType === 'freelancer_freelancer') {
      // Unordered pair — look up either direction before creating a new thread
      const otherId = freelancerId;
      convo = event.conversations.find(c => {
        if (c.type !== 'freelancer_freelancer') return false;
        const f1 = c.freelancer?.toString()  || null;
        const f2 = c.freelancer2?.toString() || null;
        return (f1 === req.user.id && f2 === otherId) || (f1 === otherId && f2 === req.user.id);
      });
      if (!convo) {
        event.conversations.push({ type: convoType, freelancer: req.user.id, freelancer2: otherId, messages: [] });
        convo = event.conversations[event.conversations.length - 1];
      }
    } else {
      convo = event.conversations.find(c => {
        const cf = c.freelancer?.toString() || null;
        return c.type === convoType && cf === (fId || null);
      });
      if (!convo) {
        event.conversations.push({ type: convoType, freelancer: fId || undefined, messages: [] });
        convo = event.conversations[event.conversations.length - 1];
      }
    }

    const message = {
      sender:     req.user.id,
      senderName: req.user.name,
      senderRole: req.user.role,
      content:    content || '',
      attachments,
      createdAt:  new Date(),
    };
    convo.messages.push(message);
    await event.save();

    try {
      getIO().to(`event_${event._id}`).emit('new_message', {
        ...message, eventId: event._id, threadType: convoType, freelancerId: fId,
      });
    } catch {}

    res.json({ success: true, message, threadType: convoType, freelancerId: fId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update checklist ──────────────────────────────────────────────────────────
exports.updateChecklist = async (req, res) => {
  try {
    const { checklist } = req.body;
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { preEventChecklist: checklist },
      { new: true }
    );
    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Freelancer check-in ───────────────────────────────────────────────────────
// NOTE: Route must use upload.array('proofPhotos', 5) instead of upload.single()
exports.checkIn = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const assigned = event.assignedFreelancers.find(af => 
      af.freelancer.toString() === req.user.id
    );

    if (!assigned) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this event' });
    }

    // Map all uploaded proof photos to their public URLs
    const proofPhotos = (req.files && req.files.length > 0)
      ? req.files.map(f => `/uploads/checkin/${f.filename}`)
      : (req.file ? [`/uploads/checkin/${req.file.filename}`] : []);

    const idx = event.attendance.findIndex(a => a.freelancer.toString() === req.user.id);

    const attendanceData = {
      freelancer:  req.user.id,
      role:        assigned?.role || 'No role assigned',
      checkedIn:   true,
      checkInTime: new Date(),
      proofPhotos,
    };

    if (idx === -1) {
      event.attendance.push(attendanceData);
    } else {
      event.attendance[idx] = { ...event.attendance[idx], ...attendanceData };
    }

    await event.save();

    res.json({ success: true, message: 'Checked in successfully' });
  } catch (err) {
    console.error('[checkIn] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Upload deliverable ────────────────────────────────────────────────────────
exports.uploadDeliverable = async (req, res) => {
  try {
    const { type, url } = req.body;
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    event.deliverables.push({ type, url });
    await event.save();

    try {
      await sendNotification({
        recipient: event.client,
        type:      'deliverable_uploaded',
        title:     'Deliverable Ready',
        message:   `Your ${type} for "${event.eventName}" is now available for download!`,
        data:      { eventId: event._id },
        link:      `/client/events/${event._id}`,
      });
    } catch {}

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Dashboard stats (admin) ───────────────────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const totalEvents     = await Event.countDocuments();
    const activeEvents    = await Event.countDocuments({ status: { $in: ['confirmed', 'assigned', 'in_progress'] } });
    const completedEvents = await Event.countDocuments({ status: { $in: ['completed_paid', 'completed_pending_balance'] } });
    const inquiries       = await Event.countDocuments({ status: 'inquiry_received' });

    const recentEvents = await Event.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('client', 'name email');

    res.json({ success: true, stats: { totalEvents, activeEvents, completedEvents, inquiries }, recentEvents });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Client submits feedback (once, after event is fully paid) ────────────────
exports.submitFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5.' });
    }

    const event = await Event.findById(req.params.id).populate('client', 'name email');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Ownership check
    const clientId = event.client?._id?.toString() || event.client?.toString();
    if (clientId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Only allow feedback once the event is fully paid & completed
    if (event.status !== 'completed_paid') {
      return res.status(400).json({
        success: false,
        message: 'Feedback can only be submitted once the event is fully paid and completed.',
      });
    }

    // Prevent resubmission
    if (event.feedback?.rating) {
      return res.status(400).json({ success: false, message: 'Feedback has already been submitted for this event.' });
    }

    event.feedback = {
      rating:      numericRating,
      comment:     (comment || '').trim(),
      submittedAt: new Date(),
    };
    await event.save();

    // Let admins know feedback came in
    await notifyAdmins({
      type:    'general',
      title:   'New Client Feedback',
      message: `${req.user.name} rated "${event.eventName}" ${numericRating}/5.`,
      data:    { eventId: event._id },
      link:    `/admin/events/${event._id}`,
    });

    res.json({ success: true, event });
  } catch (err) {
    console.error('[submitFeedback] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Schedule meeting ──────────────────────────────────────────────────────────
exports.scheduleMeeting = async (req, res) => {
  try {
    const { meetingType, confirmedDate, confirmedTime, location, notes } = req.body;

    const event = await Event.findByIdAndUpdate(req.params.id, {
      status: 'meeting_scheduled',
      'scheduledMeeting.meetingType':   meetingType,
      'scheduledMeeting.confirmedDate': new Date(confirmedDate),
      'scheduledMeeting.confirmedTime': confirmedTime,
      'scheduledMeeting.location':      location,
      'scheduledMeeting.notes':         notes || '',
      'scheduledMeeting.scheduledBy':   req.user.id,
      'scheduledMeeting.scheduledAt':   new Date(),
      'scheduledMeeting.status':        'confirmed',
    }, { new: true }).populate('client', 'name email');

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    // Record timeline
    const dateStr = new Date(confirmedDate).toLocaleDateString('en-PH', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    await pushTimeline(
      event._id,
      'meeting_scheduled',
      req.user,
      `${meetingType === 'ftf' ? 'Face-to-face' : 'Online'} meeting on ${dateStr} at ${confirmedTime}`
    );

    try {
      await sendNotification({
        recipient: event.client._id,
        type:      'meeting_scheduled',
        title:     'Meeting Scheduled',
        message:   `Your needs assessment meeting for "${event.eventName}" is confirmed on ${dateStr} at ${confirmedTime}.${meetingType === 'ftf' ? ` Location: ${location}` : ' Check the Meetings section to join.'}`,
        data:      { eventId: event._id },
        link:      `/client/meetings`,
      });
    } catch (notifErr) { console.log('Notify err:', notifErr.message); }

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Update per-project messaging settings (admin only) ────────────────────────
// Body: { allowClientFreelancerDirectMessages?: boolean, allowFreelancerFreelancerDirectMessages?: boolean }
exports.updateMessagingSettings = async (req, res) => {
  try {
    const { allowClientFreelancerDirectMessages, allowFreelancerFreelancerDirectMessages } = req.body;

    const update = {};
    if (typeof allowClientFreelancerDirectMessages === 'boolean') {
      update['messagingSettings.allowClientFreelancerDirectMessages'] = allowClientFreelancerDirectMessages;
    }
    if (typeof allowFreelancerFreelancerDirectMessages === 'boolean') {
      update['messagingSettings.allowFreelancerFreelancerDirectMessages'] = allowFreelancerFreelancerDirectMessages;
    }

    const event = await Event.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('messagingSettings');

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    res.json({ success: true, messagingSettings: event.messagingSettings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Mark meeting as done ──────────────────────────────────────────────────────
exports.markMeetingDone = async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(req.params.id, {
      status: 'needs_assessed',
      'scheduledMeeting.status': 'done',
    }, { new: true }).populate('client', 'name email');

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    try {
      await sendNotification({
        recipient: event.client._id,
        type:      'general',
        title:     'Meeting Completed',
        message:   `Your needs assessment meeting for "${event.eventName}" is done. We are now preparing your custom quotation.`,
        data:      { eventId: event._id },
        link:      `/client/events/${event._id}`,
      });
    } catch (notifErr) { console.log('Notify err:', notifErr.message); }

    res.json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};