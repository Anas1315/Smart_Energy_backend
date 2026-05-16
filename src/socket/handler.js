const energy = require('../services/energy.service');

/**
 * Socket.IO connection handler — sends initial state and
 * mirrors the original server.js socket behavior exactly.
 */
function setupSocketHandlers(io) {
  energy.setIO(io);

  io.on('connection', (socket) => {
    console.log('👤 Client connected');

    // Send initial state to newly connected client
    socket.emit('data-update', energy.getESP32Data());
    socket.emit('events-list', energy.getEventHistory());
    socket.emit('alerts-list', energy.getAlerts());
    socket.emit('daily-stats', energy.getDailyStats());
    socket.emit('system-status', energy.getSystemStatus());
    socket.emit('last-seen', {
      lastSeen: energy.getESP32Data().lastSeen,
      online: energy.getESP32Data().esp32Online,
    });
    socket.emit('user-mode', { mode: energy.getUserMode() });
    socket.emit('hourly-data', energy.getHourlyData());

    socket.on('disconnect', () => {
      console.log('👤 Client disconnected');
    });
  });
}

module.exports = { setupSocketHandlers };
