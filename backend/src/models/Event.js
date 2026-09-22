const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema({
  status:    { type: String, required: true },
  label:     { type: String, required: true },
  note:      { type: String, default: '' },
  doneBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doneByName:{ type: String, default: '' },
  completedAt: { type: Date, default: Date.now },
}, { _id: true });

const eventSchema = new mongoose.Schema({
  client:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventName:   { type: String, required: true },
  eventDate:   { type: Date,   required: true },
  eventCategory: {
    type: String,
    enum: ['Corporate', 'Wedding', 'Debut', 'Birthday', 'Concert', 'Conference', 'Government', 'Religious', 'Sports', 'Others'],
  },
  location:    { type: String, required: true },

  // Client-selected service categories
  services: {
    liveStreaming:        { type: Boolean, default: false },
    documentation:       { type: Boolean, default: false },
    weddingDebut:        { type: Boolean, default: false },
    virtualLivestreaming:{ type: Boolean, default: false },
  },

  attendees:       { type: String },
  specialRequests: { type: String },

  // ── Status ──────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: [
      'inquiry_received',
      'inquiry_accepted',
      'meeting_scheduled',
      'needs_assessed',
      'quotation_sent',
      'confirmed',
      'downpayment_paid',
      'assigned',
      'in_progress',
      'completed_pending_balance',
      'completed_paid',
      'cancellation_requested',   // ← client has asked to cancel; pending admin review
      'cancelled',
    ],
    default: 'inquiry_received',
  },

  // ── Cancellation request (written when client requests cancellation) ─────
  cancellationRequest: {
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date },
    reason:      { type: String, default: '' },
    // 'pending' while waiting for admin, 'approved' / 'rejected' once resolved
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'withdrawn'],
      default: 'pending',
    },
    resolvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt:  { type: Date },
    adminNote:   { type: String, default: '' },
  },

  // ── Timeline: one entry per completed step ───────────────────────────────
  timeline: [timelineEntrySchema],

  // ── Client meeting preference ────────────────────────────────────────────
  meetingPreference: {
    type:              { type: String, enum: ['online', 'ftf'], default: 'online' },
    preferredDate:     { type: Date },
    preferredTime:     { type: String },
    preferredLocation: { type: String },
  },

  // ── Admin-confirmed meeting schedule ─────────────────────────────────────
  scheduledMeeting: {
    confirmedDate:{ type: Date },
    confirmedTime:{ type: String },
    location:     { type: String },
    meetingType:  { type: String, enum: ['online', 'ftf'] },
    notes:        { type: String },
    scheduledBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scheduledAt:  { type: Date },
    status:       { type: String, enum: ['pending', 'confirmed', 'done'], default: 'pending' },
  },

  // ── Needs assessment ─────────────────────────────────────────────────────
  needsAssessment: {
    attendees:        { type: String },
    videoType:        { type: String },
    selectedPackages: { type: [String], default: [] },
    customItems: [{
      name:       { type: String },
      description:{ type: String },
      price:      { type: Number, default: 0 },
    }],
    notes:       { type: String },
    specialRequests: { type: String },
    assessedAt:  { type: Date },
    assessedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },

  // ── Team assignment ───────────────────────────────────────────────────────
  assignedFreelancers: [{
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role:       { type: String },
    assignedAt: { type: Date, default: Date.now },
    equipment: [{
      equipment:   { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' },
      quantity:    { type: Number, default: 1 },
      // Which specific unit slots (0-based) of this equipment item are
      // assigned to this freelancer, e.g. [0, 2] = units #1 and #3.
      unitIndices: { type: [Number], default: [] },
    }],
  }],

  assignedEquipment: [{
    equipment:  { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' },
    quantity:   { type: Number, default: 1 },
    assignedAt: { type: Date, default: Date.now },
  }],

  // ── Comments ──────────────────────────────────────────────────────────────
  // A single shared thread, visible to everyone with access to this event
  // (client, admin, every assigned freelancer). For private 1:1 conversations,
  // see `conversations` below instead.
  messages: [{
    sender:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String },
    senderRole: { type: String },
    content:    { type: String },
    createdAt:  { type: Date, default: Date.now },
  }],

  // ── Direct Messages ───────────────────────────────────────────────────────
  // One thread per pair: exactly one 'client_admin' thread per event, and one
  // 'admin_freelancer' + one 'freelancer_client' thread PER assigned
  // freelancer (private/per-person, not a shared team thread).
  conversations: [{
    type: {
      type: String,
      enum: ['client_admin', 'admin_freelancer', 'freelancer_client', 'freelancer_freelancer'],
      required: true,
    },
    // Only set for admin_freelancer / freelancer_client — identifies which
    // specific freelancer this private thread belongs to. For
    // freelancer_freelancer, this is one side of the pair and `freelancer2`
    // is the other — order doesn't matter, lookups check both directions.
    freelancer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    freelancer2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    messages: [{
      sender:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      senderName: { type: String, default: '' },
      senderRole: { type: String, default: '' },
      content:    { type: String, default: '' },
      attachments: [{
        url:  { type: String, required: true },
        name: { type: String, default: '' },
        type: { type: String, default: '' }, // mime type, used to decide image preview vs file link
        size: { type: Number, default: 0 },
      }],
      createdAt:  { type: Date, default: Date.now },
    }],
  }],

  preEventChecklist: [{
    item:      { type: String },
    completed: { type: Boolean, default: false },
  }],

  // ── Messaging controls (per-project, set by admin) ───────────────────────
  // Governs the 'freelancer_client' and 'freelancer_freelancer' conversation
  // types above. Admin threads (client_admin / admin_freelancer) always work
  // regardless of these — they're the fallback when direct messaging is off.
  messagingSettings: {
    allowClientFreelancerDirectMessages:     { type: Boolean, default: true },
    allowFreelancerFreelancerDirectMessages: { type: Boolean, default: true },
  },

  attendance: [{
    freelancer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedIn:    { type: Boolean, default: false },
    checkInTime:  { type: Date },
    proofPhotos:  { type: [String], default: [] },
  }],

  deliverables: [{
    name:       { type: String },
    url:        { type: String },
    uploadedAt: { type: Date, default: Date.now },
  }],

  completionNotes: { type: String },

  // ── Client feedback (submitted once, after full payment) ────────────────
  feedback: {
    rating:      { type: Number, min: 1, max: 5 },
    comment:     { type: String, default: '' },
    submittedAt: { type: Date },
    // Admin picks which feedback is safe to show publicly on the homepage —
    // a client's rating is never shown there automatically.
    featured:    { type: Boolean, default: false },
  },

}, { timestamps: true });

