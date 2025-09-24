(function(){
  // WebSocket connection for real-time logs
  // Prefer same-origin WS endpoint when server attaches WS to HTTP/HTTPS
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws = null;
  let refreshInterval = null;
  let reconnectTimer = null;
  let startTime = Date.now();
  let totalScans = 0;
  let logsPaused = false;
  let maxLogEntries = 1000;
  
  // Statistics tracking
  let stats = {
    totalDevices: 0,
    onlineDevices: 0,
    totalScans: 0,
    systemUptime: 0
  };

  // Initialize dashboard
  function init() {
    setupWebSocket();
    setupLogControls();
    startAutoRefresh();
    startUptimeCounter();
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAutoRefresh();
      } else {
        startAutoRefresh();
      }
    });
  }

  // WebSocket setup for real-time logs
  function setupWebSocket() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.addEventListener('open', () => {
      console.log('Admin WebSocket connected');
      addLogEntry('success', 'Admin dashboard connected to live logs');
      
      // Register as admin dashboard
      ws.send(JSON.stringify({ 
        type: 'register_device', 
        role: 'admin_dashboard', 
        name: 'Admin-Dashboard' 
      }));
      
      // Send heartbeat every 10 seconds to stay online
      setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 10000);
    });
    
    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.addEventListener('close', () => {
      console.log('Admin WebSocket disconnected, attempting reconnect in 5s...');
      addLogEntry('warning', 'Lost connection to server, reconnecting...');
      reconnectTimer = setTimeout(setupWebSocket, 5000);
    });
    
    ws.addEventListener('error', (error) => {
      console.error('Admin WebSocket error:', error);
      addLogEntry('error', 'WebSocket connection error');
      try { ws.close(); } catch(e) {}
    });
  }

  // Handle WebSocket messages for live updates
  function handleWebSocketMessage(data) {
    switch(data.type) {
      case 'system_log':
        if (!logsPaused) {
          addLogEntry(data.level || 'info', data.message, data.timestamp);
        }
        break;
        
      case 'device_connected':
        addLogEntry('success', `Device connected: ${data.name} (${data.role})`);
        updateStats();
        break;
        
      case 'device_disconnected':
        addLogEntry('warning', `Device disconnected: ${data.name} (${data.role})`);
        updateStats();
        break;
        
      case 'student_registered':
        totalScans++;
        addLogEntry('info', `Student registered: ${data.record.student_name} by ${data.record.device_name}`);
        updateStats();
        break;
        
      case 'validation_result':
        totalScans++;
        const status = data.result.status === 'PASSED' ? 'success' : 'warning';
        addLogEntry(status, `Exit validation: ${data.result.status} for student ${data.result.student_id}`);
        updateStats();
        break;
        
      case 'server_stats':
        if (data.stats) {
          stats = { ...stats, ...data.stats };
          updateStatsDisplay();
        }
        break;
    }
  }

  // Add log entry to the live log display
  function addLogEntry(level, message, timestamp = null) {
    const container = document.getElementById('logs-container');
    if (!container) return;
    
    // Check log level filter
    const levelFilter = document.getElementById('log-level').value;
    if (levelFilter !== 'all' && levelFilter !== level) {
      return;
    }
    
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    
    const time = timestamp ? new Date(timestamp) : new Date();
    const timeStr = time.toLocaleTimeString();
    
    entry.innerHTML = `
      <span class="log-timestamp">[${timeStr}]</span> ${message}
    `;
    
    container.appendChild(entry);
    
    // Auto-scroll if enabled
    const autoScroll = document.getElementById('auto-scroll');
    if (autoScroll && autoScroll.checked) {
      container.scrollTop = container.scrollHeight;
    }
    
    // Limit log entries to prevent memory issues
    const entries = container.querySelectorAll('.log-entry');
    if (entries.length > maxLogEntries) {
      entries[0].remove();
    }
  }

  // Setup log control buttons
  function setupLogControls() {
    // Clear logs button
    document.getElementById('clear-logs').onclick = () => {
      const container = document.getElementById('logs-container');
      container.innerHTML = '<div class="log-entry log-info"><span class="log-timestamp">[System]</span> Logs cleared</div>';
    };
    
    // Pause/Resume logs button
    const pauseBtn = document.getElementById('pause-logs');
    pauseBtn.onclick = () => {
      logsPaused = !logsPaused;
      pauseBtn.textContent = logsPaused ? '▶️ Resume' : '⏸️ Pause';
      pauseBtn.style.background = logsPaused ? '#28a745' : '#ffc107';
      
      addLogEntry('info', logsPaused ? 'Live logs paused' : 'Live logs resumed');
    };
    
    // Download logs button
    document.getElementById('download-logs').onclick = downloadLogs;
    
    // Log level filter
    document.getElementById('log-level').onchange = () => {
      addLogEntry('info', `Log level filter changed to: ${document.getElementById('log-level').value}`);
    };
  }

  // Download logs as text file
  function downloadLogs() {
    const container = document.getElementById('logs-container');
    const entries = container.querySelectorAll('.log-entry');
    
    let logText = `Student Lab System - Admin Logs\nGenerated: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n`;
    
    entries.forEach(entry => {
      const timestamp = entry.querySelector('.log-timestamp').textContent;
      const message = entry.textContent.replace(timestamp, '').trim();
      logText += `${timestamp} ${message}\n`;
    });
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    addLogEntry('success', 'Logs downloaded successfully');
  }

  // Load devices data
  async function loadDevices() {
    try {
      const res = await fetch('/api/devices');
      const devices = await res.json();
      const tbody = document.querySelector('#devices tbody');
      
      stats.totalDevices = devices.length;
      stats.onlineDevices = devices.filter(d => d.lastSeen && (Date.now() - d.lastSeen < 30000)).length;
      
      if (devices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">No devices connected</td></tr>';
        return;
      }
      
      tbody.innerHTML = devices.map(d => {
        const lastSeenText = d.lastSeen 
          ? new Date(d.lastSeen).toLocaleTimeString()
          : 'Never';
        
        // More lenient online check for admin dashboards (45 seconds instead of 30)
        const onlineThreshold = d.role === 'admin_dashboard' ? 45000 : 30000;
        const isOnline = d.lastSeen && (Date.now() - d.lastSeen < onlineThreshold);
        const statusColor = isOnline ? '#28a745' : '#6c757d';
        const statusText = isOnline ? '🟢 Online' : '🔴 Offline';
        
        return `
          <tr>
            <td><strong>${d.name || 'Unknown'}</strong></td>
            <td><span style="padding: 2px 6px; background: #e9ecef; border-radius: 3px; font-size: 12px;">${d.role || 'Unknown'}</span></td>
            <td>
              <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span><br>
              <small style="color: #6c757d;">Last seen: ${lastSeenText}</small>
            </td>
          </tr>
        `;
      }).join('');
      
    } catch (error) {
      console.error('Failed to load devices:', error);
      addLogEntry('error', 'Failed to load devices data');
      const tbody = document.querySelector('#devices tbody');
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #dc3545;">Error loading devices</td></tr>';
    }
  }

  // Update statistics display
  function updateStatsDisplay() {
    document.getElementById('total-devices').textContent = stats.totalDevices;
    document.getElementById('online-devices').textContent = stats.onlineDevices;
    document.getElementById('total-scans').textContent = stats.totalScans || totalScans;
    
    // Update page title
    document.title = `Admin Dashboard (${stats.onlineDevices}/${stats.totalDevices} online)`;
  }

  // Update stats (called when devices change)
  function updateStats() {
    setTimeout(loadDevices, 500); // Small delay to allow server to update
  }

  // Start uptime counter
  function startUptimeCounter() {
    setInterval(() => {
      const uptime = Math.floor((Date.now() - startTime) / 1000);
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = uptime % 60;
      
      let uptimeStr;
      if (hours > 0) {
        uptimeStr = `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        uptimeStr = `${minutes}m ${seconds}s`;
      } else {
        uptimeStr = `${seconds}s`;
      }
      
      document.getElementById('system-uptime').textContent = uptimeStr;
    }, 1000);
  }

  // Auto refresh functions
  function startAutoRefresh() {
    // Initial load
    loadDevices();
    updateStatsDisplay();
    
    // Add initial system log
    if (!refreshInterval) {
      addLogEntry('success', 'Admin dashboard initialized');
    }
    
    // Refresh every 3 seconds for more responsive status updates
    refreshInterval = setInterval(() => {
      loadDevices();
      updateStatsDisplay();
    }, 3000);
  }
  
  function stopAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  // Request server stats periodically
  function requestServerStats() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'request_stats' }));
    }
  }

  // Start when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Request server stats every 10 seconds
  setInterval(requestServerStats, 10000);

  // Export for manual use
  window.AdminDashboard = {
    addLogEntry,
    loadDevices,
    updateStats,
    startAutoRefresh,
    stopAutoRefresh,
    downloadLogs,
    getStats: () => stats
  };
})();