const energy = require('../services/energy.service');

const esp32Controller = {
  // POST /api/esp32/status — Full status update from ESP32
  status(req, res) {
    console.log(`\n📡 [ESP32 Status] from ${req.ip}:`, JSON.stringify(req.body, null, 2));
    energy.processESP32Status(req.body, req.ip);
    res.json({ success: true });
  },

  // POST /api/esp32/data — Sensor data update from ESP32
  data(req, res) {
    console.log(`\n📊 [ESP32 Data] from ${req.ip}:`, JSON.stringify(req.body, null, 2));
    energy.processESP32Data(req.body, req.ip);
    res.json({ success: true });
  },

  // GET /api/esp32/commands — ESP32 polls for pending commands
  commands(_req, res) {
    const commands = energy.drainCommands();
    res.json({ commands });
  },
};

module.exports = esp32Controller;
