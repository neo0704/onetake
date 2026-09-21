const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  event:       { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  title:       { type: String, required: true },
  scheduledAt: { type: Date,   required: true },
  duration:    { type: Number, default: 60 },
  notes:       { type: String, default: '' },
  scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  participants:[ { type: mongoose.Schema.Types.ObjectId, ref: 'User' } ],
  status:      { type: String, enum: ['requested','scheduled','ongoing','done','cancelled','declined','expired'], default: 'scheduled' },
  declineReason:{ type: String, default: '' },
  roomId:      { type: String, unique: true, sparse: true },
  isPrivate:   { type: Boolean, default: false },
  // Admin override: when true, this meeting is exempt from the automatic
  // expiry sweep even though its scheduled window has passed. Set/cleared
  // only through the toggle-lock endpoint.
  manuallyReactivated: { type: Boolean, default: false },
}, { timestamps: true });

// Grace period after a meeting's window closes before it's locked. Without
// this, a call running slightly long would get locked out mid-conversation.
const GRACE_MINUTES = 15;

meetingSchema.methods.isPastWindow = function () {
  if (!this.scheduledAt) return false;
  const end = new Date(this.scheduledAt).getTime()
    + (this.duration || 60) * 60000
    + GRACE_MINUTES * 60000;
  return Date.now() > end;
};

// Only 'requested' and 'scheduled' meetings can go stale. An 'ongoing'
// meeting is actively happening; done/cancelled/declined are already final.
// A manually-reactivated meeting is exempt — the admin explicitly chose to
// keep it open despite the window having closed.
meetingSchema.methods.shouldExpire = function () {
  if (this.manuallyReactivated) return false;
  return ['requested', 'scheduled'].includes(this.status) && this.isPastWindow();
};

meetingSchema.methods.isJoinable = function () {
  if (this.manuallyReactivated) return true;
  if (this.status === 'ongoing') return true;
  return this.status === 'scheduled' && !this.isPastWindow();
};

meetingSchema.statics.GRACE_MINUTES = GRACE_MINUTES;

module.exports = mongoose.model('Meeting', meetingSchema);