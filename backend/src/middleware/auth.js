const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });

    // Login blocks deactivated / unapproved accounts, but a token issued earlier
    // would otherwise keep working until it expires. Re-check on every request so
    // deactivating or rejecting a user cuts off their access immediately.
    if (req.user.isActive === false || req.user.accountStatus === 'rejected' || req.user.accountStatus === 'pending') {
      return res.status(401).json({ success: false, message: 'Your account no longer has access.' });
    }

    // If the password was changed AFTER this token was issued, the token is
    // stale — reject it even though it's cryptographically still valid.
    // This is what actually kicks out a stolen/old session the moment the
    // real owner changes their password, instead of it staying valid until
    // the token's natural JWT_EXPIRE.
    if (req.user.passwordChangedAt) {
      const changedAtSeconds = Math.floor(req.user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat && decoded.iat < changedAtSeconds) {
        return res.status(401).json({
          success: false,
          message: 'Your password was changed. Please log in again.',
        });
      }
    }

    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Role '${req.user.role}' is not authorized` });
  }
  next();
};