// Break-glass password reset — run this directly on the server when normal
// recovery (forgot-password email, change-password) isn't an option.
// Bypasses the web app entirely; only usable by someone with direct access
// to this machine/repo and the database connection string in .env.
//
// Usage (from the backend project root):
//   node scripts/resetAdminPassword.js admin@example.com NewStrongPassword123
//
// If no email is given, it defaults to resetting the (first) admin account:
//   node scripts/resetAdminPassword.js NewStrongPassword123

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function main() {
  const args = process.argv.slice(2);
  let email, newPassword;

  if (args.length >= 2) {
    [email, newPassword] = args;
  } else if (args.length === 1) {
    newPassword = args[0]; // no email given — falls back to the admin role below
  } else {
    console.error('Usage: node scripts/resetAdminPassword.js [email] <newPassword>');
    process.exit(1);
  }

  if (!newPassword || newPassword.length < 6) {
    console.error('New password must be at least 6 characters.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Could not find MONGO_URI or MONGODB_URI in your .env — check config/db.js for the actual variable name and edit this script if it differs.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const users = db.collection('users');

  const query = email ? { email: email.toLowerCase() } : { role: 'admin' };
  const user = await users.findOne(query);

  if (!user) {
    console.error(`No user found matching ${email ? `email "${email}"` : 'role "admin"'}.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await users.updateOne(
    { _id: user._id },
    {
      $set: {
        password: hashed,
        passwordChangedAt: new Date(), // invalidates any existing JWT sessions
        loginAttempts: 0,
      },
      $unset: { lockUntil: '', resetPasswordCode: '' },
    }
  );

  console.log(`✅ Password reset for ${user.email} (${user.role}). Existing sessions are now invalidated — they'll need to log in again.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});