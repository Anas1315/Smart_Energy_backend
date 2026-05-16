/**
 * EnergyService — holds all real-time ESP32 state in memory.
 * Migrated from the original server.js globals into a clean service.
 */

const COST_PER_UNIT = parseInt(process.env.COST_PER_UNIT) || 30;

// ========== STATE ==========
let esp32Data = {
  voltage: 0, current: 0, power: 0, ldrValue: 0,
  wapdaAvailable: false, isSunny: false, isDayTime: true,
  wapdaRelayState: false, heavyLoadState: false,
  wapdaAutoMode: true, heavyLoadAutoMode: true,
  currentHour: 12, lastUpdate: Date.now(),
  esp32Online: false, lastSeen: Date.now(),
  dayStart: 8, dayEnd: 18,
};

let eventHistory = [];
let alerts = [];
let commandQueue = [];
let userMode = 'HOME';
let lastDeviceIP = null; // Track which IP is our "real" ESP32

let dailyStats = {
  date: new Date().toDateString(),
  wapdaUsageHours: 0, loadOnHours: 0, solarSavingHours: 0,
  totalSwitches: 0, peakPower: 0, voltageSum: 0, voltageCount: 0,
  energyGenerated: 0, energyConsumed: 0,
  unitsConsumed: '0', unitsSaved: '0',
  costSaved: '0', costUsed: '0',
  lastWapdaOnTime: null, lastWapdaOffTime: null,
  lastLoadOnTime: null, lastLoadOffTime: null,
};

let hourlyData = Array(24).fill().map((_, i) => ({
  hour: i, voltage: 0, current: 0, power: 0, ldrValue: 0,
}));

let systemStatus = {
  status: 'normal', message: 'System Running Normally',
  color: 'green', icon: 'fa-check-circle',
};

// Socket.IO reference (set by server.js)
let io = null;

// ========== HELPERS ==========
function setIO(socketIO) { io = socketIO; }

function addEvent(eventType, eventMessage, eventDetails) {
  const event = {
    id: Date.now(), type: eventType,
    message: eventMessage, details: eventDetails,
    timestamp: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString(),
  };
  eventHistory.unshift(event);
  if (eventHistory.length > 100) eventHistory.pop();
  if (io) io.emit('new-event', event);
  return event;
}

function addAlert(alertType, alertMessage, alertPriority) {
  const alert = {
    id: Date.now(), type: alertType,
    message: alertMessage, priority: alertPriority,
    timestamp: new Date().toLocaleTimeString(),
    date: new Date().toLocaleDateString(),
    read: false,
  };
  alerts.unshift(alert);
  if (alerts.length > 50) alerts.pop();
  if (io) io.emit('new-alert', alert);
  return alert;
}

function updateDailyStats() {
  const today = new Date().toDateString();
  if (dailyStats.date !== today) {
    dailyStats = {
      date: today,
      wapdaUsageHours: 0, loadOnHours: 0, solarSavingHours: 0,
      totalSwitches: 0, peakPower: 0, voltageSum: 0, voltageCount: 0,
      energyGenerated: 0, energyConsumed: 0,
      unitsConsumed: '0', unitsSaved: '0',
      costSaved: '0', costUsed: '0',
      lastWapdaOnTime: null, lastWapdaOffTime: null,
      lastLoadOnTime: null, lastLoadOffTime: null,
    };
    hourlyData = Array(24).fill().map((_, i) => ({
      hour: i, voltage: 0, current: 0, power: 0, ldrValue: 0,
    }));
  }
  const unitsConsumedRaw = dailyStats.energyConsumed / 1000;
  const unitsSavedRaw = dailyStats.energyGenerated / 1000;
  dailyStats.unitsConsumed = unitsConsumedRaw.toFixed(2);
  dailyStats.unitsSaved = unitsSavedRaw.toFixed(2);
  dailyStats.costUsed = (unitsConsumedRaw * COST_PER_UNIT).toFixed(2);
  dailyStats.costSaved = (unitsSavedRaw * COST_PER_UNIT).toFixed(2);
  dailyStats.avgVoltage = dailyStats.voltageCount > 0 
    ? (dailyStats.voltageSum / dailyStats.voltageCount).toFixed(1) 
    : 0;
}

