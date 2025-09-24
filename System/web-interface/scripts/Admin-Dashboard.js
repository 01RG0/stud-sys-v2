(function(){
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws = null;
  let startTime = Date.now();
  let reconnectTimer = null;

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
      
      // Reconnect after 3 seconds
      reconnectTimer = setTimeout(() => {
        setupWebSocket();
      }, 3000);
    });
    
    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      updateConnectionStatus(false);
    });
  }

  function handleWebSocketMessage(data) {
    switch (data.type) {
      case 'server_stats':
        updateSystemInfo(data.stats);
        break;
      case 'log_entry':
        addLogEntry(data.level, data.message, data.timestamp);
        break;
      case 'device_connected':
        addLogEntry('info', `Device connected: ${data.name} (${data.role})`);
        break;
      case 'device_disconnected':
        addLogEntry('warning', `Device disconnected: ${data.name}`);
        break;
      case 'student_registered':
        addLogEntry('success', `Student registered: ${data.record.student_name} by ${data.record.device_name}`);
        break;
            case 'validation_result':
              addLogEntry('info', `Exit validation: ${data.result.status} for student ${data.result.student_id} (${data.result.student_name})`);
              break;
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

    // Quick action buttons
    const exportDataBtn = document.getElementById('export-data');
    if (exportDataBtn) {
      exportDataBtn.addEventListener('click', () => {
        window.open('/api/export-data', '_blank');
      });
    }

    const refreshBtn = document.getElementById('refresh-system');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        location.reload();
      });
    }
  }

  function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.className = connected ? 'status-online' : 'status-offline';
      statusElement.innerHTML = `
        <i class="fas fa-circle"></i>
        <span>${connected ? 'Connected' : 'Disconnected'}</span>
      `;
    }
    
    // Also update the system status WebSocket indicator
    const wsStatusIndicator = document.querySelector('.status-item:nth-child(2) .status-indicator');
    if (wsStatusIndicator) {
      wsStatusIndicator.className = connected ? 'status-indicator online' : 'status-indicator offline';
      wsStatusIndicator.textContent = connected ? 'Online' : 'Offline';
    }
  }

  function updateStats() {
    // Update basic stats
    document.getElementById('total-students').textContent = '54'; // From server
    document.getElementById('active-scanners').textContent = '0';
    document.getElementById('today-registrations').textContent = '0';
    document.getElementById('system-errors').textContent = '0';
  }

  function updateSystemInfo(stats) {
    if (stats.totalStudents) {
      document.getElementById('total-students').textContent = stats.totalStudents;
    }
    if (stats.onlineDevices) {
      document.getElementById('active-scanners').textContent = stats.onlineDevices;
    }
    if (stats.totalRegistrations) {
      document.getElementById('today-registrations').textContent = stats.totalRegistrations;
    }
    if (stats.totalValidations) {
      document.getElementById('system-errors').textContent = stats.totalValidations;
    }
    if (stats.serverUptime) {
      updateUptimeDisplay(stats.serverUptime);
    }
  }
  
  function updateUptimeDisplay(uptimeMs) {
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    document.getElementById('system-uptime').textContent = `${hours}H ${minutes}M`;
  }

  function updateDeviceStatus(data) {
    // Update device status indicators
    const statusItems = document.querySelectorAll('.status-item');
    statusItems.forEach(item => {
      const info = item.querySelector('.status-info span');
      if (info) {
        if (info.textContent.includes('WebSocket')) {
          const indicator = item.querySelector('.status-indicator');
          if (indicator) {
            indicator.className = 'status-indicator online';
            indicator.textContent = 'Online';
          }
        }
      }
    });
  }

  function updateScanCount(count) {
    document.getElementById('today-registrations').textContent = count;
  }

  function startUptimeCounter() {
    setInterval(() => {
      const uptime = Date.now() - startTime;
      const hours = Math.floor(uptime / (1000 * 60 * 60));
      const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
      document.getElementById('system-uptime').textContent = `${hours}h ${minutes}m`;
    }, 1000);
  }

  function addLogEntry(level, message, timestamp = null) {
    const container = document.getElementById('logs-container');
    if (!container) return;

    const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    logEntry.innerHTML = `
      <span class="log-timestamp">[${time}]</span>
      <span>${message}</span>
    `;
    
    container.appendChild(logEntry);
    
    // Keep only last 100 entries
    const entries = container.querySelectorAll('.log-entry');
    if (entries.length > 100) {
      entries[0].remove();
    }
    
    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  function filterLogs() {
    const filter = document.getElementById('log-level-filter').value;
    const entries = document.querySelectorAll('.log-entry');
    
    entries.forEach(entry => {
      if (filter === 'all' || entry.classList.contains(`log-${filter}`)) {
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
      const message = entry.textContent.replace(timestamp, '').trim();
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

  // Initialize when page loads
  window.addEventListener('load', init);
})();