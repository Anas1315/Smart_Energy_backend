const express = require('express');
const router = express.Router();
const esp32 = require('../controllers/esp32.controller');

// ESP32 endpoints — no JWT auth (ESP32 doesn't have tokens)
router.post('/status', esp32.status);
router.post('/data', esp32.data);
router.get('/commands', esp32.commands);

module.exports = router;
