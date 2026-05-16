const express = require('express');
const router = express.Router();
const dash = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// All dashboard routes require authentication
router.use(authenticate);

router.get('/status', dash.status);
router.get('/events', dash.events);
router.get('/alerts', dash.alerts);
router.get('/daily-stats', dash.dailyStats);
router.get('/system-status', dash.systemStatus);
router.get('/last-seen', dash.lastSeen);
router.get('/user-mode', dash.userMode);
router.get('/hourly-data', dash.hourlyData);
router.get('/history', dash.history);
router.post('/command', dash.sendCommand);
router.delete('/clear-events', roleCheck('admin', 'master_admin'), dash.clearEvents);
router.get('/health', dash.health);

module.exports = router;
