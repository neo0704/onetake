const nodemailer = require('nodemailer');
const Notification = require('../models/Notification');
const User = require('../models/User');

let io;
try {
  const socketModule = require('../socket');
  io = socketModule.getIO;
} catch (e) {}

// ── Email transporter (Nodemailer / Gmail SMTP) ───────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false, // true for port 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Simple, presentable HTML wrapper so emails don't look like plain text dumps
const buildEmailHtml = ({ title, message, link }) => `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0a0a0f; color: #ffffff; border-radius: 16px;">
    <p style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: rgba(255,255,255,0.4); margin: 0 0 24px;">OneTake</p>
    <h2 style="font-size: 20px; margin: 0 0 12px;">${title}</h2>
    <p style="font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.75); margin: 0 0 24px;">${message}</p>
    ${link ? `<a href="${process.env.CLIENT_URL || ''}${link}" style="display: inline-block; background: #ffffff; color: #000000; font-weight: 700; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; padding: 12px 20px; border-radius: 10px; text-decoration: none;">View Details</a>` : ''}
  </div>
`;

const sendEmail = async ({ to, subject, title, message, link }) => {
  try {
    if (!to) return;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html: buildEmailHtml({ title, message, link }),
    });
  } catch (err) {
    // Never let an email failure break the notification flow
    console.error('Email send error:', err.message);
  }
};

const sendNotification = async ({ recipient, sender, type, title, message, data, link }) => {
  try {
    const notification = await Notification.create({
      recipient, sender, type, title, message, data, link
    });

    // Real-time via Socket.io
    try {
    const ioInstance = require('../socket').getIO();
      console.log('🔥 EMITTING new_notification to room:', recipient.toString(), 'data:', notification._id);
      ioInstance.to(recipient.toString()).emit('new_notification', notification);

      // NEW: Equipment assignment notification
      if (type === 'equipment_approved' && data?.eventId && data?.equipmentName) {
        ioInstance.to(data.eventId.toString()).emit('equipment_assigned', {
          freelancerId: recipient.toString(),
          equipmentName: data.equipmentName,
          eventId: data.eventId
        });
      }
    } catch (e) {
      console.error('Socket emit ERROR:', e.message);
    }

    // Email — clients and admins get emailed about relevant updates.
    // Respects the recipient's emailNotificationsEnabled preference, same as
    // emailService.js. Fire-and-forget so a slow/failed email never delays
    // the response.
    User.findById(recipient).select('name email role emailNotificationsEnabled').lean()
      .then(user => {
        const emailableRoles = ['client', 'admin', 'freelancer'];
        if (user && emailableRoles.includes(user.role) && user.email && user.emailNotificationsEnabled !== false) {
          sendEmail({
            to:      user.email,
            subject: title,
            title,
            message,
            link,
          });
        }
      })
      .catch(err => console.error('Email lookup error:', err.message));

    return notification;
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

const notifyAdmins = async (notifData) => {
  try {
    const admins = await User.find({ role: 'admin', isActive: true });
    for (const admin of admins) {
      await sendNotification({ ...notifData, recipient: admin._id });
    }
  } catch (err) {
    console.error('NotifyAdmins error:', err.message);
  }
};

const notifyFreelancers = async (freelancerIds, notifData) => {
  for (const fId of freelancerIds) {
    await sendNotification({ ...notifData, recipient: fId });
  }
};

module.exports = { sendNotification, notifyAdmins, notifyFreelancers, sendEmail };