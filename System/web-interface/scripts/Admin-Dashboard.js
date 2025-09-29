(function(){
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws = null;
  let startTime = Date.now();
  let reconnectTimer = null;
  let devicesUpdateInterval = null;
  let connectionAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectDelay = 3000;
  let heartbeatInterval = null;
  let networkScanInterval = null;
  let lastHeartbeatResponse = Date.now();
  let serverInfo = null;

  function init() {
    setupWebSocket();
    setupControls();
    updateStats();
    startUptimeCounter();
    fetchInitialStats();
    setupReconnectHandlers();
    setupPermanentReconnectBar();
  }

  function setupWebSocket() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.addEventListener('open', () => {
      console.log('Admin WebSocket connected');
      connectionAttempts = 0;
      updateConnectionStatus(true);
      addLogEntry('success', 'Connected to server');
      hideReconnectOverlay(); // Hide reconnect overlay when connected
      updatePermanentReconnectStatus('connected', 'Connected to server');
      
      // Register as admin dashboard with reconnection info
      ws.send(JSON.stringify({ 
        type: 'register_device', 
        role: 'admin_dashboard', 
        name: 'Admin Dashboard',
        reconnectionAttempts: connectionAttempts,
        lastDisconnect: lastHeartbeatResponse
      }));
      
      // Request system info
      ws.send(JSON.stringify({ type: 'request_stats' }));
      
      // Start heartbeat system
      startHeartbeat();
      
      // Start network scanning
      startNetworkScanning();
      
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
      updatePermanentReconnectStatus('disconnected', 'Disconnected from server');
      
      // Clear heartbeat interval
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      
      // Clear network scan interval
      if (networkScanInterval) {
        clearInterval(networkScanInterval);
        networkScanInterval = null;
      }
      
      // Attempt reconnection with exponential backoff
      attemptReconnection();
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
      case 'heartbeat_response':
        lastHeartbeatResponse = Date.now();
        console.log('Heartbeat response received from server');
        break;
      case 'reconnection_confirmed':
        console.log('Reconnection confirmed by server:', data.deviceInfo);
        addLogEntry('success', `Reconnected to server (attempt ${data.deviceInfo.reconnectionCount})`);
        break;
      case 'device_discovery':
        serverInfo = data.serverInfo;
        console.log('Device discovery received:', data);
        addLogEntry('info', `Network scan: ${data.connectedDevices.length} devices found`);
        break;
      case 'network_scan_response':
        console.log('Network scan response:', data);
        updateNetworkStatus(data.networkStatus);
        break;
      case 'device_timeout':
        addLogEntry('warning', `Device timeout: ${data.name} (${data.role})`);
        break;
      case 'device_reconnected':
        addLogEntry('success', `Device reconnected: ${data.name} (${data.role})`);
        break;
      case 'network_status_change':
        addLogEntry(data.isOnline ? 'success' : 'warning', 
          `Network status: ${data.isOnline ? 'Online' : 'Offline'} (${data.onlineDevices} devices)`);
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
    
    // Setup exit table download
    setupExitTableDownload();

    // Setup Excel import functionality
    setupExcelImport();
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

  // Fetch initial stats from server
  async function fetchInitialStats() {
    try {
      // Fetch today's registrations
      const registrationsResponse = await fetch('/api/exit-validator-data');
      const registrationsData = await registrationsResponse.json();
      
      // Fetch all students
      const studentsResponse = await fetch('/api/student-cache');
      const studentsData = await studentsResponse.json();
      
      // Create initial stats object
      const initialStats = {
        totalStudents: studentsData.students ? Object.keys(studentsData.students).length : 0,
        activeScanners: 0, // Will be updated by WebSocket
        todayRegistrations: registrationsData.totalStudents || 0,
        systemErrors: 0, // Will be updated by WebSocket
        serverUptime: Date.now() - startTime
      };
      
      // Update the display with initial stats
      updateSystemInfo(initialStats);
      
    } catch (error) {
      console.error('Failed to fetch initial stats:', error);
      // Keep default values (0) if fetch fails
    }
  }

  // Enhanced reconnection logic
  function attemptReconnection() {
    if (connectionAttempts >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached, stopping reconnection');
      addLogEntry('error', 'Max reconnection attempts reached. Please use manual reconnect.');
      // Removed popup - just show log entry
      return;
    }
    
    connectionAttempts++;
    const delay = reconnectDelay * Math.pow(2, connectionAttempts - 1); // Exponential backoff
    
    console.log(`Attempting reconnection ${connectionAttempts}/${maxReconnectAttempts} in ${delay}ms...`);
    addLogEntry('info', `Reconnecting... (${connectionAttempts}/${maxReconnectAttempts})`);
    
    reconnectTimer = setTimeout(() => {
      console.log(`Reconnection attempt ${connectionAttempts}`);
      setupWebSocket();
    }, delay);
  }

  // Setup manual reconnect handlers
  function setupReconnectHandlers() {
    const manualReconnectBtn = document.getElementById('manual-reconnect-btn');
    const refreshPageBtn = document.getElementById('refresh-page-btn');
    
    if (manualReconnectBtn) {
      manualReconnectBtn.addEventListener('click', () => {
        hideReconnectOverlay();
        connectionAttempts = 0; // Reset attempts
        addLogEntry('info', 'Manual reconnect initiated...');
        setupWebSocket();
      });
    }
    
    if (refreshPageBtn) {
      refreshPageBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  // Show reconnect overlay - DISABLED
  function showReconnectOverlay() {
    // Popup disabled - no action taken
    console.log('Reconnect overlay disabled');
  }

  // Hide reconnect overlay - DISABLED
  function hideReconnectOverlay() {
    // Popup disabled - no action taken
    console.log('Reconnect overlay disabled');
  }

  // Setup permanent reconnect bar
  function setupPermanentReconnectBar() {
    const permanentReconnectBtn = document.getElementById('permanent-reconnect-btn');
    const permanentRefreshBtn = document.getElementById('permanent-refresh-btn');
    const statusText = document.getElementById('reconnect-status-text');
    const reconnectInfo = document.querySelector('.reconnect-info');
    
    if (permanentReconnectBtn) {
      permanentReconnectBtn.addEventListener('click', () => {
        // Disable button during reconnect
        permanentReconnectBtn.disabled = true;
        permanentReconnectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
        
        // Update status
        updatePermanentReconnectStatus('connecting', 'Connecting to server...');
        
        // Reset connection attempts and reconnect
        connectionAttempts = 0;
        setupWebSocket();
        
        // Re-enable button after 3 seconds
        setTimeout(() => {
          permanentReconnectBtn.disabled = false;
          permanentReconnectBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Reconnect';
        }, 3000);
      });
    }
    
    if (permanentRefreshBtn) {
      permanentRefreshBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
    
    // Initial status update
    updatePermanentReconnectStatus('disconnected', 'Checking connection...');
  }

  // Update permanent reconnect bar status
  function updatePermanentReconnectStatus(status, message) {
    const statusText = document.getElementById('reconnect-status-text');
    const reconnectInfo = document.querySelector('.reconnect-info');
    
    if (statusText) {
      statusText.textContent = message;
    }
    
    if (reconnectInfo) {
      // Remove existing status classes
      reconnectInfo.classList.remove('connected', 'disconnected', 'connecting');
      // Add new status class
      reconnectInfo.classList.add(status);
    }
  }
  
  // Heartbeat system
  function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
        
        // Check if we haven't received a heartbeat response in too long
        const timeSinceLastResponse = Date.now() - lastHeartbeatResponse;
        if (timeSinceLastResponse > 30000) { // 30 seconds
          console.log('No heartbeat response received, connection may be stale');
          ws.close();
        }
      }
    }, 10000); // Send heartbeat every 10 seconds
  }
  
  // Network scanning for device discovery
  function startNetworkScanning() {
    networkScanInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'network_scan_request' }));
      }
    }, 15000); // Scan network every 15 seconds
  }
  
  // Enhanced connection status update
  function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.className = connected ? 'status-pill connected' : 'status-pill disconnected';
      
      let statusText = connected ? 'Connected' : 'Disconnected';
      if (!connected && connectionAttempts > 0) {
        statusText += ` (Retry ${connectionAttempts}/${maxReconnectAttempts})`;
      }
      
      statusElement.querySelector('.status-text').textContent = statusText;
    }
  }
  
  // Network status update
  function updateNetworkStatus(networkStatus) {
    console.log('Network status updated:', networkStatus);
    // Could add visual indicators for network health here
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

  // Exit Table Download Function
  function setupExitTableDownload() {
    const downloadBtn = document.getElementById('download-exit-table');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', downloadExitTableExcel);
    }
  }

  async function downloadExitTableExcel() {
    try {
      // Show loading state
      const btn = document.getElementById('download-exit-table');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
      btn.disabled = true;

      const response = await fetch('/api/exit-validator-all-data');
      const data = await response.json();
      
      if (!data.students || data.students.length === 0) {
        alert('No data to download');
        return;
      }

      // Create Excel content using XLSX library
      const worksheet = XLSX.utils.json_to_sheet(
        data.students.map(student => {
          const date = new Date(student.timestamp);
          return {
            'Date': date.toLocaleDateString(),
            'Time': date.toLocaleTimeString(),
            'Student ID': student.student_id || '',
            'Name': student.student_name || '',
            'Center': student.center || '',
            'Subject': student.subject || '',
            'Grade': student.grade || '',
            'Fees': student.fees || '0',
            'Payment Amount': student.payment_amount ? student.payment_amount.toFixed(2) : '0.00',
            'Homework Score': student.homework_score || '',
            'Exam Score': student.exam_score || '',
            'Entry Method': student.entry_method === 'manual' ? 'Manual Entry' : 'QR Scan',
            'Device': student.device_name || '',
            'Phone': student.phone || '',
            'Parent Phone': student.parent_phone || '',
            'Comment': student.comment || '',
            'Error Detail': student.error_detail || ''
          };
        })
      );

      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Exit Validator Data');

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      
      // Create blob and download
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exit-validator-data-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log(`Downloaded Excel file with ${data.students.length} student records`);
      
    } catch (error) {
      console.error('Failed to download exit validator data:', error);
      alert('Failed to download data. Please try again.');
    } finally {
      // Restore button state
      const btn = document.getElementById('download-exit-table');
      btn.innerHTML = '<i class="fas fa-download"></i> Download Exit Table';
      btn.disabled = false;
    }
  }

  // Excel Import Functionality
  function setupExcelImport() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('excel-file-input');
    const showTemplatesBtn = document.getElementById('show-templates');
    const clearImportBtn = document.getElementById('clear-import');
    const confirmImportBtn = document.getElementById('confirm-import');
    const cancelImportBtn = document.getElementById('cancel-import');

    let currentFileData = null;

    if (!uploadArea || !fileInput) return; // Exit if elements don't exist

    // Upload area click
    uploadArea.addEventListener('click', () => {
      fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
      }
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    });

    // Show templates
    if (showTemplatesBtn) {
      showTemplatesBtn.addEventListener('click', () => {
        showTemplates();
      });
    }

    // Clear import
    if (clearImportBtn) {
      clearImportBtn.addEventListener('click', () => {
        clearImport();
      });
    }

    // Confirm import
    if (confirmImportBtn) {
      confirmImportBtn.addEventListener('click', () => {
        if (currentFileData) {
          importStudents();
        }
      });
    }

    // Cancel import
    if (cancelImportBtn) {
      cancelImportBtn.addEventListener('click', () => {
        clearImport();
      });
    }
  }

  async function handleFileUpload(file) {
    const uploadArea = document.getElementById('upload-area');
    const analysisResults = document.getElementById('analysis-results');
    
    // Validate file type
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
      alert('Please select an Excel file (.xlsx, .xls) or CSV file.');
      return;
    }

    // Show loading state
    uploadArea.innerHTML = `
      <div class="upload-icon">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
      <div class="upload-text">
        <h4>Analyzing file...</h4>
        <p>Please wait while we detect the column structure</p>
      </div>
    `;

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('excelFile', file);

      // Upload and analyze file
      const response = await fetch('/api/upload-excel', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        currentFileData = result;
        displayAnalysisResults(result);
        analysisResults.style.display = 'block';
        uploadArea.style.display = 'none';
      } else {
        throw new Error(result.error || 'Failed to analyze file');
      }

    } catch (error) {
      console.error('File upload error:', error);
      alert('Error analyzing file: ' + error.message);
      
      // Reset upload area
      resetUploadArea();
    }
  }

  function displayAnalysisResults(data) {
    const fileName = document.getElementById('file-name');
    const fileStats = document.getElementById('file-stats');
    const mappingsGrid = document.getElementById('mappings-grid');
    const previewTable = document.getElementById('preview-table');

    if (fileName) fileName.textContent = data.fileName;
    if (fileStats) fileStats.textContent = `${data.analysis.studentsCount} students found in ${data.analysis.totalRows} rows`;

    // Display mappings
    if (mappingsGrid) {
      mappingsGrid.innerHTML = '';
      const fieldLabels = {
        id: 'Student ID',
        name: 'Student Name',
        center: 'Center',
        subject: 'Subject',
        grade: 'Grade',
        fees: 'Fees',
        phone: 'Phone',
        parent_phone: 'Parent Phone',
        email: 'Email',
        address: 'Address'
      };

      for (const [field, colIndex] of Object.entries(data.analysis.mappings)) {
        const mappingItem = document.createElement('div');
        mappingItem.className = 'mapping-item';
        
        const fieldLabel = document.createElement('div');
        fieldLabel.className = 'mapping-field';
        fieldLabel.textContent = fieldLabels[field] || field;
        
        const columnLabel = document.createElement('div');
        columnLabel.className = 'mapping-column';
        
        if (colIndex !== null) {
          columnLabel.textContent = data.analysis.headers[colIndex];
          columnLabel.classList.add('detected');
        } else {
          columnLabel.textContent = 'Not detected';
          columnLabel.classList.add('not-detected');
        }
        
        mappingItem.appendChild(fieldLabel);
        mappingItem.appendChild(columnLabel);
        mappingsGrid.appendChild(mappingItem);
      }
    }

    // Display preview table
    if (previewTable) {
      displayPreviewTable(data.analysis.preview, data.analysis.headers, data.analysis.mappings);
    }
  }

  function displayPreviewTable(previewData, headers, mappings) {
    const previewTable = document.getElementById('preview-table');
    if (!previewTable) return;
    
    // Create header row
    let tableHTML = '<thead><tr>';
    for (const header of headers) {
      tableHTML += `<th>${header}</th>`;
    }
    tableHTML += '</tr></thead><tbody>';

    // Create data rows
    for (const student of previewData) {
      tableHTML += '<tr>';
      for (let i = 0; i < headers.length; i++) {
        const value = getStudentFieldValue(student, i, mappings);
        tableHTML += `<td>${value || ''}</td>`;
      }
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody>';

    previewTable.innerHTML = tableHTML;
  }

  function getStudentFieldValue(student, colIndex, mappings) {
    // Find which field this column maps to
    for (const [field, mappedIndex] of Object.entries(mappings)) {
      if (mappedIndex === colIndex) {
        return student[field] || '';
      }
    }
    return '';
  }

  async function importStudents() {
    if (!currentFileData) return;

    const importProgress = document.getElementById('import-progress');
    const analysisResults = document.getElementById('analysis-results');
    const importMode = document.getElementById('import-mode');

    if (!importProgress || !analysisResults) return;

    // Show progress
    importProgress.style.display = 'block';
    analysisResults.style.display = 'none';

    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    try {
      if (progressText) progressText.textContent = 'Starting import...';
      if (progressFill) progressFill.style.width = '10%';

      const response = await fetch('/api/import-students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filePath: currentFileData.filePath,
          importMode: importMode ? importMode.value : 'add'
        })
      });

      if (progressFill) progressFill.style.width = '50%';
      if (progressText) progressText.textContent = 'Processing students...';

      const result = await response.json();

      if (progressFill) progressFill.style.width = '100%';
      if (progressText) progressText.textContent = 'Import completed!';

      if (result.success) {
        displayImportResults(result);
        currentFileData = null;
      } else {
        throw new Error(result.error || 'Import failed');
      }

    } catch (error) {
      console.error('Import error:', error);
      if (progressText) progressText.textContent = 'Import failed: ' + error.message;
      if (progressFill) progressFill.style.background = '#dc3545';
    }
  }

  function displayImportResults(result) {
    const importProgress = document.getElementById('import-progress');
    const importResults = document.getElementById('import-results');
    const resultsSummary = document.getElementById('results-summary');
    const resultsErrors = document.getElementById('results-errors');

    if (!importProgress || !importResults) return;

    // Hide progress, show results
    importProgress.style.display = 'none';
    importResults.style.display = 'block';

    // Display summary
    const summary = result.summary;
    if (resultsSummary) {
      resultsSummary.innerHTML = `
        <div class="summary-item success">
          <div class="summary-number">${summary.imported}</div>
          <div class="summary-label">Imported</div>
        </div>
        <div class="summary-item warning">
          <div class="summary-number">${summary.updated}</div>
          <div class="summary-label">Updated</div>
        </div>
        <div class="summary-item danger">
          <div class="summary-number">${summary.skipped}</div>
          <div class="summary-label">Skipped</div>
        </div>
        <div class="summary-item">
          <div class="summary-number">${summary.total}</div>
          <div class="summary-label">Total</div>
        </div>
      `;
    }

    // Display errors if any
    if (result.errors && result.errors.length > 0 && resultsErrors) {
      resultsErrors.style.display = 'block';
      resultsErrors.innerHTML = `
        <h6>Import Errors (${result.errors.length})</h6>
        ${result.errors.map(error => `
          <div class="error-item">
            <strong>${error.student}:</strong> ${error.error}
          </div>
        `).join('')}
      `;
    } else if (resultsErrors) {
      resultsErrors.style.display = 'none';
    }

    // Auto-hide results after 10 seconds
    setTimeout(() => {
      clearImport();
    }, 10000);
  }

  function clearImport() {
    const uploadArea = document.getElementById('upload-area');
    const analysisResults = document.getElementById('analysis-results');
    const importProgress = document.getElementById('import-progress');
    const importResults = document.getElementById('import-results');
    const fileInput = document.getElementById('excel-file-input');

    // Reset all sections
    if (uploadArea) uploadArea.style.display = 'block';
    if (analysisResults) analysisResults.style.display = 'none';
    if (importProgress) importProgress.style.display = 'none';
    if (importResults) importResults.style.display = 'none';

    // Reset upload area content
    if (uploadArea) {
      resetUploadArea();
    }

    // Reset file input
    if (fileInput) fileInput.value = '';
    currentFileData = null;
  }

  function resetUploadArea() {
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
      uploadArea.innerHTML = `
        <div class="upload-icon">
          <i class="fas fa-cloud-upload-alt"></i>
        </div>
        <div class="upload-text">
          <h4>Drop Excel file here or click to browse</h4>
          <p>Supports .xlsx, .xls, and .csv files</p>
          <p class="upload-note">Auto-detects any column arrangement and language</p>
        </div>
        <input type="file" id="excel-file-input" accept=".xlsx,.xls,.csv" style="display: none;">
      `;
    }
  }

  async function showTemplates() {
    try {
      const response = await fetch('/api/excel-templates');
      const result = await response.json();

      if (result.success) {
        let templateHTML = '<h4>Excel Templates</h4>';
        
        for (const template of result.templates) {
          templateHTML += `
            <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #dee2e6; border-radius: 6px;">
              <h5>${template.name}</h5>
              <p style="color: #6c757d; margin-bottom: 10px;">${template.description}</p>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <thead>
                    <tr style="background: #f8f9fa;">
                      ${template.headers.map(header => `<th style="padding: 8px; border: 1px solid #dee2e6;">${header}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${template.sample.map(row => `
                      <tr>
                        ${row.map(cell => `<td style="padding: 8px; border: 1px solid #dee2e6;">${cell}</td>`).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }

        // Show in a modal
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
          background: rgba(0,0,0,0.5); z-index: 1000; display: flex; 
          align-items: center; justify-content: center; padding: 20px;
        `;
        
        modal.innerHTML = `
          <div style="background: white; border-radius: 8px; padding: 20px; max-width: 800px; max-height: 80vh; overflow-y: auto;">
            ${templateHTML}
            <div style="text-align: center; margin-top: 20px;">
              <button onclick="this.closest('.modal').remove()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Close
              </button>
            </div>
          </div>
        `;
        
        modal.className = 'modal';
        document.body.appendChild(modal);
        
        // Close on click outside
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.remove();
          }
        });

      } else {
        alert('Failed to load templates');
      }
    } catch (error) {
      console.error('Template loading error:', error);
      alert('Error loading templates: ' + error.message);
    }
  }

  // Initialize when page loads
  window.addEventListener('load', init);
})();