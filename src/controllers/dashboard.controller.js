const energy = require('../services/energy.service');

let io = null;
function setIO(socketIO) { io = socketIO; }

const dashboardController = {
  setIO,

  status(_req, res) { res.json(energy.getESP32Data()); },
  events(_req, res) { res.json(energy.getEventHistory()); },
  alerts(_req, res) { res.json(energy.getAlerts()); },
  dailyStats(_req, res) { res.json(energy.getDailyStats()); },
  systemStatus(_req, res) { res.json(energy.getSystemStatus()); },
  lastSeen(_req, res) {
    const d = energy.getESP32Data();
    res.json({ lastSeen: d.lastSeen, online: d.esp32Online });
  },
  userMode(_req, res) { res.json({ mode: energy.getUserMode() }); },
  hourlyData(_req, res) { res.json(energy.getHourlyData()); },
  history(_req, res) { res.json(energy.getHourlyData()); },

  // POST /api/command
  sendCommand(req, res) {
    const { type, value } = req.body;
    energy.pushCommand({ type, value });
    console.log(`\n🌐 [WEB] Command sent: ${type} = ${value}`);
    energy.addEvent('info', `Command: ${type} = ${value ? 'ON' : 'OFF'}`, 'User initiated');

    if (type === 'USER_MODE') {
      const modes = { 1: 'HOME', 2: 'SAVING', 3: 'PERFORMANCE' };
      const mode = modes[value] || 'HOME';
      energy.setUserMode(mode);
      energy.addEvent('info', `Mode changed to ${mode}`, 'System behavior updated');
      energy.addAlert('info', `System mode changed to ${mode}`, 'low');
      if (mode === 'SAVING') {
        energy.pushCommand({ type: 'WAPDA_MODE', value: 0 });
        energy.pushCommand({ type: 'HEAVY_LOAD_MODE', value: 1 });
      } else if (mode === 'PERFORMANCE') {
        energy.pushCommand({ type: 'WAPDA_MODE', value: 0 });
        energy.pushCommand({ type: 'HEAVY_LOAD_MODE', value: 0 });
      } else {
        energy.pushCommand({ type: 'WAPDA_MODE', value: 1 });
        energy.pushCommand({ type: 'HEAVY_LOAD_MODE', value: 1 });
      }
    }

    if (io) io.emit('command-sent', { type, value });
    res.json({ success: true });
  },

  // DELETE /api/clear-events
  clearEvents(_req, res) {
    energy.clearEvents();
    res.json({ success: true });
  },

  health(_req, res) {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  },
};

module.exports = dashboardController;
