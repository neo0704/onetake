const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'OneTake Events <noreply@onetake.com>',
      to, subject, html
    });
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error('Email send error:', err.message);
    throw err;
  }
};

const User = require('../models/User');

// Notification-style emails (quotations, payment confirmations, reminders)
// respect the recipient's preference. Account-security emails (verification
// codes) never call this — those always send.
//
// Deliberately re-fetches the field directly from the DB by ID rather than
// trusting whatever the caller happened to .populate() on the object they
// passed in — that way this check works correctly no matter which fields a
// given controller selected, instead of silently defaulting to "on" whenever
// a call site forgets to include emailNotificationsEnabled in its populate.
const wantsEmailNotifications = async (userOrId) => {
  const id = userOrId?._id || userOrId;
  if (!id) return true; // no id at all — fail open rather than silently drop a real send
  try {
    const fresh = await User.findById(id).select('emailNotificationsEnabled').lean();
    return fresh?.emailNotificationsEnabled !== false;
  } catch (err) {
    console.error('[wantsEmailNotifications] lookup failed, sending anyway:', err.message);
    return true; // fail open on lookup errors
  }
};

const sendQuotationEmail = async (client, quotation) => {
  if (!(await wantsEmailNotifications(client))) return;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:20px">
      <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">🎬 OneTake Events</h1>
        <p style="margin:5px 0;opacity:0.8">Your Quotation is Ready</p>
      </div>
      <div style="background:white;padding:30px;border-radius:0 0 8px 8px">
        <h2 style="color:#1a1a2e">Hello ${client.name},</h2>
        <p>Your quotation <strong>${quotation.quotationNumber}</strong> for event <strong>${quotation.event?.eventName || ''}</strong> has been prepared.</p>
        <div style="background:#f0f4ff;padding:15px;border-radius:8px;margin:20px 0">
          <p style="margin:5px 0"><strong>Quotation No:</strong> ${quotation.quotationNumber}</p>
          <p style="margin:5px 0"><strong>Total Amount:</strong> ₱${quotation.totalAmount?.toLocaleString()}</p>
          <p style="margin:5px 0"><strong>Downpayment (50%):</strong> ₱${quotation.paymentTerms?.downpaymentAmount?.toLocaleString()}</p>
          <p style="margin:5px 0"><strong>Balance:</strong> ₱${quotation.paymentTerms?.balanceAmount?.toLocaleString()}</p>
        </div>
        <p>Please log in to your OneTake portal to review and approve the quotation.</p>
        <a href="${process.env.CLIENT_URL}/client/quotations/${quotation._id}" 
           style="display:inline-block;background:#e94560;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
          View Quotation
        </a>
        <p style="margin-top:20px;color:#666;font-size:13px">
          <strong>Note:</strong> 50% downpayment is required to confirm your reservation.
        </p>
      </div>
    </div>
  `;
  await sendEmail({ to: client.email, subject: `OneTake Quotation ${quotation.quotationNumber} - ${quotation.event?.eventName}`, html });
};

const sendPaymentConfirmationEmail = async (client, payment) => {
  if (!(await wantsEmailNotifications(client))) return;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a2e;color:white;padding:20px;text-align:center">
        <h1>🎬 OneTake Events</h1>
      </div>
      <div style="padding:30px">
        <h2>Payment Verified ✅</h2>
        <p>Hello ${client.name}, your payment has been verified!</p>
        <p><strong>Amount:</strong> ₱${payment.amount?.toLocaleString()}</p>
        <p><strong>Reference:</strong> ${payment.referenceNumber || 'N/A'}</p>
        <p><strong>Type:</strong> ${payment.type}</p>
        <p>Thank you for choosing OneTake Events!</p>
      </div>
    </div>
  `;
  await sendEmail({ to: client.email, subject: 'OneTake - Payment Confirmed', html });
};

