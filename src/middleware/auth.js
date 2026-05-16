const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify JWT token and attach user to request.
 * Rejects with 401 if token is missing/invalid.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_change_me_in_prod';
    const decoded = jwt.verify(token, secret);
    const user = User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional auth — attaches user if token present, but doesn't block.
 * Used for ESP32 endpoints that don't need auth.
 */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const token = header.split(' ')[1];
      const secret = process.env.JWT_SECRET || 'fallback_secret_change_me_in_prod';
      const decoded = jwt.verify(token, secret);
      req.user = User.findById(decoded.id);
    } catch {
      // Ignore — no auth is fine
    }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
