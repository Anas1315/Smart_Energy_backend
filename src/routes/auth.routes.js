const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/setup-status', auth.setupStatus);
router.post('/setup', auth.setup);
router.post('/signup', auth.signup);
router.post('/login', auth.login);
router.post('/google-login', auth.googleLogin);
router.post('/verify-2fa', auth.verify2FA);
router.post('/forgot-password', auth.forgotPassword);
router.post('/reset-password', auth.resetPassword);

// Protected routes
router.get('/me', authenticate, auth.me);

module.exports = router;