const sendEventReminderEmail = async (recipient, event, daysUntil) => {
  if (!(await wantsEmailNotifications(recipient))) return;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1a1a2e;color:white;padding:20px;text-align:center">
        <h1>🎬 OneTake Events</h1>
      </div>
      <div style="padding:30px">
        <h2>Event Reminder ⏰</h2>
        <p>Hello ${recipient.name},</p>
        <p>This is a reminder that <strong>${event.eventName}</strong> is ${daysUntil === 0 ? 'TODAY!' : `in ${daysUntil} day(s)`}</p>
        <p><strong>Date:</strong> ${new Date(event.eventDate).toLocaleDateString()}</p>
        <p><strong>Location:</strong> ${event.location}</p>
      </div>
    </div>
  `;
  await sendEmail({ to: recipient.email, subject: `Reminder: ${event.eventName} - ${daysUntil === 0 ? 'TODAY!' : `in ${daysUntil} days`}`, html });
};

const sendVerificationEmail = async (user, code) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:20px">
      <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">🎬 OneTake Events</h1>
        <p style="margin:5px 0;opacity:0.8">Verify your email</p>
      </div>
      <div style="background:white;padding:30px;border-radius:0 0 8px 8px;text-align:center">
        <h2 style="color:#1a1a2e">Hello ${user.name},</h2>
        <p>Enter this code to verify your email and finish creating your account:</p>
        <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;margin:24px 0">${code}</p>
        <p style="color:#666;font-size:13px">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    </div>
  `;
  await sendEmail({ to: user.email, subject: `${code} is your OneTake verification code`, html });
};

// Account-security email — deliberately does NOT check
// wantsEmailNotifications(). A user who disabled promotional emails should
// still be able to recover their account.
const sendPasswordResetEmail = async (user, code) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:20px">
      <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">🎬 OneTake Events</h1>
        <p style="margin:5px 0;opacity:0.8">Reset your password</p>
      </div>
      <div style="background:white;padding:30px;border-radius:0 0 8px 8px;text-align:center">
        <h2 style="color:#1a1a2e">Hello ${user.name},</h2>
        <p>Enter this code to reset your password:</p>
        <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a1a2e;margin:24px 0">${code}</p>
        <p style="color:#666;font-size:13px">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email — your password won't be changed.</p>
      </div>
    </div>
  `;
  await sendEmail({ to: user.email, subject: `${code} is your OneTake password reset code`, html });
};

// Account-security email — deliberately does NOT check wantsEmailNotifications().
// Fires after a successful password change, regardless of how it happened
// (self-service change-password, or the forgot-password reset flow). If this
// wasn't the account owner, this is the tripwire that tells them so.
const sendPasswordChangedAlert = async (user) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:20px">
      <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">🎬 OneTake Events</h1>
        <p style="margin:5px 0;opacity:0.8">Security Alert</p>
      </div>
      <div style="background:white;padding:30px;border-radius:0 0 8px 8px">
        <h2 style="color:#1a1a2e">Hello ${user.name},</h2>
        <p>Your OneTake account password was just changed.</p>
        <p style="color:#666;font-size:13px">If this was you, no action is needed. If you did <strong>not</strong> make this change, your account may be compromised — reset your password immediately using "Forgot password?" on the login page, and contact support.</p>
      </div>
    </div>
  `;
  await sendEmail({ to: user.email, subject: 'Your OneTake password was changed', html });
};

// Account-security email — deliberately does NOT check wantsEmailNotifications().
// Fires when the account gets locked out from repeated failed login attempts.
const sendAccountLockedAlert = async (user, lockMinutes) => {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9f9f9;padding:20px">
      <div style="background:#1a1a2e;color:white;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="margin:0;font-size:24px">🎬 OneTake Events</h1>
        <p style="margin:5px 0;opacity:0.8">Security Alert</p>
      </div>
      <div style="background:white;padding:30px;border-radius:0 0 8px 8px">
        <h2 style="color:#1a1a2e">Hello ${user.name},</h2>
        <p>Your OneTake account was temporarily locked for ${lockMinutes} minutes after several failed login attempts.</p>
        <p style="color:#666;font-size:13px">If this was you, just try again after the lock period ends. If you don't recognize these attempts, someone may be trying to guess your password — consider changing it once you're back in, using "Forgot password?" if needed.</p>
      </div>
    </div>
  `;
  await sendEmail({ to: user.email, subject: 'Your OneTake account was temporarily locked', html });
};

module.exports = {
  sendEmail, sendQuotationEmail, sendPaymentConfirmationEmail,
  sendEventReminderEmail, sendVerificationEmail, sendPasswordResetEmail,
  sendPasswordChangedAlert, sendAccountLockedAlert,
};