// ── Auto-append timeline entry when status changes ───────────────────────────
const STATUS_LABELS_MAP = {
  inquiry_received:          'Inquiry Received',
  inquiry_accepted:          'Inquiry Accepted',
  meeting_scheduled:         'Meeting Scheduled',
  needs_assessed:            'Needs Assessment Completed',
  quotation_sent:            'Quotation Sent to Client',
  confirmed:                 'Quotation Approved by Client',
  downpayment_paid:          '50% Downpayment Received',
  assigned:                  'Team & Equipment Assigned',
  in_progress:               'Event In Progress',
  completed_pending_balance: 'Event Completed — Pending Balance',
  completed_paid:            'Fully Paid & Completed',
  cancellation_requested:    'Cancellation Requested by Client',
  cancelled:                 'Cancelled',
};

eventSchema.methods.addTimelineEntry = function(status, doneByUser, note) {
  const label = STATUS_LABELS_MAP[status] || status;
  // Don't duplicate if same status already recorded
  const alreadyHas = this.timeline.some(t => t.status === status);
  if (!alreadyHas) {
    this.timeline.push({
      status,
      label,
      note: note || '',
      doneBy:     doneByUser?._id || doneByUser || null,
      doneByName: doneByUser?.name || '',
      completedAt: new Date(),
    });
  }
};

module.exports = mongoose.model('Event', eventSchema);