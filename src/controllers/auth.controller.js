const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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
    if (!User.isRealEmail(email)) {
      return res.status(400).json({ error: 'Please use a valid personal email (Gmail, Yahoo, Outlook, etc.)' });
    }
    try {
      const { phone_number } = req.body;
      const user = User.create({ username, email, password, phone_number, role: 'user' });
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

    // Check for 2FA
    if (user.two_factor_enabled) {
      const otp = User.generateOTP(user.id, '2fa');
      // In real life, you'd send this via SMS/Email here
      return res.json({ 
        requires_2fa: true, 
        user_id: user.id,
        message: 'A verification code has been sent to your registered device' 
      });
    }

    // Log the login
    User.logLogin(user.id, req.ip, req.get('user-agent'));
    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  },

  // POST /api/auth/verify-2fa
  verify2FA(req, res) {
    const { user_id, code } = req.body;
    if (!user_id || !code) return res.status(400).json({ error: 'user_id and code are required' });

    const isValid = User.verifyOTP(user_id, code, '2fa');
    if (!isValid) return res.status(401).json({ error: 'Invalid or expired verification code' });

    const user = User.findById(user_id);
    
    // Mark as verified since they passed 2FA
    User.updateVerified(user.id, 1);
    
    User.logLogin(user.id, req.ip, req.get('user-agent'));
    const token = generateToken(user);
    res.json({ user, token });
  },

  // POST /api/auth/forgot-password
  forgotPassword(req, res) {
    const { email, phone } = req.body;
    let user = null;
    
    if (email) user = User.findByEmail(email);
    if (!user && phone) user = User.findByPhone(phone);
    
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email or phone number' });
    }

    const otp = User.generateOTP(user.id, 'reset');
    res.json({ 
      message: 'Reset code sent successfully',
      user_id: user.id 
    });
  },

  // POST /api/auth/reset-password
  resetPassword(req, res) {
    const { user_id, code, new_password } = req.body;
    if (!user_id || !code || !new_password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const isValid = User.verifyOTP(user_id, code, 'reset');
    if (!isValid) return res.status(401).json({ error: 'Invalid or expired reset code' });

    User.updatePassword(user_id, new_password);
    res.json({ message: 'Password reset successfully. You can now login.' });
  },

  // POST /api/auth/google-login
  async googleLogin(req, res) {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const { email, name, sub: google_id } = payload;

      let user = User.findByEmail(email);
      if (!user) {
        // Create user if not exists
        user = User.create({ 
          username: name.replace(/\s+/g, '').toLowerCase() + Math.floor(Math.random() * 1000),
          email, 
          password: Math.random().toString(36).slice(-12), // Random password for social login
          role: 'user' 
        });
        User.updateVerified(user.id, 1); // Google accounts are pre-verified
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
      }

      User.logLogin(user.id, req.ip, req.get('user-agent'));
      const token = generateToken(user);
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (err) {
      console.error('Google Auth Error:', err);
      res.status(401).json({ error: 'Google authentication failed' });
    }
  },

  // GET /api/auth/me — Get current user profile
  me(req, res) {
    res.json({ user: req.user });
  },
};

module.exports = authController;
