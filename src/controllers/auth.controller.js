const jwt = require('jsonwebtoken');
const User = require('../models/User');

function generateToken(user) {
  try {
    const secret = process.env.JWT_SECRET || 'fallback_secret_change_me_in_prod';
    return jwt.sign(
      { id: user.id, role: user.role },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  } catch (err) {
    console.error('[AUTH] Token generation failed:', err);
    throw new Error('Token generation failed');
  }
}

const authController = {
  // POST /api/auth/setup — One-time master admin creation
  setup(req, res) {
    if (User.masterAdminExists()) {
      return res.status(403).json({ error: 'Master admin already exists' });
    }
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
      const user = User.create({ username, email, password, role: 'master_admin' });
      const token = generateToken(user);
      res.status(201).json({ user, token, message: 'Master admin created successfully' });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }
      res.status(500).json({ error: 'Failed to create master admin' });
    }
  },

  // GET /api/auth/setup-status — Check if master admin exists
  setupStatus(_req, res) {
    res.json({ needsSetup: !User.masterAdminExists() });
  },

  // POST /api/auth/signup — User registration (role: user)
  signup(req, res) {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
      const user = User.create({ username, email, password, role: 'user' });
      const token = generateToken(user);
      res.status(201).json({ user, token });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  // POST /api/auth/login — Login for all roles
  login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
    }
    if (!User.verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Log the login
    User.logLogin(user.id, req.ip, req.get('user-agent'));
    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  },

  // GET /api/auth/me — Get current user profile
  me(req, res) {
    res.json({ user: req.user });
  },
};

module.exports = authController;