function updateSystemStatus() {
  const now = Date.now();
  const timeSinceLastSeen = (now - esp32Data.lastSeen) / 1000;
  esp32Data.esp32Online = timeSinceLastSeen < 60;

  if (!esp32Data.esp32Online) {
    systemStatus = { status: 'offline', message: 'ESP32 OFFLINE', color: 'red', icon: 'fa-wifi' };
    addAlert('danger', 'ESP32 is offline! No data received.', 'high');
  } else if (!esp32Data.wapdaAvailable && !esp32Data.isDayTime) {
    systemStatus = { status: 'no_power', message: 'NO POWER AVAILABLE', color: 'red', icon: 'fa-bolt' };
    addAlert('danger', 'No power source available! System may shut down.', 'high');
  } else if (esp32Data.wapdaAvailable && !esp32Data.isSunny && esp32Data.isDayTime) {
    systemStatus = { status: 'backup', message: 'RUNNING ON GRID BACKUP', color: 'orange', icon: 'fa-plug' };
  } else if (esp32Data.isSunny && esp32Data.isDayTime) {
    systemStatus = { status: 'solar', message: 'SOLAR POWER ACTIVE', color: 'green', icon: 'fa-sun' };
  } else if (esp32Data.wapdaAvailable) {
    systemStatus = { status: 'normal', message: 'SYSTEM NORMAL', color: 'green', icon: 'fa-check-circle' };
  } else {
    systemStatus = { status: 'warning', message: 'SYSTEM WARNING', color: 'orange', icon: 'fa-exclamation-triangle' };
  }
  if (io) io.emit('system-status', systemStatus);
}

