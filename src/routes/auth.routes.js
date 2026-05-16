const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/setup-status', auth.setupStatus);
router.post('/setup', auth.setup);
router.post('/signup', auth.signup);
router.post('/login', auth.login);

// Protected routes
router.get('/me', authenticate, auth.me);

module.exports = router;
