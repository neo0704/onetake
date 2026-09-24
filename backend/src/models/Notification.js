const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type: String,
    enum: [
      'inquiry_received', 'needs_assessment_scheduled', 'quotation_sent',
      'quotation_approved', 'quotation_rejected', 'payment_submitted',
      'payment_verified', 'payment_rejected', 'event_confirmed',
      'freelancer_assigned', 'event_reminder', 'event_started',
      'event_completed', 'final_payment_due', 'deliverable_uploaded',
      'message_received', 'meeting_scheduled', 'meeting_requested', 'meeting_declined',
      'quotation_comment', 'equipment_approved', 'equipment_rejected', 'general'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date },
  link: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);