// ========== EXPORTS ==========
module.exports = {
  setIO,
  addEvent,
  addAlert,
  updateDailyStats,
  updateSystemStatus,

  getESP32Data: () => esp32Data,
  setESP32Data: (data) => { esp32Data = data; },
  getEventHistory: () => eventHistory,
  getAlerts: () => alerts,
  getDailyStats: () => dailyStats,
  getHourlyData: () => hourlyData,
  getSystemStatus: () => systemStatus,
  getCommandQueue: () => commandQueue,
  getUserMode: () => userMode,

  setUserMode: (mode) => { userMode = mode; },
  setDailyStats: (stats) => { dailyStats = stats; },

  clearEvents: () => { eventHistory = []; alerts = []; },

  pushCommand: (cmd) => { commandQueue.push(cmd); },
  drainCommands: () => { const cmds = [...commandQueue]; commandQueue = []; return cmds; },

  processESP32Status: (body, reqIP) => {
    // No inversion needed - ESP32 sends High for Sunny
    const now = Date.now();
    let timeDeltaHours = (now - esp32Data.lastSeen) / (1000 * 3600);
    if (timeDeltaHours > 1 || timeDeltaHours < 0) timeDeltaHours = 5 / 3600;

    esp32Data.lastSeen = now;
    esp32Data.esp32Online = true;
    lastDeviceIP = reqIP; // The device sending Status is the "Master"

    // EMA Smoothing for noise reduction (alpha = 0.3)
    if (body.voltage !== undefined && body.voltage > 0) {
      body.voltage = esp32Data.voltage === 0 ? body.voltage : (esp32Data.voltage * 0.7 + body.voltage * 0.3);
    }
    if (body.current !== undefined && body.current > 0) {
      body.current = esp32Data.current === 0 ? body.current : (esp32Data.current * 0.7 + body.current * 0.3);
    }
    if (body.power !== undefined && body.power > 0) {
      body.power = esp32Data.power === 0 ? body.power : (esp32Data.power * 0.7 + body.power * 0.3);
    }

    // State change events
    if (body.wapdaRelayState !== undefined && esp32Data.wapdaRelayState !== body.wapdaRelayState) {
      addEvent('info', `WAPDA Relay Turned ${body.wapdaRelayState ? 'ON' : 'OFF'}`, 'Manual/Auto control');
      dailyStats.totalSwitches++;
    }
    if (body.heavyLoadState !== undefined && esp32Data.heavyLoadState !== body.heavyLoadState) {
      addEvent('warning', `Heavy Load Turned ${body.heavyLoadState ? 'ON' : 'OFF'}`, 'Load state changed');
      if (body.heavyLoadState) { dailyStats.lastLoadOnTime = new Date(); }
      else {
        dailyStats.lastLoadOffTime = new Date();
        if (dailyStats.lastLoadOnTime) {
          dailyStats.loadOnHours += (dailyStats.lastLoadOffTime - dailyStats.lastLoadOnTime) / (1000 * 3600);
        }
      }
    }
    if (body.wapdaAvailable !== undefined && esp32Data.wapdaAvailable !== body.wapdaAvailable) {
      if (body.wapdaAvailable) {
        addEvent('success', 'Grid Power Restored', 'WAPDA is now available');
        addAlert('success', 'Grid power restored! System back to normal.', 'medium');
        dailyStats.lastWapdaOnTime = new Date();
      } else {
        addEvent('danger', 'Grid Power Outage', 'WAPDA is unavailable');
        addAlert('danger', 'Grid power outage! Running on solar/battery.', 'high');
        dailyStats.lastWapdaOffTime = new Date();
        if (dailyStats.lastWapdaOnTime) {
          dailyStats.wapdaUsageHours += (dailyStats.lastWapdaOffTime - dailyStats.lastWapdaOnTime) / (1000 * 3600);
        }
      }
    }
    if (body.isSunny !== undefined && esp32Data.isSunny !== body.isSunny && (body.isDayTime ?? esp32Data.isDayTime)) {
      if (body.isSunny) {
        addEvent('success', 'Solar Power Available', 'Bright sunlight detected');
        addAlert('success', 'Solar power is now available! Saving energy.', 'low');
      } else {
        addEvent('warning', 'Solar Power Reduced', 'Cloudy/Dark conditions');
      }
    }

    // Update data
    esp32Data = { ...esp32Data, ...body, lastUpdate: now };

    // Hourly data
    const hour = new Date().getHours();
    hourlyData[hour] = { hour, voltage: esp32Data.voltage, current: esp32Data.current, power: esp32Data.power, ldrValue: esp32Data.ldrValue };

    if (esp32Data.power > dailyStats.peakPower) dailyStats.peakPower = esp32Data.power;
    if (esp32Data.voltage > 0) {
      dailyStats.voltageSum += esp32Data.voltage;
      dailyStats.voltageCount++;
    }
    if (esp32Data.power > 0) {
      dailyStats.energyConsumed += esp32Data.power * timeDeltaHours;
      dailyStats.energyGenerated += (esp32Data.isSunny ? esp32Data.power * 0.7 : 0) * timeDeltaHours;
    }

    updateDailyStats();
    updateSystemStatus();

    if (io) {
      io.emit('data-update', esp32Data);
      io.emit('daily-stats', dailyStats);
      io.emit('hourly-data', hourlyData);
      io.emit('last-seen', { lastSeen: esp32Data.lastSeen, online: esp32Data.esp32Online });
    }
  },

  processESP32Data: (body, reqIP) => {
    // Ignore Data updates from other IPs if we have a Master device
    if (lastDeviceIP && reqIP !== lastDeviceIP) {
      // Optional: console.log(`⚠️  Ignoring Data update from secondary IP: ${reqIP}`);
      return;
    }

    const now = Date.now();
    let timeDeltaHours = (now - esp32Data.lastSeen) / (1000 * 3600);
    if (timeDeltaHours > 1 || timeDeltaHours < 0) timeDeltaHours = 5 / 3600;

    esp32Data = { ...esp32Data, ...body, lastUpdate: now };
    esp32Data.lastSeen = now;
    esp32Data.esp32Online = true;

    const hour = new Date().getHours();
    hourlyData[hour] = { hour, voltage: body.voltage || 0, current: body.current || 0, power: body.power || 0, ldrValue: body.ldrValue || 0 };

    if (body.power > dailyStats.peakPower) dailyStats.peakPower = body.power;
    if (body.voltage > 0) {
      dailyStats.voltageSum += body.voltage;
      dailyStats.voltageCount++;
    }
    if (body.power > 0) {
      dailyStats.energyConsumed += (body.power || 0) * timeDeltaHours;
      dailyStats.energyGenerated += (esp32Data.isSunny ? (body.power || 0) * 0.7 : 0) * timeDeltaHours;
    }

    updateDailyStats();
    updateSystemStatus();

    if (io) {
      io.emit('data-update', esp32Data);
      io.emit('daily-stats', dailyStats);
      io.emit('hourly-data', hourlyData);
      io.emit('last-seen', { lastSeen: esp32Data.lastSeen, online: esp32Data.esp32Online });
    }
  },

  // Periodic offline check
  startOfflineDetection: () => {
    setInterval(() => {
      const now = Date.now();
      if (now - esp32Data.lastSeen > 60000 && esp32Data.esp32Online) {
        updateSystemStatus();
      }
    }, 10000);
  },
};
