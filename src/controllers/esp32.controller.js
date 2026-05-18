const energy = require('../services/energy.service');

const esp32Controller = {
  // POST /api/esp32/status — Full status update from ESP32
  status(req, res) {
    const deviceKey = req.headers['x-device-key'];
    if (deviceKey !== process.env.ESP32_DEVICE_KEY && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized device' });
    }
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    console.log(`\n📡 [ESP32 Status] from ${clientIp}:`, JSON.stringify(req.body, null, 2));
    energy.processESP32Status(req.body, clientIp);
    res.json({ success: true });
  },

  // POST /api/esp32/data — Sensor data update from ESP32
  data(req, res) {
    const deviceKey = req.headers['x-device-key'];
    if (deviceKey !== process.env.ESP32_DEVICE_KEY && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized device' });
    }
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    console.log(`\n📊 [ESP32 Data] from ${clientIp}:`, JSON.stringify(req.body, null, 2));
    energy.processESP32Data(req.body, clientIp);
    res.json({ success: true });
  },

  // GET /api/esp32/commands — ESP32 polls for pending commands
  commands(_req, res) {
    const commands = energy.drainCommands();
    res.json({ commands });
  },
};

module.exports = esp32Controller;
