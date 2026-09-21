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
  eventEndDate:{ type: Date },
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
      'assigned',
      'in_progress',
      'completed_pending_balance',
      'completed_paid',
      'cancelled',
    ],
    default: 'inquiry_received',
  },

  // ── Timeline: one entry per completed step ───────────────────────────────
  // Automatically appended whenever status changes
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
      equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' },
      quantity:  { type: Number, default: 1 },
    }],
  }],

  assignedEquipment: [{
    equipment:  { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' },
    quantity:   { type: Number, default: 1 },
    assignedAt: { type: Date, default: Date.now },
  }],

  // ── Communication ─────────────────────────────────────────────────────────
  messages: [{
    sender:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: { type: String },
    senderRole: { type: String },
    content:    { type: String },
    createdAt:  { type: Date, default: Date.now },
  }],

  preEventChecklist: [{
    item:      { type: String },
    completed: { type: Boolean, default: false },
  }],

  attendance: [{
    freelancer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedIn:   { type: Boolean, default: false },
    checkInTime: { type: Date },
  }],

  deliverables: [{
    name:       { type: String },
    url:        { type: String },
    uploadedAt: { type: Date, default: Date.now },
  }],

  completionNotes: { type: String },

}, { timestamps: true });

// ── Auto-append timeline entry when status changes ───────────────────────────
const STATUS_LABELS_MAP = {
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
