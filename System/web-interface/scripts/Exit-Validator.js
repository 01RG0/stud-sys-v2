(function(){
  // Prefer same-origin WS endpoint when server attaches WS to HTTP/HTTPS
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws = null;
  let video = null;
  let canvas = null;
  let ctx = null;
  let scanning = false;
  let reconnectTimer = null;
  const registeredByDate = {}; // { yyyy-mm-dd: { [id]: record } }
  let offlineMode = false;
  let offlineValidations = []; // All validations made while offline
  let connectionAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectDelay = 3000;
  let heartbeatInterval = null;
  let networkScanInterval = null;
  let lastHeartbeatResponse = Date.now();
  let serverInfo = null;
  
  // Enhanced Hybrid System Variables
  let syncQueue = []; // Queue for MySQL sync operations
  let lastSyncTimestamp = null; // Track last successful sync
  let syncInProgress = false; // Prevent multiple syncs
  let autoSyncInterval = null; // Periodic sync timer
  let conflictResolution = 'local'; // 'local' or 'server' - local takes priority
  let dataIntegrity = {
    localRecords: 0,
    syncedRecords: 0,
    pendingSync: 0,
    lastBackup: null
  };
  
  // ZERO DATA LOSS SYSTEM - Multiple backup layers for Exit Validator
  let localValidationDatabase = []; // ALL validations ever made on this device
  let localStudentDatabase = {}; // Complete local copy of ALL students from Entry Scanner
  let backupValidationDatabase = []; // Backup copy for redundancy
  let emergencyValidationBackup = {}; // Emergency backup in case of corruption
  let dataVersion = 1; // Version tracking for data integrity
  let lastBackupTime = Date.now();
  let autoBackupInterval = null; // Automatic backup every 30 seconds
  let criticalDataFlags = {
    validationsLoaded: false,
    studentsLoaded: false,
    backupCreated: false,
    syncCompleted: false
  };

  function todayKey() { 
    return new Date().toISOString().split('T')[0]; 
  }

  function init() {
    // ZERO DATA LOSS INITIALIZATION
    console.log('🛡️ Initializing ZERO DATA LOSS system for Exit Validator...');
    initializeDataProtection();
    
    // Initialize hybrid system first
    initializeHybridSystem();
    
    loadStoredRecords();
    loadOfflineValidations();
    loadSyncQueue(); // Load sync queue
    setupWS();
    setupUI();
    setupReconnectHandlers();
    setupPermanentReconnectBar();
    video = document.getElementById('camera');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    startCamera().then(() => loop());
    updateStudentsTable();
  }

  function setupUI() {
    // Setup close button for result popup
    document.getElementById('close-result').addEventListener('click', () => {
      document.getElementById('result-popup').classList.remove('show');
    });

    // Close popup when clicking outside
    document.getElementById('result-popup').addEventListener('click', (e) => {
      if (e.target.id === 'result-popup') {
        document.getElementById('result-popup').classList.remove('show');
      }
    });

    // Setup export button
    document.getElementById('export-btn').addEventListener('click', exportToExcel);
    
    // Setup reset button
    document.getElementById('reset-btn').addEventListener('click', showResetConfirmation);
    
    // Setup refresh table button
    const refreshBtn = document.getElementById('refresh-table');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        updateStudentsTable();
        showNotification('Table refreshed');
      });
    }
    
    // Setup manual sync button
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    if (manualSyncBtn) {
      manualSyncBtn.addEventListener('click', manualSync);
    }
    
  }

  function loadStoredRecords() {
    try {
      const stored = localStorage.getItem('exitValidatorToday');
      if (stored) {
        const today = todayKey();
        registeredByDate[today] = JSON.parse(stored);
        console.log(`Loaded ${Object.keys(registeredByDate[today]).length} stored records for today`);
      }
    } catch (error) {
      console.error('Failed to load stored records:', error);
    }
  }

  function setupWS() {
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
      console.log('WebSocket connected');
      connectionAttempts = 0;
      updateConnectionStatus(true);
      hideReconnectOverlay(); // Hide reconnect overlay when connected
      updatePermanentReconnectStatus('connected', 'Connected to server');
      
      // Register device with reconnection info
      ws.send(JSON.stringify({ 
        type: 'register_device', 
        role: 'last_scan', 
        name: 'Exit-Validator',
        reconnectionAttempts: connectionAttempts,
        lastDisconnect: lastHeartbeatResponse
      }));
      
      // Start heartbeat system
      startHeartbeat();
      
      // Start network scanning
      startNetworkScanning();
      
      // Process offline validations when connection is restored
      setTimeout(() => {
        processOfflineValidations();
      }, 1000);
      
      // ===== HYBRID SYSTEM: TRIGGER SYNC WHEN CONNECTION RESTORED =====
      setTimeout(() => {
        if (syncQueue.length > 0) {
          console.log('🔄 Connection restored - triggering sync queue processing');
          processSyncQueue();
        }
      }, 2000);
      
      showNotification('✅ Connected to server', 'success');
    });
    
    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === 'receive_student_record') {
          const record = data.record;
          const day = todayKey();
          
          if (!registeredByDate[day]) {
            registeredByDate[day] = {};
          }
          
          registeredByDate[day][record.student_id] = record;
          localStorage.setItem('exitValidatorToday', JSON.stringify(registeredByDate[day]));
          
          console.log(`Received registration for student ${record.student_id}: ${record.student_name}`);
          showNotification(`✅ Student ${record.student_name} registered for exit validation`);
          updateStudentsTable();
        }
        
        if (data.type === 'heartbeat_response') {
          lastHeartbeatResponse = Date.now();
          console.log('Heartbeat response received from server');
        }
        
        if (data.type === 'reconnection_confirmed') {
          console.log('Reconnection confirmed by server:', data.deviceInfo);
          showNotification(`🔄 Reconnected to server (attempt ${data.deviceInfo.reconnectionCount})`, 'success');
        }
        
        if (data.type === 'device_discovery') {
          serverInfo = data.serverInfo;
          console.log('Device discovery received:', data);
          updateConnectionStatus(true, data.connectedDevices);
        }
        
        if (data.type === 'network_scan_response') {
          console.log('Network scan response:', data);
          updateNetworkStatus(data.networkStatus);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.addEventListener('close', () => {
      console.log('WebSocket disconnected');
      updateConnectionStatus(false);
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
      updateConnectionStatus(false);
      showNotification('❌ Connection error - attempting to reconnect...', 'error');
      try { ws.close(); } catch(e) {}
    });
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      video.srcObject = stream;
      await video.play();
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      scanning = true;
      console.log('Camera started successfully');
    } catch (error) {
      console.error('Camera error:', error);
      showResult('ERROR', 'Camera access denied or not available. Please allow camera access and refresh.', 'N/A');
    }
  }

  let lastScanTime = 0;
  const SCAN_COOLDOWN = 2000; // 2 seconds cooldown between scans
  
  function loop() {
    if (!scanning) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code && code.data) {
        const now = Date.now();
        if (now - lastScanTime > SCAN_COOLDOWN) {
          lastScanTime = now;
          onQr(code.data);
        }
      }
    }
    
    requestAnimationFrame(loop);
  }

  function onQr(text) {
    const studentId = String(text).trim();
    const day = todayKey();
    const todayMap = registeredByDate[day] || JSON.parse(localStorage.getItem('exitValidatorToday') || '{}');
    
    if (todayMap && todayMap[studentId]) {
      const rec = todayMap[studentId];
      showResult('PASSED', 'Student validated successfully', studentId, rec);
      logValidation(studentId, 'PASSED', rec);
    } else {
      showResult('BLOCKED', 'Student not registered today', studentId);
      logValidation(studentId, 'BLOCKED', null);
    }
  }

  // Enhanced reconnection logic
  function attemptReconnection() {
    if (connectionAttempts >= maxReconnectAttempts) {
      console.log('Max reconnection attempts reached, stopping reconnection');
      showNotification('❌ Max reconnection attempts reached. Please use manual reconnect.', 'error');
      showReconnectOverlay();
      return;
    }
    
    connectionAttempts++;
    const delay = reconnectDelay * Math.pow(2, connectionAttempts - 1); // Exponential backoff
    
    console.log(`Attempting reconnection ${connectionAttempts}/${maxReconnectAttempts} in ${delay}ms...`);
    showNotification(`🔄 Reconnecting... (${connectionAttempts}/${maxReconnectAttempts})`, 'info');
    
    reconnectTimer = setTimeout(() => {
      console.log(`Reconnection attempt ${connectionAttempts}`);
      setupWS();
    }, delay);
  }
  
  // Heartbeat system - Fixed to prevent constant reconnections
  function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
        
        // Check if we haven't received a heartbeat response in too long
        const timeSinceLastResponse = Date.now() - lastHeartbeatResponse;
        if (timeSinceLastResponse > 60000) { // 60 seconds - much more lenient
          console.log('No heartbeat response received for 60 seconds, connection may be stale');
          console.log(`Last response: ${timeSinceLastResponse}ms ago`);
          
          // Only close if we're really sure the connection is dead
          if (timeSinceLastResponse > 120000) { // 2 minutes - very lenient
            console.log('Connection appears to be dead, closing...');
            // Force connection status to offline
            isOnline = false;
            updateConnectionStatus(false);
            
            // Close the connection to trigger reconnection
            try {
              ws.close();
            } catch (e) {
              console.log('Error closing stale connection:', e);
            }
          }
        }
      } else {
        // WebSocket is not open, update status to offline
        isOnline = false;
        updateConnectionStatus(false);
      }
    }, 30000); // Send heartbeat every 30 seconds - much less frequent
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
  function updateConnectionStatus(isConnected, connectedDevices = null) {
    const statusElement = document.getElementById('connection-status');
    const networkStatusElement = document.getElementById('network-status');
    const deviceCountElement = document.getElementById('device-count');
    
    // Update offline mode status
    offlineMode = !isConnected;
    
    // ===== HYBRID SYSTEM: USE SYNC STATUS UI =====
    updateSyncStatusUI();
    
    // Update network status
    if (networkStatusElement) {
      networkStatusElement.className = isConnected ? 'network-status online' : 'network-status offline';
      networkStatusElement.innerHTML = `
        <i class="fas fa-wifi"></i>
        <span>Network: ${isConnected ? 'Online' : 'Offline'}</span>
      `;
    }
    
    // Update device count
    if (deviceCountElement && connectedDevices) {
      deviceCountElement.className = connectedDevices.length > 0 ? 'device-count active' : 'device-count inactive';
      deviceCountElement.innerHTML = `
        <i class="fas fa-desktop"></i>
        <span>Devices: ${connectedDevices.length}</span>
      `;
    }
    
    // Update UI for offline mode
    updateOfflineModeUI();
  }
  
  function updateOfflineModeUI() {
    const currentResult = document.getElementById('current-result');
    if (currentResult && offlineMode) {
      const count = Object.keys(registeredByDate[todayKey()] || {}).length;
      const offlineCount = offlineValidations.length;
      
      if (count === 0) {
        currentResult.innerHTML = `
          <div class="result-icon">📱</div>
          <div class="result-text">Offline Mode - No students registered today</div>
          <div class="result-subtext">${offlineCount} validations pending sync</div>
        `;
      } else {
        currentResult.innerHTML = `
          <div class="result-icon">👥</div>
          <div class="result-text">Offline Mode - ${count} student${count !== 1 ? 's' : ''} registered today</div>
          <div class="result-subtext">${offlineCount} validations pending sync</div>
        `;
      }
    }
  }
  
  // Network status update
  function updateNetworkStatus(networkStatus) {
    console.log('Network status updated:', networkStatus);
    // Could add visual indicators for network health here
  }
  
  // Offline validation management
  function saveOfflineValidations() {
    try {
      localStorage.setItem('exitValidatorOfflineValidations', JSON.stringify(offlineValidations));
      console.log(`Saved ${offlineValidations.length} offline validations`);
    } catch (error) {
      console.error('Failed to save offline validations:', error);
    }
  }
  
  function loadOfflineValidations() {
    try {
      const stored = localStorage.getItem('exitValidatorOfflineValidations');
      if (stored) {
        offlineValidations = JSON.parse(stored);
        console.log(`Loaded ${offlineValidations.length} offline validations`);
      }
    } catch (error) {
      console.error('Failed to load offline validations:', error);
    }
  }
  
  function clearOfflineValidations() {
    try {
      localStorage.removeItem('exitValidatorOfflineValidations');
      offlineValidations = [];
      console.log('Cleared offline validations');
    } catch (error) {
      console.error('Failed to clear offline validations:', error);
    }
  }
  
  // Process offline validations when connection is restored
  async function processOfflineValidations() {
    if (offlineValidations.length === 0 || !isOnline) {
      return;
    }
    
    console.log(`Processing ${offlineValidations.length} offline validations...`);
    
    for (let i = offlineValidations.length - 1; i >= 0; i--) {
      const validation = offlineValidations[i];
      
      try {
        await fetch('/api/validation-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validation)
        });
        
        console.log(`✅ Synced validation: ${validation.student_id} - ${validation.status}`);
        
        // Remove from offline validations after successful send
        offlineValidations.splice(i, 1);
        saveOfflineValidations();
        
        showNotification(`✅ Synced validation: ${validation.student_id}`, 'success');
        
      } catch (error) {
        console.error(`Failed to sync validation ${validation.student_id}:`, error);
      }
    }
  }

  function updateStudentsTable() {
    const tbody = document.getElementById('students-table-body');
    const today = todayKey();
    const todayRecords = registeredByDate[today] || {};
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Add rows for each registered student
    Object.values(todayRecords).forEach(record => {
      const row = document.createElement('tr');
      const date = new Date(record.timestamp);
      
      row.innerHTML = `
        <td>${date.toLocaleDateString()}</td>
        <td>${date.toLocaleTimeString()}</td>
        <td>${record.student_id}</td>
        <td>${record.student_name || 'N/A'}</td>
        <td>${record.center || 'N/A'}</td>
        <td>${record.fees || 'N/A'}</td>
        <td>${record.homework_score || 'N/A'}</td>
        <td>${record.exam_score || 'N/A'}</td>
        <td>${record.error || 'N/A'}</td>
        <td>${record.timestamp}</td>
        <td>${record.extra_sessions || 'N/A'}</td>
        <td>${record.comment || 'N/A'}</td>
        <td>${record.error_detail || 'N/A'}</td>
        <td>${record.fees_1 || 'N/A'}</td>
        <td>${record.subject || 'N/A'}</td>
        <td>${record.grade || 'N/A'}</td>
        <td>${record.session_sequence || 'N/A'}</td>
        <td>${record.guest_info || 'N/A'}</td>
        <td>${record.phone || 'N/A'}</td>
        <td>${record.parent_phone || 'N/A'}</td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Update current result display
    const currentResult = document.getElementById('current-result');
    const count = Object.keys(todayRecords).length;
    
    if (count === 0) {
      currentResult.innerHTML = `
        <div class="result-icon">📱</div>
        <div class="result-text">No students registered today</div>
      `;
    } else {
      currentResult.innerHTML = `
        <div class="result-icon">👥</div>
        <div class="result-text">${count} student${count !== 1 ? 's' : ''} registered today</div>
      `;
    }
  }

  function showResult(status, message, studentId, record = null) {
    const popup = document.getElementById('result-popup');
    const title = document.getElementById('result-title');
    const details = document.getElementById('result-details');
    
    // Update popup class
    popup.className = `result-popup ${status.toLowerCase()}`;
    
    // Update title
    title.textContent = status;
    
    // Update details
    const currentTime = new Date().toLocaleTimeString();
    let detailsHTML = `
      <div style="margin-bottom: 16px;">
        <strong>Student ID:</strong> ${studentId}<br>
        <strong>Status:</strong> ${message}<br>
        <strong>Time:</strong> ${currentTime}
      </div>
    `;
    
    if (record) {
      detailsHTML += `
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-top: 16px;">
          <h4 style="margin: 0 0 12px 0; color: #333;">Student Details</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
            <div><strong>Name:</strong> ${record.student_name || 'N/A'}</div>
            <div><strong>Center:</strong> ${record.center || 'N/A'}</div>
            <div><strong>Subject:</strong> ${record.subject || 'N/A'}</div>
            <div><strong>Grade:</strong> ${record.grade || 'N/A'}</div>
            <div><strong>Homework:</strong> ${record.homework_score || 'N/A'}/10</div>
            <div><strong>Exam:</strong> ${record.exam_score || 'N/A'}/10</div>
            <div><strong>Extra Sessions:</strong> ${record.extra_sessions || 'N/A'}</div>
            <div><strong>Device:</strong> ${record.device_name || 'N/A'}</div>
          </div>
          ${record.comment ? `<div style="margin-top: 12px;"><strong>Comment:</strong> ${record.comment}</div>` : ''}
          <div style="margin-top: 12px; font-size: 12px; color: #6c757d;">
            <strong>Registered:</strong> ${new Date(record.timestamp).toLocaleString()}
          </div>
        </div>
      `;
    }
    
    details.innerHTML = detailsHTML;
    
    // Show popup
    popup.classList.add('show');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      popup.classList.remove('show');
    }, 5000);
    
    // Update table row status
    updateTableRowStatus(studentId, status);
    
    // Log status
    if (status === 'PASSED') {
      console.log('✅ PASSED - Student validated');
    } else {
      console.log('❌ BLOCKED - Student not registered');
    }
  }

  function updateTableRowStatus(studentId, status) {
    const tbody = document.getElementById('students-table-body');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
      const idCell = row.querySelector('td:nth-child(3)');
      if (idCell && idCell.textContent === studentId) {
        // Remove existing status classes
        row.classList.remove('validated', 'blocked');
        // Add new status class
        row.classList.add(status.toLowerCase());
      }
    });
  }

  function showNotification(message) {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 16px;
      background: #2196f3;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 1001;
      max-width: 300px;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  async function logValidation(studentId, status, record) {
    const logEntry = {
      id: Date.now(),
      student_id: studentId,
      student_name: record ? record.student_name : 'Unknown',
      status: status,
      timestamp: new Date().toISOString(),
      record: record,
      offline_mode: offlineMode || !isOnline
    };
    
    // ===== HYBRID SYSTEM: ALWAYS SAVE LOCALLY FIRST =====
    try {
      const key = 'exitValidatorLogs';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push(logEntry);
      // Keep only last 1000 entries
      if (arr.length > 1000) {
        arr.splice(0, arr.length - 1000);
      }
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (error) {
      console.error('Failed to store validation locally:', error);
    }
    
    // Add to offline validations if in offline mode
    if (offlineMode || !isOnline) {
      offlineValidations.push(logEntry);
      saveOfflineValidations();
    }
    
    // ===== HYBRID SYSTEM: ADD TO MYSQL SYNC QUEUE =====
    addToSyncQueue('create_validation', logEntry);
    
    // Try to send to manager (will queue if offline)
    try {
      await fetch('/api/validation-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
      console.log('Validation logged to manager');
      
      // Remove from offline validations if successfully sent
      if (offlineMode || !isOnline) {
        const index = offlineValidations.findIndex(v => v.id === logEntry.id);
        if (index !== -1) {
          offlineValidations.splice(index, 1);
          saveOfflineValidations();
        }
      }
    } catch (error) {
      console.warn('Failed to log validation to manager:', error);
      // Keep in offline validations for later sync
    }
    
    // Update data integrity counters
    updateDataIntegrityCounters();
  }

  function exportToExcel() {
    const today = todayKey();
    const todayRecords = registeredByDate[today] || {};
    const records = Object.values(todayRecords);
    
    if (records.length === 0) {
      showNotification('No student data to export');
      return;
    }

    // Disable button during export
    const exportBtn = document.getElementById('export-btn');
    const originalText = exportBtn.innerHTML;
    exportBtn.disabled = true;
    exportBtn.innerHTML = '⏳ Exporting...';

    try {
      // Prepare data for Excel
      const excelData = records.map(record => {
        const date = new Date(record.timestamp);
        return {
          'Date': date.toLocaleDateString(),
          'Time': date.toLocaleTimeString(),
          'ID': record.student_id,
          'Name': record.student_name || 'N/A',
          'Center': record.center || 'N/A',
          'Fees': record.fees || 'N/A',
          'Homework': record.homework_score || 'N/A',
          'Exam': record.exam_score || 'N/A',
          'Error': record.error || 'N/A',
          'Timestamp': record.timestamp,
          'Extra Sessions': record.extra_sessions || 'N/A',
          'Comment': record.comment || 'N/A',
          'Error Detail': record.error_detail || 'N/A',
          'Fees.1': record.fees_1 || 'N/A',
          'Subject': record.subject || 'N/A',
          'Grade': record.grade || 'N/A',
          'Session Sequence': record.session_sequence || 'N/A',
          'Guest Info': record.guest_info || 'N/A',
          'Phone': record.phone || 'N/A',
          'Parent Phone': record.parent_phone || 'N/A',
          'Device': record.device_name || 'N/A',
          'Registered': record.registered ? 'Yes' : 'No'
        };
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 10 }, // Time
        { wch: 8 },  // ID
        { wch: 20 }, // Name
        { wch: 15 }, // Center
        { wch: 10 }, // Fees
        { wch: 10 }, // Homework
        { wch: 8 },  // Exam
        { wch: 8 },  // Error
        { wch: 20 }, // Timestamp
        { wch: 12 }, // Extra Sessions
        { wch: 25 }, // Comment
        { wch: 15 }, // Error Detail
        { wch: 10 }, // Fees.1
        { wch: 15 }, // Subject
        { wch: 8 },  // Grade
        { wch: 15 }, // Session Sequence
        { wch: 15 }, // Guest Info
        { wch: 15 }, // Phone
        { wch: 15 }, // Parent Phone
        { wch: 15 }, // Device
        { wch: 10 }  // Registered
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Student Data');

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `Student_Data_${currentDate}.xlsx`;

      // Export file
      XLSX.writeFile(wb, filename);

      showNotification(`✅ Exported ${records.length} student records to ${filename}`);
      
    } catch (error) {
      console.error('Export error:', error);
      showNotification('❌ Export failed. Please try again.');
    } finally {
      // Re-enable button
      exportBtn.disabled = false;
      exportBtn.innerHTML = originalText;
    }
  }

  // Password-Protected Reset Functions
  function showResetConfirmation() {
    // Create password dialog
    const password = prompt('Enter password to reset all data:');
    
    if (password === null) {
      // User cancelled
      return;
    }
    
    if (password !== '1234') {
      showNotification('❌ Invalid password!', 'error');
      return;
    }
    
    // Password is correct, show final confirmation
    const confirmed = confirm(
      '⚠️ WARNING: This will permanently delete ALL local data!\n\n' +
      'This includes:\n' +
      '• All registered students for today\n' +
      '• All validation logs\n' +
      '• All local storage data\n\n' +
      'Are you sure you want to continue?'
    );
    
    if (confirmed) {
      resetAllData();
    }
  }

  function resetAllData() {
    try {
      // Clear all local storage data
      localStorage.removeItem('exitValidatorToday');
      localStorage.removeItem('exitValidatorLogs');
      localStorage.removeItem('exitValidatorOfflineValidations');
      
      // ===== HYBRID SYSTEM: CLEAR SYNC DATA =====
      localStorage.removeItem('exitValidatorSyncQueue');
      localStorage.removeItem('exitValidatorSyncStatus');
      
      // Clear in-memory data
      const today = todayKey();
      registeredByDate[today] = {};
      offlineValidations = [];
      syncQueue = [];
      lastSyncTimestamp = null;
      dataIntegrity = {
        localRecords: 0,
        syncedRecords: 0,
        pendingSync: 0,
        lastBackup: null
      };
      
      // Update UI
      updateStudentsTable();
      updateSyncStatusUI();
      
      // Show success notification
      showNotification('✅ All data has been reset successfully!', 'success');
      
      console.log('All Exit Validator data has been reset (including hybrid system data)');
      
    } catch (error) {
      console.error('Failed to reset data:', error);
      showNotification('❌ Failed to reset data. Please try again.', 'error');
    }
  }

  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // Setup manual reconnect handlers
  function setupReconnectHandlers() {
    const manualReconnectBtn = document.getElementById('manual-reconnect-btn');
    const refreshPageBtn = document.getElementById('refresh-page-btn');
    
    if (manualReconnectBtn) {
      manualReconnectBtn.addEventListener('click', () => {
        hideReconnectOverlay();
        connectionAttempts = 0; // Reset attempts
        showNotification('Manual reconnect initiated...', 'info');
        setupWS();
      });
    }
    
    if (refreshPageBtn) {
      refreshPageBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  // Show reconnect overlay
  function showReconnectOverlay() {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
  }

  // Hide reconnect overlay
  function hideReconnectOverlay() {
    const overlay = document.getElementById('reconnect-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
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
        setupWS();
        
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

  // Initialize when page loads
  window.addEventListener('load', init);
  
  // ===== HYBRID SYSTEM FUNCTIONS =====
  
  // Initialize the hybrid system
  async function initializeHybridSystem() {
    try {
      console.log('🔄 Initializing Hybrid System (Local + MySQL Backup)');
      
      // Load sync status
      loadSyncStatus();
      
      // Start auto-sync interval (every 2 minutes)
      startAutoSync();
      
      // Update data integrity counters
      updateDataIntegrityCounters();
      
      console.log('✅ Hybrid System initialized successfully');
      showNotification('🔄 Hybrid System: Local + MySQL Backup Active', 'success');
      
    } catch (error) {
      console.error('❌ Failed to initialize hybrid system:', error);
      showNotification('⚠️ Hybrid System: Local-only mode (MySQL backup unavailable)', 'warning');
    }
  }
  
  // Load sync status from localStorage
  function loadSyncStatus() {
    try {
      const syncStatus = localStorage.getItem('exitValidatorSyncStatus');
      if (syncStatus) {
        const status = JSON.parse(syncStatus);
        lastSyncTimestamp = status.lastSyncTimestamp;
        dataIntegrity = { ...dataIntegrity, ...status.dataIntegrity };
        console.log('📊 Sync status loaded:', status);
      }
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  }
  
  // Save sync status to localStorage
  function saveSyncStatus() {
    try {
      const syncStatus = {
        lastSyncTimestamp,
        dataIntegrity,
        deviceName: 'Exit-Validator',
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('exitValidatorSyncStatus', JSON.stringify(syncStatus));
    } catch (error) {
      console.error('Failed to save sync status:', error);
    }
  }
  
  // Load sync queue from localStorage
  function loadSyncQueue() {
    try {
      const stored = localStorage.getItem('exitValidatorSyncQueue');
      if (stored) {
        syncQueue = JSON.parse(stored);
        console.log(`📋 Loaded ${syncQueue.length} items in sync queue`);
        updateDataIntegrityCounters();
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }
  
  // Save sync queue to localStorage
  function saveSyncQueue() {
    try {
      localStorage.setItem('exitValidatorSyncQueue', JSON.stringify(syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }
  
  // Add item to sync queue
  function addToSyncQueue(operation, data) {
    try {
      const syncItem = {
        id: Date.now() + Math.random(),
        operation, // 'create_validation'
        data,
        timestamp: new Date().toISOString(),
        deviceName: 'Exit-Validator',
        retryCount: 0,
        maxRetries: 3
      };
      
      syncQueue.push(syncItem);
      saveSyncQueue();
      updateDataIntegrityCounters();
      
      console.log(`📋 Added to sync queue: ${operation}`, syncItem);
      
      // Try immediate sync if online
      if (!offlineMode && !syncInProgress) {
        setTimeout(() => processSyncQueue(), 1000);
      }
      
    } catch (error) {
      console.error('Failed to add to sync queue:', error);
    }
  }
  
  // Start auto-sync interval
  function startAutoSync() {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval);
    }
    
    autoSyncInterval = setInterval(() => {
      if (!offlineMode && !syncInProgress && syncQueue.length > 0) {
        console.log('🔄 Auto-sync triggered');
        processSyncQueue();
      }
    }, 2 * 60 * 1000); // Every 2 minutes
  }
  
  // Process sync queue
  async function processSyncQueue() {
    if (syncInProgress || syncQueue.length === 0 || offlineMode) {
      return;
    }
    
    syncInProgress = true;
    console.log(`🔄 Processing sync queue: ${syncQueue.length} items`);
    
    try {
      const itemsToProcess = [...syncQueue];
      let successCount = 0;
      let errorCount = 0;
      
      for (const item of itemsToProcess) {
        try {
          const success = await syncItemToMySQL(item);
          if (success) {
            // Remove from queue
            syncQueue = syncQueue.filter(q => q.id !== item.id);
            successCount++;
          } else {
            // Increment retry count
            item.retryCount++;
            if (item.retryCount >= item.maxRetries) {
              console.log(`❌ Max retries reached for sync item: ${item.operation}`);
              syncQueue = syncQueue.filter(q => q.id !== item.id);
              errorCount++;
            }
          }
        } catch (error) {
          console.error(`❌ Sync error for ${item.operation}:`, error);
          item.retryCount++;
          if (item.retryCount >= item.maxRetries) {
            syncQueue = syncQueue.filter(q => q.id !== item.id);
            errorCount++;
          }
        }
      }
      
      // Save updated queue
      saveSyncQueue();
      updateDataIntegrityCounters();
      
      if (successCount > 0) {
        lastSyncTimestamp = new Date().toISOString();
        saveSyncStatus();
        showNotification(`✅ Synced ${successCount} items to MySQL`, 'success');
      }
      
      if (errorCount > 0) {
        showNotification(`⚠️ ${errorCount} items failed to sync`, 'warning');
      }
      
    } catch (error) {
      console.error('❌ Sync queue processing failed:', error);
    } finally {
      syncInProgress = false;
    }
  }
  
  // Sync individual item to MySQL
  async function syncItemToMySQL(item) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operation: item.operation,
          data: item.data,
          deviceName: item.deviceName,
          timestamp: item.timestamp
        })
      });
      
      if (response.ok) {
        console.log(`✅ Synced ${item.operation} to MySQL`);
        return true;
      } else {
        console.error(`❌ Sync failed for ${item.operation}:`, response.status);
        return false;
      }
    } catch (error) {
      console.error(`❌ Sync error for ${item.operation}:`, error);
      return false;
    }
  }
  
  // Update data integrity counters
  function updateDataIntegrityCounters() {
    try {
      const localLogs = JSON.parse(localStorage.getItem('exitValidatorLogs') || '[]');
      const offlineValidations = JSON.parse(localStorage.getItem('exitValidatorOfflineValidations') || '[]');
      
      dataIntegrity.localRecords = localLogs.length + offlineValidations.length;
      dataIntegrity.pendingSync = syncQueue.length;
      dataIntegrity.lastBackup = lastSyncTimestamp;
      
      // Update UI
      updateSyncStatusUI();
      
    } catch (error) {
      console.error('Failed to update data integrity counters:', error);
    }
  }
  
  // Update sync status UI
  function updateSyncStatusUI() {
    const statusElement = document.getElementById('connection-status');
    const syncStatusElement = document.getElementById('sync-status');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    
    if (!statusElement) return;
    
    if (!offlineMode) {
      if (dataIntegrity.pendingSync > 0) {
        statusElement.innerHTML = `
          <i class="fas fa-circle"></i>
          <span>Connected (${dataIntegrity.pendingSync} pending sync)</span>
        `;
        statusElement.className = 'status-syncing';
        
        // Update sync status indicator
        if (syncStatusElement) {
          syncStatusElement.innerHTML = `
            <i class="fas fa-database"></i>
            <span>Sync: ${dataIntegrity.pendingSync} pending</span>
          `;
          syncStatusElement.className = 'sync-status syncing';
        }
        
        // Enable manual sync button
        if (manualSyncBtn) {
          manualSyncBtn.disabled = false;
          manualSyncBtn.innerHTML = `
            <i class="fas fa-sync-alt"></i>
            <span>Sync (${dataIntegrity.pendingSync})</span>
          `;
        }
      } else {
        statusElement.innerHTML = `
          <i class="fas fa-circle"></i>
          <span>Connected & Synced</span>
        `;
        statusElement.className = 'status-online';
        
        // Update sync status indicator
        if (syncStatusElement) {
          syncStatusElement.innerHTML = `
            <i class="fas fa-database"></i>
            <span>Sync: Up to date</span>
          `;
          syncStatusElement.className = 'sync-status synced';
        }
        
        // Disable manual sync button
        if (manualSyncBtn) {
          manualSyncBtn.disabled = true;
          manualSyncBtn.innerHTML = `
            <i class="fas fa-check"></i>
            <span>Synced</span>
          `;
        }
      }
    } else {
      statusElement.innerHTML = `
        <i class="fas fa-circle"></i>
        <span>Offline (${dataIntegrity.localRecords} local, ${dataIntegrity.pendingSync} queued)</span>
      `;
      statusElement.className = 'status-offline';
      
      // Update sync status indicator
      if (syncStatusElement) {
        syncStatusElement.innerHTML = `
          <i class="fas fa-database"></i>
          <span>Sync: Offline (${dataIntegrity.pendingSync} queued)</span>
        `;
        syncStatusElement.className = 'sync-status offline';
      }
      
      // Disable manual sync button
      if (manualSyncBtn) {
        manualSyncBtn.disabled = true;
        manualSyncBtn.innerHTML = `
          <i class="fas fa-wifi-slash"></i>
          <span>Offline</span>
        `;
      }
    }
  }
  
  // Manual sync function
  async function manualSync() {
    if (syncInProgress) {
      showNotification('⏳ Sync already in progress...', 'info');
      return;
    }
    
    if (offlineMode) {
      showNotification('❌ Cannot sync: No internet connection', 'error');
      return;
    }
    
    showNotification('🔄 Starting manual sync...', 'info');
    await processSyncQueue();
  }
  
  // ========================================
  // ZERO DATA LOSS SYSTEM FUNCTIONS FOR EXIT VALIDATOR
  // ========================================
  
  // Initialize comprehensive data protection for Exit Validator
  async function initializeDataProtection() {
    try {
      console.log('🛡️ Starting ZERO DATA LOSS initialization for Exit Validator...');
      
      // Load all existing data from localStorage
      await loadAllLocalData();
      
      // Create multiple backup layers
      await createEmergencyBackup();
      
      // Start automatic backup system
      startAutoBackupSystem();
      
      // Verify data integrity
      await verifyDataIntegrity();
      
      console.log('✅ ZERO DATA LOSS system initialized successfully for Exit Validator');
      console.log(`📊 Data Status: ${localValidationDatabase.length} validations, ${Object.keys(localStudentDatabase).length} students`);
      
    } catch (error) {
      console.error('❌ CRITICAL: Data protection initialization failed:', error);
      // Try to recover from emergency backup
      await attemptDataRecovery();
    }
  }
  
  // Load ALL data from localStorage with multiple fallbacks
  async function loadAllLocalData() {
    try {
      // Load validations from multiple sources
      const validationsFromQueue = localStorage.getItem('offlineValidations');
      const validationsFromDatabase = localStorage.getItem('localValidationDatabase');
      const validationsFromBackup = localStorage.getItem('backupValidationDatabase');
      
      // Merge all validation data
      if (validationsFromDatabase) {
        localValidationDatabase = JSON.parse(validationsFromDatabase);
        criticalDataFlags.validationsLoaded = true;
        console.log(`📝 Loaded ${localValidationDatabase.length} validations from local database`);
      } else if (validationsFromQueue) {
        localValidationDatabase = JSON.parse(validationsFromQueue);
        criticalDataFlags.validationsLoaded = true;
        console.log(`📝 Loaded ${localValidationDatabase.length} validations from queue`);
      } else if (validationsFromBackup) {
        localValidationDatabase = JSON.parse(validationsFromBackup);
        criticalDataFlags.validationsLoaded = true;
        console.log(`📝 Loaded ${localValidationDatabase.length} validations from backup`);
      }
      
      // Load students from Entry Scanner data
      const studentsFromCache = localStorage.getItem('studentCache');
      const studentsFromDatabase = localStorage.getItem('localStudentDatabase');
      const studentsFromBackup = localStorage.getItem('backupStudentDatabase');
      
      // Merge all student data (local takes priority)
      if (studentsFromDatabase) {
        localStudentDatabase = JSON.parse(studentsFromDatabase);
        criticalDataFlags.studentsLoaded = true;
        console.log(`📚 Loaded ${Object.keys(localStudentDatabase).length} students from local database`);
      } else if (studentsFromCache) {
        localStudentDatabase = JSON.parse(studentsFromCache);
        criticalDataFlags.studentsLoaded = true;
        console.log(`📚 Loaded ${Object.keys(localStudentDatabase).length} students from cache`);
      } else if (studentsFromBackup) {
        localStudentDatabase = JSON.parse(studentsFromBackup);
        criticalDataFlags.studentsLoaded = true;
        console.log(`📚 Loaded ${Object.keys(localStudentDatabase).length} students from backup`);
      }
      
      // Update data integrity counters
      dataIntegrity.localRecords = Object.keys(localStudentDatabase).length + localValidationDatabase.length;
      
    } catch (error) {
      console.error('❌ Error loading local data:', error);
      throw error;
    }
  }
  
  // Create emergency backup with multiple layers
  async function createEmergencyBackup() {
    try {
      const timestamp = Date.now();
      
      // Create primary backup
      backupValidationDatabase = {
        validations: [...localValidationDatabase],
        students: { ...localStudentDatabase },
        timestamp: timestamp,
        version: dataVersion,
        deviceName: 'exit-validator'
      };
      
      // Create emergency backup
      emergencyValidationBackup = {
        validations: [...localValidationDatabase],
        students: { ...localStudentDatabase },
        timestamp: timestamp,
        version: dataVersion,
        deviceName: 'exit-validator',
        critical: true
      };
      
      // Save to localStorage with multiple keys
      localStorage.setItem('backupValidationDatabase', JSON.stringify(backupValidationDatabase.validations));
      localStorage.setItem('backupStudentDatabase', JSON.stringify(backupValidationDatabase.students));
      localStorage.setItem('emergencyValidationBackup', JSON.stringify(emergencyValidationBackup));
      localStorage.setItem('lastBackupTimestamp', timestamp.toString());
      
      criticalDataFlags.backupCreated = true;
      lastBackupTime = timestamp;
      
      console.log('💾 Emergency backup created successfully for Exit Validator');
      
    } catch (error) {
      console.error('❌ CRITICAL: Emergency backup creation failed:', error);
      throw error;
    }
  }
  
  // Start automatic backup system
  function startAutoBackupSystem() {
    // Backup every 30 seconds
    autoBackupInterval = setInterval(async () => {
      try {
        await createEmergencyBackup();
        console.log('🔄 Auto-backup completed for Exit Validator');
      } catch (error) {
        console.error('❌ Auto-backup failed:', error);
      }
    }, 30000);
    
    console.log('⏰ Auto-backup system started for Exit Validator (every 30 seconds)');
  }
  
  // Verify data integrity
  async function verifyDataIntegrity() {
    try {
      let issues = [];
      
      // Check validation data integrity
      for (const validation of localValidationDatabase) {
        if (!validation.student_id && !validation.student_name) {
          issues.push('Validation missing student identifier');
        }
        if (!validation.timestamp) {
          issues.push('Validation missing timestamp');
        }
      }
      
      // Check student data integrity
      for (const [id, student] of Object.entries(localStudentDatabase)) {
        if (!student.name || student.name.trim() === '') {
          issues.push(`Student ${id} missing name`);
        }
      }
      
      if (issues.length > 0) {
        console.warn('⚠️ Data integrity issues found:', issues);
        // Attempt to fix issues
        await fixDataIntegrityIssues(issues);
      } else {
        console.log('✅ Data integrity verified - no issues found');
      }
      
    } catch (error) {
      console.error('❌ Data integrity verification failed:', error);
    }
  }
  
  // Fix data integrity issues
  async function fixDataIntegrityIssues(issues) {
    try {
      console.log('🔧 Attempting to fix data integrity issues...');
      
      // Fix missing validation timestamps
      for (const validation of localValidationDatabase) {
        if (!validation.timestamp) {
          validation.timestamp = new Date().toISOString();
          console.log('🔧 Fixed missing timestamp for validation');
        }
      }
      
      // Fix missing student names
      for (const [id, student] of Object.entries(localStudentDatabase)) {
        if (!student.name || student.name.trim() === '') {
          student.name = `Student_${id}_${Date.now()}`;
          console.log(`🔧 Fixed missing name for student ${id}`);
        }
      }
      
      // Save fixed data
      await saveAllLocalData();
      console.log('✅ Data integrity issues fixed');
      
    } catch (error) {
      console.error('❌ Failed to fix data integrity issues:', error);
    }
  }
  
  // Save ALL data to localStorage with multiple backup layers
  async function saveAllLocalData() {
    try {
      const timestamp = Date.now();
      
      // Save to primary storage
      localStorage.setItem('localValidationDatabase', JSON.stringify(localValidationDatabase));
      localStorage.setItem('localStudentDatabase', JSON.stringify(localStudentDatabase));
      localStorage.setItem('offlineValidations', JSON.stringify(localValidationDatabase)); // Legacy compatibility
      
      // Save to backup storage
      localStorage.setItem('backupValidationDatabase', JSON.stringify(localValidationDatabase));
      localStorage.setItem('backupStudentDatabase', JSON.stringify(localStudentDatabase));
      
      // Update data version
      dataVersion++;
      localStorage.setItem('dataVersion', dataVersion.toString());
      localStorage.setItem('lastSaveTimestamp', timestamp.toString());
      
      console.log('💾 All data saved successfully with multiple backups for Exit Validator');
      
    } catch (error) {
      console.error('❌ CRITICAL: Failed to save data:', error);
      // Try emergency save
      await emergencySave();
    }
  }
  
  // Emergency save function
  async function emergencySave() {
    try {
      console.log('🚨 Attempting emergency save for Exit Validator...');
      
      // Try to save with minimal data
      const minimalData = {
        validations: localValidationDatabase.length,
        students: Object.keys(localStudentDatabase).length,
        timestamp: Date.now()
      };
      
      localStorage.setItem('emergencyValidationData', JSON.stringify(minimalData));
      console.log('🚨 Emergency save completed for Exit Validator');
      
    } catch (error) {
      console.error('❌ CRITICAL: Emergency save failed:', error);
      alert('CRITICAL ERROR: Unable to save Exit Validator data! Please contact support immediately.');
    }
  }
  
  // Attempt data recovery from emergency backup
  async function attemptDataRecovery() {
    try {
      console.log('🚨 Attempting data recovery from emergency backup for Exit Validator...');
      
      const emergencyData = localStorage.getItem('emergencyValidationBackup');
      if (emergencyData) {
        const backup = JSON.parse(emergencyData);
        localValidationDatabase = backup.validations || [];
        localStudentDatabase = backup.students || {};
        
        console.log('✅ Data recovered from emergency backup for Exit Validator');
        await saveAllLocalData();
      } else {
        console.log('❌ No emergency backup found for Exit Validator');
      }
      
    } catch (error) {
      console.error('❌ Data recovery failed for Exit Validator:', error);
    }
  }
  
  // Enhanced validation with ZERO DATA LOSS
  async function validateStudentWithZeroLoss(studentId, studentName, validationData) {
    try {
      console.log('🛡️ Validating student with ZERO DATA LOSS protection...');
      
      // Create comprehensive validation record
      const validationRecord = {
        student_id: studentId,
        student_name: studentName,
        timestamp: new Date().toISOString(),
        device_name: 'exit-validator',
        validation_method: 'qr_scan',
        dataVersion: dataVersion,
        critical: true, // Mark as critical data
        ...validationData
      };
      
      // Add to local validation database
      localValidationDatabase.push(validationRecord);
      
      // Save immediately with multiple backups
      await saveAllLocalData();
      
      // Add to sync queue for server sync
      syncQueue.push({
        type: 'student_validation',
        data: validationRecord,
        timestamp: Date.now(),
        critical: true
      });
      
      // Update data integrity
      dataIntegrity.localRecords++;
      dataIntegrity.pendingSync++;
      
      console.log('✅ Student validated with ZERO DATA LOSS protection');
      console.log(`📊 Total validations: ${localValidationDatabase.length}`);
      
      return { success: true, validationRecord };
      
    } catch (error) {
      console.error('❌ CRITICAL: Student validation failed:', error);
      // Try emergency save
      await emergencySave();
      throw error;
    }
  }

  // Export functions for potential manual use
  window.ExitValidatorApp = {
    getTodayRegistrations: () => registeredByDate[todayKey()] || {},
    getValidationLogs: () => JSON.parse(localStorage.getItem('exitValidatorLogs') || '[]'),
    clearValidationLogs: () => localStorage.removeItem('exitValidatorLogs'),
    manualValidation: (studentId) => onQr(studentId),
    exportToExcel: exportToExcel,
    manualSync,
    getSyncStatus: () => ({
      syncQueue: syncQueue.length,
      lastSync: lastSyncTimestamp,
      dataIntegrity,
      isOnline: !offlineMode,
      syncInProgress
    }),
    // ZERO DATA LOSS functions
    getZeroDataLossStatus: () => ({
      localValidations: localValidationDatabase.length,
      localStudents: Object.keys(localStudentDatabase).length,
      backupCreated: criticalDataFlags.backupCreated,
      lastBackup: lastBackupTime,
      dataVersion: dataVersion
    }),
    emergencyBackup: createEmergencyBackup,
    dataRecovery: attemptDataRecovery
  };
})();
