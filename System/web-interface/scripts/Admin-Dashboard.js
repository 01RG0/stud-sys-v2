(function(){
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws = null;
  let startTime = Date.now();
  let reconnectTimer = null;
  let devicesUpdateInterval = null;

  function init() {
    setupWebSocket();
    setupControls();
    updateStats();
    startUptimeCounter();
  }

  function setupWebSocket() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.addEventListener('open', () => {
      console.log('Admin WebSocket connected');
      updateConnectionStatus(true);
      addLogEntry('success', 'Connected to server');
      
      // Register as admin dashboard
      ws.send(JSON.stringify({ 
        type: 'register_device',
        role: 'admin_dashboard',
        name: 'Admin Dashboard'
      }));
      
      // Request system info
      ws.send(JSON.stringify({ type: 'request_stats' }));
      
      // Request stats every 5 seconds
      setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'request_stats' }));
        }
      }, 5000);
    });
    
    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.addEventListener('close', () => {
      console.log('Admin WebSocket disconnected');
      updateConnectionStatus(false);
      addLogEntry('warning', 'Disconnected from server');
      
      // Attempt to reconnect after 3 seconds
      reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect...');
        setupWebSocket();
      }, 3000);
    });
    
    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      addLogEntry('error', 'WebSocket connection error');
    });
  }

  function handleWebSocketMessage(data) {
    switch (data.type) {
      case 'server_stats':
        updateSystemInfo(data);
        break;
      case 'log_entry':
        addLogEntry(data.level, data.message);
        break;
      case 'device_connected':
        addLogEntry('success', `Device connected: ${data.name} (${data.role})`);
        loadLiveDevices(); // Refresh devices list
        break;
      case 'device_disconnected':
        addLogEntry('warning', `Device disconnected: ${data.name} (${data.role})`);
        loadLiveDevices(); // Refresh devices list
        break;
      case 'student_registered':
        addLogEntry('info', `Student registered: ${data.studentName}`);
        break;
      case 'validation_result':
        addLogEntry('info', `Validation: ${data.studentName} - ${data.result}`);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  function setupControls() {
    // Clear logs button
    const clearBtn = document.getElementById('clear-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        document.getElementById('logs-container').innerHTML = '';
        addLogEntry('info', 'Logs cleared');
      });
    }

    // Export logs button
    const exportBtn = document.getElementById('export-logs');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportLogs);
    }

    // Log level filter
    const filterSelect = document.getElementById('log-level-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', filterLogs);
    }

    // Setup live devices functionality
    setupLiveDevices();
  }

  function updateSystemInfo(data) {
    // Update overview cards
    document.getElementById('total-students').querySelector('.card-number').textContent = data.totalStudents || 0;
    document.getElementById('active-scanners').querySelector('.card-number').textContent = data.activeScanners || 0;
    document.getElementById('todays-registrations').querySelector('.card-number').textContent = data.todayRegistrations || 0;
    document.getElementById('system-errors').querySelector('.card-number').textContent = data.systemErrors || 0;
    
    // Update system status
    document.getElementById('database-status').textContent = 'Connected';
    updateUptimeDisplay(data.uptime);
  }

  function updateUptimeDisplay(uptimeMs) {
    const uptimeElement = document.getElementById('system-uptime');
    if (!uptimeElement) return;
    
    const uptime = uptimeMs || (Date.now() - startTime);
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    uptimeElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.className = connected ? 'status-pill connected' : 'status-pill disconnected';
      statusElement.querySelector('.status-text').textContent = connected ? 'Connected' : 'Disconnected';
    }
  }

  function addLogEntry(level, message) {
    const logsContainer = document.getElementById('logs-container');
    if (!logsContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    
    logEntry.innerHTML = `
      <span class="log-timestamp">[${timestamp}]</span>
      <span class="log-message">${message}</span>
    `;
    
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    // Keep only last 100 log entries
    const entries = logsContainer.querySelectorAll('.log-entry');
    if (entries.length > 100) {
      entries[0].remove();
    }
  }

  function filterLogs(level) {
    const entries = document.querySelectorAll('.log-entry');
    entries.forEach(entry => {
      if (level === 'all' || entry.classList.contains(`log-${level}`)) {
        entry.style.display = 'block';
      } else {
        entry.style.display = 'none';
      }
    });
  }

  function exportLogs() {
    const entries = document.querySelectorAll('.log-entry');
    let logText = 'Student Lab System - Log Export\n';
    logText += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    entries.forEach(entry => {
      const timestamp = entry.querySelector('.log-timestamp').textContent;
      const message = entry.querySelector('.log-message').textContent;
      logText += `${timestamp} ${message}\n`;
    });
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startUptimeCounter() {
    setInterval(() => {
      updateUptimeDisplay();
    }, 60000); // Update every minute
  }

  // Live Devices Functionality
  function setupLiveDevices() {
    const refreshBtn = document.getElementById('refresh-devices');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', loadLiveDevices);
    }
    
    // Load devices initially and set up auto-refresh
    loadLiveDevices();
    devicesUpdateInterval = setInterval(loadLiveDevices, 5000); // Update every 5 seconds
  }

  async function loadLiveDevices() {
    try {
      const response = await fetch('/api/live-devices');
      const data = await response.json();
      updateDevicesList(data);
    } catch (error) {
      console.error('Failed to load live devices:', error);
      updateDevicesList({ devices: [], totalDevices: 0, onlineDevices: 0 });
    }
  }

  function updateDevicesList(data) {
    const devicesList = document.getElementById('devices-list');
    const devicesCount = document.getElementById('devices-count');
    
    if (!devicesList || !devicesCount) return;
    
    // Update count
    devicesCount.textContent = `${data.onlineDevices} of ${data.totalDevices} devices online`;
    
    // Clear existing devices
    devicesList.innerHTML = '';
    
    if (data.devices.length === 0) {
      devicesList.innerHTML = `
        <div class="device-placeholder">
          <i class="fas fa-desktop"></i>
          <span>No devices connected</span>
        </div>
      `;
      return;
    }
    
    // Add each device
    data.devices.forEach(device => {
      const deviceElement = createDeviceElement(device);
      devicesList.appendChild(deviceElement);
    });
  }

  function createDeviceElement(device) {
    const div = document.createElement('div');
    div.className = `device-item ${device.status}`;
    
    const roleIcon = getRoleIcon(device.role);
    const uptime = formatUptime(device.uptime);
    
    div.innerHTML = `
      <div class="device-info">
        <div class="device-icon ${device.role}">
          <i class="fas fa-${roleIcon}"></i>
        </div>
        <div class="device-details">
          <h4>${device.name}</h4>
          <p>${device.role} • ${uptime}</p>
        </div>
      </div>
      <div class="device-status ${device.status}">
        <div class="status-dot"></div>
        <span>${device.status.toUpperCase()}</span>
      </div>
    `;
    
    return div;
  }

  function getRoleIcon(role) {
    switch (role) {
      case 'first_scan': return 'qrcode';
      case 'last_scan': return 'graduation-cap';
      case 'admin_dashboard': return 'tachometer-alt';
      default: return 'desktop';
    }
  }

  function formatUptime(ms) {
    if (!ms) return 'Just connected';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Initialize when page loads
  window.addEventListener('load', init);
})();