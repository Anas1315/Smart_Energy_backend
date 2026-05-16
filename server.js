require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

// Initialize database (creates tables on first run)
require('./src/config/database');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());
// ========== SERVE FRONTEND ==========
const frontendPath = path.join(__dirname, '..', 'smart-energy-frontend', 'dist');
app.use(express.static(frontendPath));

// ========== ROUTES ==========
const authRoutes      = require('./src/routes/auth.routes');
const adminRoutes     = require('./src/routes/admin.routes');
const esp32Routes     = require('./src/routes/esp32.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const dashController  = require('./src/controllers/dashboard.controller');

// Set socket.io reference for dashboard controller
dashController.setIO(io);

app.use('/api/auth',  authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/esp32', esp32Routes);
app.use('/api',       dashboardRoutes);

// Catch-all route to serve React's index.html (SPA support)
app.get('*', (req, res) => {
  // If request is for an API, don't serve index.html
  if (req.url.startsWith('/api')) return res.status(404).json({ error: 'Not Found' });
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ========== SOCKET.IO ==========
const { setupSocketHandlers } = require('./src/socket/handler');
setupSocketHandlers(io);

// ========== OFFLINE DETECTION ==========
const energy = require('./src/services/energy.service');
energy.startOfflineDetection();

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   SMART ENERGY CONTROLLER v4.0 — BACKEND WITH AUTH        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 API Server:    http://localhost:${PORT}                  ║`);
  console.log(`║  📡 ESP32 API:     http://localhost:${PORT}/api/esp32        ║`);
  console.log(`║  🔐 Auth API:      http://localhost:${PORT}/api/auth         ║`);
  console.log(`║  👑 Admin API:     http://localhost:${PORT}/api/admin        ║`);
  console.log('║  ✨ Features:                                               ║');
  console.log('║     - JWT Authentication (signup/login)                     ║');
  console.log('║     - Role-Based Access (master_admin/admin/user)           ║');
  console.log('║     - SQLite Database (zero config)                         ║');
  console.log('║     - Real-time Socket.IO                                   ║');
  console.log('║     - ESP32 Integration                                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
});
