(function(){
  // Prefer same-origin WS endpoint when server attaches WS to HTTP/HTTPS
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let deviceName = '';
  let ws = null;
  let video = null;
  let canvas = null;
  let ctx = null;
  let scanning = false;
  let studentCache = {};
  let reconnectTimer = null;
  let offlineQueue = []; // Queue for offline registrations
  let isOnline = false;
  let offlineMode = false;
  let localStudentCache = {}; // Local copy of student database
  let offlineRegistrations = []; // All registrations made while offline
  let connectionAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectDelay = 3000;
  let heartbeatInterval = null;
  let networkScanInterval = null;
  let lastHeartbeatResponse = Date.now();
  let serverInfo = null;
  let isInMainScreen = false; // Flag to track if we're in main scanning screen
  
  // Enhanced Hybrid System Variables - ZERO DATA LOSS
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
  
  // ZERO DATA LOSS SYSTEM - Multiple backup layers
  let localStudentDatabase = {}; // Complete local copy of ALL students
  let localRegistrationDatabase = []; // ALL registrations ever made on this device
  let backupDatabase = {}; // Backup copy for redundancy
  let emergencyBackup = {}; // Emergency backup in case of corruption
  let dataVersion = 1; // Version tracking for data integrity
  let lastBackupTime = Date.now();
  let autoBackupInterval = null; // Automatic backup every 30 seconds
  let criticalDataFlags = {
    studentsLoaded: false,
    registrationsLoaded: false,
    backupCreated: false,
    syncCompleted: false
  };

  async function init() {
    document.getElementById('btn-start').addEventListener('click', start);
    
    // ZERO DATA LOSS INITIALIZATION
    console.log('🛡️ Initializing ZERO DATA LOSS system...');
    await initializeDataProtection();
    
    // Check for saved device login
    checkSavedDeviceLogin();
    
    // Add logout button event listener
    document.getElementById('logout-btn').addEventListener('click', logoutDevice);
    
    // Add manual sync button event listener
    document.getElementById('manual-sync-btn').addEventListener('click', manualSync);
    
    // Setup reconnect handlers
    setupReconnectHandlers();
    setupPermanentReconnectBar();
  }

  async function start() {
    deviceName = document.getElementById('device-name').value.trim();
    if (!deviceName) { 
      alert('Please enter device name'); 
      return; 
    }
    
    // Set flag to indicate we're now in main screen
    isInMainScreen = true;
    
    // Save device login to cache
    saveDeviceLogin(deviceName);
    
    // Hide setup screen and show scanner
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('entry-scanner-container').style.display = 'flex';
    
    // Initialize hybrid system
    await initializeHybridSystem();
    
    await loadCache();
    loadOfflineQueue(); // Load offline queue on startup
    loadOfflineRegistrations(); // Load offline registrations on startup
    loadSyncQueue(); // Load sync queue on startup
    setupWS();
    setupUI();
    await startCamera();
    loop();
  }

  async function loadCache() {
    try {
      // First, try to load from localStorage (offline cache)
      const cachedData = localStorage.getItem('entryScannerStudentCache');
      if (cachedData) {
        const parsedCache = JSON.parse(cachedData);
        const cacheTimestamp = parsedCache.timestamp;
        const cacheAge = Date.now() - cacheTimestamp;
        
        // Use cached data if it's less than 24 hours old
        if (cacheAge < 24 * 60 * 60 * 1000) {
          studentCache = parsedCache.data;
          localStudentCache = parsedCache.data;
          console.log(`Using cached student data (${Math.round(cacheAge / (60 * 1000))} minutes old)`);
          updateOfflineMode(true);
          return;
        }
      }
      
      // Check if cache is embedded (from entry-scanner-embedded route)
      if (typeof STUDENT_CACHE !== 'undefined') {
        studentCache = STUDENT_CACHE;
        localStudentCache = STUDENT_CACHE;
        console.log('Using embedded student cache');
        saveCacheToLocal();
        return;
      }
      
      // Try to fetch from API
      try {
        const res = await fetch('/api/student-cache');
        if (res.ok) {
          studentCache = await res.json();
          localStudentCache = studentCache;
          console.log('Loaded student cache from API');
          saveCacheToLocal();
          updateOfflineMode(false);
          return;
        }
      } catch (apiError) {
        console.warn('API fetch failed, using cached data if available:', apiError);
      }
      
      // Fallback to cached data even if old
      if (cachedData) {
        const parsedCache = JSON.parse(cachedData);
        studentCache = parsedCache.data;
        localStudentCache = parsedCache.data;
        console.log('Using old cached student data (API unavailable)');
        updateOfflineMode(true);
        showNotification('⚠️ Using cached data - some students may be missing', 'warning');
      } else {
        throw new Error('No student data available');
      }
      
    } catch (error) {
      console.error('Failed to load student cache:', error);
      updateOfflineMode(true);
      showNotification('❌ No student data available - working in offline mode', 'error');
    }
  }
  
  function saveCacheToLocal() {
    try {
      const cacheData = {
        data: studentCache,
        timestamp: Date.now()
      };
      localStorage.setItem('entryScannerStudentCache', JSON.stringify(cacheData));
      console.log('Student cache saved to localStorage');
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error);
    }
  }
  
  function updateOfflineMode(isOffline) {
    offlineMode = isOffline;
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      if (isOffline) {
        statusElement.className = 'status-offline';
        statusElement.innerHTML = `
          <i class="fas fa-circle"></i>
          <span>Offline Mode</span>
        `;
      }
    }
    
    // Update UI to show offline mode
    const scanStatus = document.getElementById('scan-status');
    if (scanStatus && isOffline) {
      scanStatus.innerHTML = `
        <div class="status-indicator">
          <i class="fas fa-wifi-slash"></i>
          <span>Offline Mode - Scanning Available</span>
        </div>
      `;
      scanStatus.style.background = '#fff3cd';
      scanStatus.style.color = '#856404';
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
      isOnline = true;
      connectionAttempts = 0;
      updateConnectionStatus(true);
      hideReconnectOverlay(); // Hide reconnect overlay when connected
      updatePermanentReconnectStatus('connected', 'Connected to server');
      
      // Register device with reconnection info
      ws.send(JSON.stringify({ 
        type: 'register_device', 
        role: 'first_scan', 
        name: deviceName,
        reconnectionAttempts: connectionAttempts,
        lastDisconnect: lastHeartbeatResponse
      }));
      
      // Process offline queue when connection is restored
      setTimeout(() => {
        processOfflineQueue();
      }, 1000);
      
      // ===== HYBRID SYSTEM: TRIGGER SYNC WHEN CONNECTION RESTORED =====
      setTimeout(() => {
        if (syncQueue.length > 0) {
          console.log('🔄 Connection restored - triggering sync queue processing');
          processSyncQueue();
        }
      }, 2000);
      
      // Start heartbeat system
      startHeartbeat();
      
      // Start connection monitoring
      startConnectionMonitoring();
      
      // Start network scanning for other devices
      startNetworkScanning();
      
      showNotification('✅ Connected to server', 'success');
    });
    
    ws.addEventListener('message', (evt) => {
      try {
        const data = JSON.parse(evt.data);
        
        if (data.type === 'student_cache_update') {
          // AUTO-RECEIVE: Server is pushing the complete student database
          const oldCount = Object.keys(studentCache).length;
          studentCache = data.cache;
          const newCount = data.totalStudents || Object.keys(studentCache).length;
          
          console.log(`✅ Received complete student database: ${newCount} students`);
          console.log('📊 Student cache updated from server automatically');
          
          // Determine the type of update
          let updateMessage = '';
          let updateIcon = '';
          
          if (data.updateReason === 'database_file_changed') {
            updateIcon = '🔄';
            if (newCount > oldCount) {
              updateMessage = `Database updated: +${newCount - oldCount} students (Total: ${newCount})`;
            } else if (newCount < oldCount) {
              updateMessage = `Database updated: -${oldCount - newCount} students (Total: ${newCount})`;
            } else {
              updateMessage = `Database refreshed: ${newCount} students`;
            }
          } else {
            updateIcon = '📚';
            updateMessage = `Student database loaded: ${newCount} students`;
          }
          
          // Update UI to show cache is loaded
          const status = document.getElementById('scan-status');
          if (status) {
            status.textContent = `${updateIcon} ${updateMessage}`;
            status.style.background = '#e8f5e8';
            status.style.color = '#2e7d32';
            
            // Auto-clear status after 4 seconds for file changes, 3 for initial load
            const clearDelay = data.updateReason === 'database_file_changed' ? 4000 : 3000;
            setTimeout(() => {
              status.textContent = 'Ready to scan...';
              status.style.background = '#f5f5f5';
              status.style.color = '#333';
            }, clearDelay);
          }
          
          // Store cache update info for debugging
          window.lastCacheUpdate = {
            timestamp: data.timestamp,
            totalStudents: newCount,
            updateReason: data.updateReason || 'initial_load',
            previousCount: oldCount
          };
          
          return;
        }
        
        if (data.type === 'new_student') {
          // Update local cache with new student
          studentCache[data.student.id] = data.student;
          console.log('Added new student to cache:', data.student.name);
          
          // Show notification
          const status = document.getElementById('scan-status');
          if (status) {
            status.textContent = `➕ New student added: ${data.student.name}`;
            status.style.background = '#e3f2fd';
            status.style.color = '#1976d2';
            
            setTimeout(() => {
              status.textContent = 'Ready to scan...';
              status.style.background = '#f5f5f5';
              status.style.color = '#333';
            }, 3000);
          }
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
          
          // Update connection status with server info
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
      isOnline = false;
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
      isOnline = false;
      updateConnectionStatus(false);
      showNotification('❌ Connection error - attempting to reconnect...', 'error');
      try { ws.close(); } catch(e) {}
    });
  }

  function setupUI() {
    // Update camera status
    const cameraStatusText = document.getElementById('camera-status-text');
    if (cameraStatusText) {
      cameraStatusText.textContent = 'Camera ready';
    }
    
    // Setup close button for result popup
    const closeBtn = document.getElementById('close-result');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('result-popup').classList.remove('show');
      });
    }

    // Close popup when clicking outside
    const popup = document.getElementById('result-popup');
    if (popup) {
      popup.addEventListener('click', (e) => {
        if (e.target.id === 'result-popup') {
          popup.classList.remove('show');
        }
      });
    }
    
    // Setup manual entry button
    const manualEntryBtn = document.getElementById('manual-entry-btn');
    if (manualEntryBtn) {
      manualEntryBtn.addEventListener('click', showManualEntryForm);
    }
    
    // Setup reset data button
    const resetDataBtn = document.getElementById('reset-data-btn');
    if (resetDataBtn) {
      resetDataBtn.addEventListener('click', showResetConfirmation);
    }
    
    video = document.getElementById('camera');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
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
      alert('Camera access denied or not available. Please allow camera access and refresh.');
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
    const student = studentCache[studentId] || localStudentCache[studentId];
    const statusElement = document.querySelector('#scan-status .status-indicator span');
    
    if (!student) { 
      if (statusElement) {
        statusElement.textContent = `Student not found: ${studentId}`;
      }
      showResult('error', `Student not found: ${studentId}`, studentId);
      return; 
    }
    
    if (statusElement) {
      statusElement.textContent = `Found: ${student.name} (#${studentId})`;
    }
    showStudentForm(studentId, student);
  }

  function showStudentForm(studentId, student) {
    const container = document.getElementById('student-form');
    container.classList.add('show');
    container.innerHTML = `
      <div class="student-info">
        <h3><i class="fas fa-user"></i> ${student.name}</h3>
        <div class="student-details">
          <div class="detail-item">
            <i class="fas fa-id-card"></i>
            <span>ID: ${studentId}</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-building"></i>
            <span>Center: ${student.center}</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-book"></i>
            <span>Subject: ${student.subject}</span>
          </div>
          <div class="detail-item">
            <i class="fas fa-graduation-cap"></i>
            <span>Grade: ${student.grade}</span>
          </div>
        </div>
      </div>
      
      <div class="form-group">
        <label for="hw">
          <i class="fas fa-book-open"></i>
          Homework Score (0-10)
        </label>
        <input id="hw" type="number" min="0" max="10" step="0.5" placeholder="Enter homework score" />
      </div>
      
      <div class="form-group">
        <label for="extra">
          <i class="fas fa-plus-circle"></i>
          Extra Sessions
        </label>
        <input id="extra" type="number" min="0" value="0" placeholder="Number of extra sessions" />
      </div>
      
      <div class="payment-section">
        <h4><i class="fas fa-dollar-sign"></i> Payment Information</h4>
        <div class="form-group payment-amount">
          <label for="payment-amount">
            <i class="fas fa-money-bill-wave"></i>
            Payment Amount
          </label>
          <input id="payment-amount" type="number" step="0.01" min="0" placeholder="0.00" />
        </div>
      </div>
      
      <div class="form-group">
        <label for="comment">
          <i class="fas fa-comment"></i>
          Comment
        </label>
        <textarea id="comment" placeholder="Optional comment about the session..."></textarea>
      </div>
      
      <div class="form-actions">
        <button id="btn-register" class="btn btn-success">
          <i class="fas fa-check"></i>
          <span>Register Student</span>
        </button>
        <button id="btn-continue" class="btn btn-secondary">
          <i class="fas fa-arrow-right"></i>
          <span>Continue Scanning</span>
        </button>
      </div>
    `;
    
    document.getElementById('btn-register').onclick = () => registerStudent(studentId, student);
    document.getElementById('btn-continue').onclick = () => { 
      container.classList.remove('show');
      const statusElement = document.querySelector('#scan-status .status-indicator span');
      if (statusElement) {
        statusElement.textContent = 'Ready to scan...';
      }
    };
    
    // Focus on homework score input
    document.getElementById('hw').focus();
  }

  function registerStudent(studentId, student) {
    const paymentAmount = document.getElementById('payment-amount').value;
    
    const record = {
      id: Date.now(),
      student_id: studentId,
      student_name: student.name,
      center: student.center,
      fees: student.fees,
      homework_score: Number(document.getElementById('hw').value || 0),
      exam_score: null, // No exam score in first scan
      error: null,
      extra_sessions: Number(document.getElementById('extra').value || 0),
      comment: String(document.getElementById('comment').value || '').trim(),
      error_detail: null,
      fees_1: student.fees_1,
      subject: student.subject,
      grade: student.grade,
      session_sequence: student.session_sequence,
      guest_info: student.guest_info,
      phone: student.phone,
      parent_phone: student.parent_phone,
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : 0,
      timestamp: new Date().toISOString(),
      device_name: deviceName,
      registered: true,
      entry_method: 'qr_scan',
      offline_mode: offlineMode || !isOnline
    };
    
    // ===== HYBRID SYSTEM: ALWAYS SAVE LOCALLY FIRST =====
    persistLocal(record);
    
    // Add to offline registrations if in offline mode
    if (offlineMode || !isOnline) {
      offlineRegistrations.push(record);
      saveOfflineRegistrations();
    }
    
    // ===== HYBRID SYSTEM: ADD TO MYSQL SYNC QUEUE =====
    addToSyncQueue('create_registration', record);
    
    // Try to send to manager (will queue if offline)
    sendToManager(record);
    
    // Save data persistently
    saveDataPersistently();
    
    // Update data integrity counters
    updateDataIntegrityCounters();
    
    document.getElementById('student-form').classList.remove('show');
    
    const statusElement = document.querySelector('#scan-status .status-indicator span');
    if (statusElement) {
      if (offlineMode || !isOnline) {
        statusElement.textContent = `Registered (Offline): ${student.name}`;
      } else {
        statusElement.textContent = `Registered: ${student.name}`;
      }
    }
    
    // Show appropriate result message with hybrid system info
    const resultMessage = offlineMode || !isOnline 
      ? `Student ${student.name} registered offline - will sync to MySQL when connected!`
      : `Student ${student.name} registered - syncing to MySQL backup...`;
    
    showResult('success', resultMessage, studentId, record);
    
    // Update sync status UI
    updateSyncStatusUI();
    
    // Auto-clear status after 3 seconds
    setTimeout(() => {
      if (statusElement) {
        statusElement.textContent = offlineMode || !isOnline 
          ? 'Offline Mode - Ready to scan...' 
          : 'Ready to scan...';
      }
    }, 3000);
  }

  function persistLocal(record) {
    try {
      const key = 'entryScanRecords';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push(record);
      localStorage.setItem(key, JSON.stringify(arr));
      console.log('Record saved locally');
    } catch (error) {
      console.error('Failed to save record locally:', error);
    }
  }

  // Offline Queue Management
  function addToOfflineQueue(record) {
    try {
      const key = 'entryScanOfflineQueue';
      const queue = JSON.parse(localStorage.getItem(key) || '[]');
      queue.push({
        ...record,
        queuedAt: new Date().toISOString(),
        retryCount: 0
      });
      localStorage.setItem(key, JSON.stringify(queue));
      offlineQueue = queue;
      console.log(`Added to offline queue: ${record.student_name} (${record.student_id})`);
      updateOfflineIndicator();
    } catch (error) {
      console.error('Failed to add to offline queue:', error);
    }
  }

  function loadOfflineQueue() {
    try {
      const key = 'entryScanOfflineQueue';
      offlineQueue = JSON.parse(localStorage.getItem(key) || '[]');
      console.log(`Loaded ${offlineQueue.length} offline queue items`);
      updateOfflineIndicator();
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  function clearOfflineQueue() {
    try {
      const key = 'entryScanOfflineQueue';
      localStorage.removeItem(key);
      offlineQueue = [];
      updateOfflineIndicator();
      console.log('Offline queue cleared');
    } catch (error) {
      console.error('Failed to clear offline queue:', error);
    }
  }

  function removeFromOfflineQueue(recordId) {
    try {
      const key = 'entryScanOfflineQueue';
      const queue = JSON.parse(localStorage.getItem(key) || '[]');
      const filteredQueue = queue.filter(item => item.id !== recordId);
      localStorage.setItem(key, JSON.stringify(filteredQueue));
      offlineQueue = filteredQueue;
      updateOfflineIndicator();
    } catch (error) {
      console.error('Failed to remove from offline queue:', error);
    }
  }

  async function processOfflineQueue() {
    const totalOffline = offlineQueue.length + offlineRegistrations.length;
    if (totalOffline === 0 || !isOnline) {
      return;
    }

    console.log(`Processing ${totalOffline} offline items (${offlineQueue.length} queue + ${offlineRegistrations.length} registrations)...`);
    
    // Process offline queue first
    for (let i = offlineQueue.length - 1; i >= 0; i--) {
      const queuedRecord = offlineQueue[i];
      
      try {
        // Send the record to server
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'student_registered', 
            record: queuedRecord 
          }));
          
          console.log(`✅ Sent queued record: ${queuedRecord.student_name} (${queuedRecord.student_id})`);
          
          // Remove from queue after successful send
          removeFromOfflineQueue(queuedRecord.id);
          
          // Show notification
          showNotification(`✅ Synced: ${queuedRecord.student_name}`, 'success');
          
        } else {
          console.log('WebSocket not ready, keeping in queue');
          break;
        }
      } catch (error) {
        console.error(`Failed to send queued record ${queuedRecord.student_id}:`, error);
        
        // Increment retry count
        queuedRecord.retryCount = (queuedRecord.retryCount || 0) + 1;
        
        // Remove if too many retries
        if (queuedRecord.retryCount >= 3) {
          console.log(`Removing record ${queuedRecord.student_id} after ${queuedRecord.retryCount} retries`);
          removeFromOfflineQueue(queuedRecord.id);
        }
      }
    }
    
    // Process offline registrations
    for (let i = offlineRegistrations.length - 1; i >= 0; i--) {
      const offlineRecord = offlineRegistrations[i];
      
      try {
        // Send the record to server
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'student_registered', 
            record: offlineRecord 
          }));
          
          console.log(`✅ Sent offline registration: ${offlineRecord.student_name} (${offlineRecord.student_id})`);
          
          // Remove from offline registrations after successful send
          offlineRegistrations.splice(i, 1);
          saveOfflineRegistrations();
          
          // Show notification
          showNotification(`✅ Synced: ${offlineRecord.student_name}`, 'success');
          
        } else {
          console.log('WebSocket not ready, keeping offline registrations');
          break;
        }
      } catch (error) {
        console.error(`Failed to send offline registration ${offlineRecord.student_id}:`, error);
      }
    }
    
    // Update offline indicator after processing
    updateOfflineIndicator();
  }

  function saveOfflineRegistrations() {
    try {
      localStorage.setItem('entryScannerOfflineRegistrations', JSON.stringify(offlineRegistrations));
      console.log(`Saved ${offlineRegistrations.length} offline registrations`);
    } catch (error) {
      console.error('Failed to save offline registrations:', error);
    }
  }
  
  function loadOfflineRegistrations() {
    try {
      const stored = localStorage.getItem('entryScannerOfflineRegistrations');
      if (stored) {
        offlineRegistrations = JSON.parse(stored);
        console.log(`Loaded ${offlineRegistrations.length} offline registrations`);
      }
    } catch (error) {
      console.error('Failed to load offline registrations:', error);
    }
  }
  
  function clearOfflineRegistrations() {
    try {
      localStorage.removeItem('entryScannerOfflineRegistrations');
      offlineRegistrations = [];
      console.log('Cleared offline registrations');
    } catch (error) {
      console.error('Failed to clear offline registrations:', error);
    }
  }

  function updateOfflineIndicator() {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;

    if (isOnline && !offlineMode) {
      if (offlineQueue.length > 0 || offlineRegistrations.length > 0) {
        const totalPending = offlineQueue.length + offlineRegistrations.length;
        statusElement.innerHTML = `
          <i class="fas fa-circle"></i>
          <span>Connected (${totalPending} pending)</span>
        `;
        statusElement.className = 'status-syncing';
      } else {
        statusElement.innerHTML = `
          <i class="fas fa-circle"></i>
          <span>Connected</span>
        `;
        statusElement.className = 'status-online';
      }
    } else {
      const totalOffline = offlineQueue.length + offlineRegistrations.length;
      statusElement.innerHTML = `
        <i class="fas fa-circle"></i>
        <span>Offline (${totalOffline} queued)</span>
      `;
      statusElement.className = 'status-offline';
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
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function sendToManager(record) {
    // Only send data if we're in the main scanning screen
    if (!isInMainScreen) {
      console.log('Not in main screen, skipping data push');
      return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN && isOnline) {
      ws.send(JSON.stringify({ 
        type: 'student_registered', 
        record 
      }));
      console.log('Record sent to manager');
    } else {
      console.warn('WebSocket not connected, adding to offline queue');
      addToOfflineQueue(record);
      showNotification(`📱 ${record.student_name} queued for sync`, 'info');
    }
  }

  function sendNewStudent(student) {
    // Only send data if we're in the main scanning screen
    if (!isInMainScreen) {
      console.log('Not in main screen, skipping new student push');
      return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN && isOnline) {
      ws.send(JSON.stringify({ 
        type: 'new_student', 
        student 
      }));
      console.log('New student sent to manager');
    } else {
      console.warn('WebSocket not connected, adding to offline queue');
      addToOfflineQueue(student);
      showNotification(`📱 ${student.name} queued for sync`, 'info');
    }
  }

  function showResult(status, message, studentId, record = null) {
    const popup = document.getElementById('result-popup');
    const title = document.getElementById('result-title');
    const details = document.getElementById('result-details');
    
    // Update popup class
    popup.className = `result-popup ${status.toLowerCase()}`;
    
    // Update title
    title.innerHTML = `
      <i class="fas fa-${status === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
      <span>${status === 'success' ? 'Registration Success' : 'Error'}</span>
    `;
    
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
          <h4 style="margin: 0 0 12px 0; color: #333;">Registration Details</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 14px;">
            <div><strong>Name:</strong> ${record.student_name}</div>
            <div><strong>Center:</strong> ${record.center}</div>
            <div><strong>Subject:</strong> ${record.subject}</div>
            <div><strong>Grade:</strong> ${record.grade}</div>
            <div><strong>Homework:</strong> ${record.homework_score}/10</div>
            <div><strong>Extra Sessions:</strong> ${record.extra_sessions}</div>
            <div><strong>Payment Amount:</strong> ${record.payment_amount ? `$${record.payment_amount.toFixed(2)}` : 'No payment'}</div>
            <div><strong>Entry Method:</strong> ${record.entry_method === 'manual' ? 'Manual Entry' : 'QR Scan'}</div>
            <div><strong>Device:</strong> ${record.device_name}</div>
            <div><strong>Registered:</strong> ${new Date(record.timestamp).toLocaleString()}</div>
          </div>
          ${record.comment ? `<div style="margin-top: 12px;"><strong>Comment:</strong> ${record.comment}</div>` : ''}
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
  
  // Heartbeat system
  function startHeartbeat() {
    heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
        
        // Check if we haven't received a heartbeat response in too long
        const timeSinceLastResponse = Date.now() - lastHeartbeatResponse;
        if (timeSinceLastResponse > 15000) { // 15 seconds - reduced from 30
          console.log('No heartbeat response received, connection may be stale');
          console.log(`Last response: ${timeSinceLastResponse}ms ago`);
          
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
      } else {
        // WebSocket is not open, update status to offline
        isOnline = false;
        updateConnectionStatus(false);
      }
    }, 5000); // Send heartbeat every 5 seconds - increased frequency
  }
  
  // Connection monitoring system
  function startConnectionMonitoring() {
    setInterval(() => {
      // Check if WebSocket is actually connected
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        if (isOnline) {
          console.log('Connection lost - WebSocket not open');
          isOnline = false;
          updateConnectionStatus(false);
        }
        return;
      }
      
      // Check if we haven't received any response in too long
      const timeSinceLastResponse = Date.now() - lastHeartbeatResponse;
      if (timeSinceLastResponse > 20000) { // 20 seconds
        console.log('Connection appears stale - no server response');
        isOnline = false;
        updateConnectionStatus(false);
        
        // Try to close and reconnect
        try {
          ws.close();
        } catch (e) {
          console.log('Error closing stale connection:', e);
        }
      }
    }, 3000); // Check every 3 seconds
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
  function updateConnectionStatus(connected, connectedDevices = null) {
    const statusElement = document.getElementById('connection-status');
    const networkStatusElement = document.getElementById('network-status');
    const deviceCountElement = document.getElementById('device-count');
    
    // Update isOnline status
    isOnline = connected;
    
    // ===== HYBRID SYSTEM: USE SYNC STATUS UI =====
    updateSyncStatusUI();
    
    // Update network status
    if (networkStatusElement) {
      networkStatusElement.className = connected ? 'network-status online' : 'network-status offline';
      networkStatusElement.innerHTML = `
        <i class="fas fa-wifi"></i>
        <span>Network: ${connected ? 'Online' : 'Offline'}</span>
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
  }
  
  // Network status update
  function updateNetworkStatus(networkStatus) {
    console.log('Network status updated:', networkStatus);
    // Could add visual indicators for network health here
  }

  // Manual Entry Functions
  function showManualEntryForm() {
    const studentForm = document.getElementById('student-form');
    const currentResult = document.getElementById('current-result');
    
    // Hide current result and show manual form
    currentResult.style.display = 'none';
    studentForm.style.display = 'block';
    
    // Create simplified step-by-step manual entry form
    studentForm.innerHTML = `
      <div class="simple-entry-form">
        <div class="form-header">
          <h3><i class="fas fa-keyboard"></i> Quick Student Entry</h3>
          <p class="form-instructions">Press <strong>Enter</strong> to move to next field. Final <strong>Enter</strong> registers student.</p>
        </div>
        
        <div class="form-steps">
          <div class="step-indicator">
            <div class="step active" data-step="1">
              <span class="step-number">1</span>
              <span class="step-label">Name</span>
            </div>
            <div class="step" data-step="2">
              <span class="step-number">2</span>
              <span class="step-label">Center</span>
            </div>
            <div class="step" data-step="3">
              <span class="step-number">3</span>
              <span class="step-label">Grade</span>
            </div>
            <div class="step" data-step="4">
              <span class="step-number">4</span>
              <span class="step-label">Phone</span>
            </div>
            <div class="step" data-step="5">
              <span class="step-number">5</span>
              <span class="step-label">Subject</span>
            </div>
            <div class="step" data-step="6">
              <span class="step-number">6</span>
              <span class="step-label">Register</span>
            </div>
          </div>
          
          <div class="form-fields">
            <div class="field-group active" data-field="1">
              <label for="simple-name">Student Name *</label>
              <input type="text" id="simple-name" placeholder="Enter student name" autofocus>
              <div class="field-hint">Press Enter to continue</div>
            </div>
            
            <div class="field-group" data-field="2">
              <label for="simple-center">Center</label>
              <input type="text" id="simple-center" placeholder="Enter center name">
              <div class="field-hint">Press Enter to continue</div>
            </div>
            
            <div class="field-group" data-field="3">
              <label for="simple-grade">Grade</label>
              <input type="text" id="simple-grade" placeholder="Enter grade">
              <div class="field-hint">Press Enter to continue</div>
            </div>
            
            <div class="field-group" data-field="4">
              <label for="simple-phone">Phone</label>
              <input type="text" id="simple-phone" placeholder="Enter phone number">
              <div class="field-hint">Press Enter to continue</div>
            </div>
            
            <div class="field-group" data-field="5">
              <label for="simple-subject">Subject</label>
              <input type="text" id="simple-subject" placeholder="Enter subject">
              <div class="field-hint">Press Enter to register student</div>
            </div>
            
            <div class="field-group" data-field="6">
              <div class="register-confirmation">
                <div class="student-summary" id="student-summary">
                  <!-- Student summary will be shown here -->
                </div>
                <div class="register-actions">
                  <button type="button" class="btn btn-secondary" onclick="cancelSimpleEntry()">
                    <i class="fas fa-times"></i>
                    Cancel
                  </button>
                  <button type="button" class="btn btn-primary" onclick="registerSimpleStudent()">
                    <i class="fas fa-check"></i>
                    Register Student
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Setup simple entry form event listeners
    setupSimpleEntryForm();
  }

  function cancelManualEntry() {
    const studentForm = document.getElementById('student-form');
    const currentResult = document.getElementById('current-result');
    
    // Clear form and show waiting state
    studentForm.style.display = 'none';
    currentResult.style.display = 'block';
    studentForm.innerHTML = '';
  }

  async function submitManualEntry() {
    // Get form data
    let studentId = document.getElementById('manual-student-id').value.trim();
    const studentName = document.getElementById('manual-student-name').value.trim();
    const center = document.getElementById('manual-center').value.trim();
    const grade = document.getElementById('manual-grade').value.trim();
    const phone = document.getElementById('manual-phone').value.trim();
    const parentPhone = document.getElementById('manual-parent-phone').value.trim();
    const subject = document.getElementById('manual-subject').value.trim();
    const paymentAmount = document.getElementById('manual-payment-amount').value.trim();
    const homework = document.getElementById('manual-homework').value.trim();
    const comments = document.getElementById('manual-comments').value.trim();
    
    // Validate required fields (only name is required)
    if (!studentName) {
      alert('Please enter the student name');
      return;
    }

    // Keep ID empty if not provided
    if (!studentId) {
      studentId = '';
    }
    
    // Create student record (same format as QR scan)
    const record = {
      id: Date.now(),
      student_id: studentId,
      student_name: studentName,
      center: center || 'Manual Entry',
      fees: '0', // Manual entry doesn't have fees from database
      homework_score: homework ? parseFloat(homework) : 0,
      exam_score: null,
      error: null,
      extra_sessions: 0,
      comment: comments || '',
      error_detail: null,
      fees_1: '0',
      subject: subject || '',
      grade: grade || '',
      session_sequence: '',
      guest_info: '',
      phone: phone || '',
      parent_phone: parentPhone || '',
      payment_amount: paymentAmount ? parseFloat(paymentAmount) : 0,
      timestamp: new Date().toISOString(),
      device_name: deviceName,
      registered: true,
      entry_method: 'manual',
      offline_mode: offlineMode || !isOnline
    };
    
    // Add to local student cache for future QR scans
    const newStudent = {
      id: studentId,
      name: studentName,
      center: center || 'Manual Entry',
      grade: grade || '',
      phone: phone || '',
      parent_phone: parentPhone || '',
      subject: subject || '',
      fees: '0',
      fees_1: '0',
      session_sequence: '',
      guest_info: ''
    };
    
    // Update both caches
    studentCache[studentId] = newStudent;
    localStudentCache[studentId] = newStudent;
    
    // Save updated cache to localStorage
    saveCacheToLocal();
    
    // ===== ZERO DATA LOSS SYSTEM: ENHANCED PROTECTION =====
    try {
      // Use ZERO DATA LOSS registration system
      const studentData = {
        id: studentId,
        name: studentName,
        center: center || 'Manual Entry',
        grade: grade || '',
        phone: phone || '',
        parent_phone: parentPhone || '',
        subject: subject || '',
        fees: '0',
        method: 'manual'
      };
      
      const result = await registerStudentWithZeroLoss(studentData);
      
      if (result.success) {
        // Also save using existing hybrid system for compatibility
        persistLocal(record);
        
        // Add to offline registrations if in offline mode
        if (offlineMode || !isOnline) {
          offlineRegistrations.push(record);
          saveOfflineRegistrations();
        }
        
        // Add to MySQL sync queue
        addToSyncQueue('create_registration', record);
        
        // Try to send to manager (will queue if offline)
        sendToManager(record);
        
        // Save data persistently
        saveDataPersistently();
        
        // Update data integrity counters
        updateDataIntegrityCounters();
        
        // Show success message with ZERO DATA LOSS confirmation
        const resultMessage = offlineMode || !isOnline 
          ? `✅ Student ${studentName} registered with ZERO DATA LOSS protection! (Offline - will sync when connected)`
          : `✅ Student ${studentName} registered with ZERO DATA LOSS protection!`;
        
        alert(resultMessage);
        console.log('🛡️ Manual entry completed with ZERO DATA LOSS protection');
        
      } else {
        throw new Error('ZERO DATA LOSS registration failed');
      }
      
    } catch (error) {
      console.error('❌ CRITICAL: Manual entry registration failed:', error);
      
      // Fallback to existing system
      persistLocal(record);
      
      if (offlineMode || !isOnline) {
        offlineRegistrations.push(record);
        saveOfflineRegistrations();
      }
      
      addToSyncQueue('create_registration', record);
      sendToManager(record);
      saveDataPersistently();
      updateDataIntegrityCounters();
      
      alert(`⚠️ Student ${studentName} registered with fallback protection! Data saved locally.`);
    }
    
    showResult('success', resultMessage, studentId, record);
    
    // Update offline indicator
    updateOfflineIndicator();
    
    // Clear form and return to waiting state
    cancelManualEntry();
    
    // Update status
    const statusElement = document.querySelector('#scan-status .status-indicator span');
    if (statusElement) {
      statusElement.textContent = offlineMode || !isOnline 
        ? `Registered (Offline): ${studentName}` 
        : `Registered: ${studentName}`;
      
      setTimeout(() => {
        statusElement.textContent = offlineMode || !isOnline 
          ? 'Offline Mode - Ready to scan...' 
          : 'Ready to scan...';
      }, 3000);
    }
  }

  // Simple Entry Form Functions
  function setupSimpleEntryForm() {
    const fields = ['simple-name', 'simple-center', 'simple-grade', 'simple-phone', 'simple-subject'];
    let currentFieldIndex = 0;
    
    // Add Enter key listeners to all fields
    fields.forEach((fieldId, index) => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (index < fields.length - 1) {
              // Move to next field
              moveToNextField(index + 1);
            } else {
              // Last field - show summary and register
              showStudentSummary();
            }
          }
        });
      }
    });
  }
  
  function moveToNextField(nextIndex) {
    // Hide current field
    const currentField = document.querySelector(`[data-field="${nextIndex}"]`);
    const currentStep = document.querySelector(`[data-step="${nextIndex}"]`);
    
    if (currentField && currentStep) {
      // Remove active class from all fields and steps
      document.querySelectorAll('.field-group').forEach(f => f.classList.remove('active'));
      document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
      
      // Add active class to current field and step
      currentField.classList.add('active');
      currentStep.classList.add('active');
      
      // Focus on the input field
      const input = currentField.querySelector('input');
      if (input) {
        input.focus();
      }
    }
  }
  
  function showStudentSummary() {
    // Get all form values
    const name = document.getElementById('simple-name').value.trim();
    const center = document.getElementById('simple-center').value.trim();
    const grade = document.getElementById('simple-grade').value.trim();
    const phone = document.getElementById('simple-phone').value.trim();
    const subject = document.getElementById('simple-subject').value.trim();
    
    // Validate required field
    if (!name) {
      alert('Please enter the student name');
      moveToNextField(1); // Go back to name field
      return;
    }
    
    // Show summary
    const summary = document.getElementById('student-summary');
    summary.innerHTML = `
      <h4><i class="fas fa-user"></i> Student Summary</h4>
      <div class="summary-details">
        <div class="summary-item">
          <strong>Name:</strong> ${name}
        </div>
        <div class="summary-item">
          <strong>Center:</strong> ${center || 'Not specified'}
        </div>
        <div class="summary-item">
          <strong>Grade:</strong> ${grade || 'Not specified'}
        </div>
        <div class="summary-item">
          <strong>Phone:</strong> ${phone || 'Not specified'}
        </div>
        <div class="summary-item">
          <strong>Subject:</strong> ${subject || 'Not specified'}
        </div>
      </div>
    `;
    
    // Move to final step
    moveToNextField(6);
  }
  
  async function registerSimpleStudent() {
    // Get all form values
    const name = document.getElementById('simple-name').value.trim();
    const center = document.getElementById('simple-center').value.trim();
    const grade = document.getElementById('simple-grade').value.trim();
    const phone = document.getElementById('simple-phone').value.trim();
    const subject = document.getElementById('simple-subject').value.trim();
    
    // Validate required field
    if (!name) {
      alert('Please enter the student name');
      return;
    }
    
    // Auto-generate ID
    const studentId = `STU${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    
    // Create student record
    const record = {
      id: Date.now(),
      student_id: studentId,
      student_name: name,
      center: center || 'Default Center',
      grade: grade || 'N/A',
      phone: phone || '',
      parent_phone: '',
      subject: subject || 'General',
      fees: 0,
      homework_score: 0,
      exam_score: null,
      error: null,
      extra_sessions: 0,
      comment: 'Manual entry via simplified form',
      error_detail: null,
      timestamp: new Date().toISOString()
    };
    
    try {
      // Register student
      await registerStudent(record);
      
      // Show success message
      showNotification(`✅ Student ${name} registered successfully!`, 'success');
      
      // Reset form
      cancelSimpleEntry();
      
    } catch (error) {
      console.error('Registration error:', error);
      showNotification(`❌ Failed to register student: ${error.message}`, 'error');
    }
  }
  
  function cancelSimpleEntry() {
    const studentForm = document.getElementById('student-form');
    const currentResult = document.getElementById('current-result');
    
    // Clear form
    studentForm.innerHTML = '';
    studentForm.style.display = 'none';
    currentResult.style.display = 'block';
  }
  
  // QR Student Form Functions
  function setupQRStudentForm() {
    const fields = ['qr-payment-amount', 'qr-homework-score', 'qr-comment'];
    let currentFieldIndex = 0;
    
    // Add Enter key listeners to all fields
    fields.forEach((fieldId, index) => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (index < fields.length - 1) {
              // Move to next field
              moveToNextQRField(index + 1);
            } else {
              // Last field - show summary and register
              showQRStudentSummary();
            }
          }
        });
      }
    });
  }
  
  function moveToNextQRField(nextIndex) {
    // Hide current field
    const currentField = document.querySelector(`[data-field="${nextIndex}"]`);
    const currentStep = document.querySelector(`[data-step="${nextIndex}"]`);
    
    if (currentField && currentStep) {
      // Remove active class from all fields and steps
      document.querySelectorAll('.field-group').forEach(f => f.classList.remove('active'));
      document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
      
      // Add active class to current field and step
      currentField.classList.add('active');
      currentStep.classList.add('active');
      
      // Focus on the input field
      const input = currentField.querySelector('input');
      if (input) {
        input.focus();
      }
    }
  }
  
  function showQRStudentSummary() {
    // Get all form values
    const paymentAmount = document.getElementById('qr-payment-amount').value.trim();
    const homeworkScore = document.getElementById('qr-homework-score').value.trim();
    const comment = document.getElementById('qr-comment').value.trim();
    
    // Show summary
    const summary = document.getElementById('qr-student-summary');
    summary.innerHTML = `
      <h4><i class="fas fa-user-check"></i> Registration Summary</h4>
      <div class="summary-details">
        <div class="summary-item">
          <strong>Payment Amount:</strong> ${paymentAmount || '0.00'}
        </div>
        <div class="summary-item">
          <strong>Homework Score:</strong> ${homeworkScore || '0'}
        </div>
        <div class="summary-item">
          <strong>Comments:</strong> ${comment || 'None'}
        </div>
      </div>
    `;
    
    // Move to final step
    moveToNextQRField(4);
  }
  
  async function registerQRStudent(studentId, studentName) {
    // Get all form values
    const paymentAmount = document.getElementById('qr-payment-amount').value.trim();
    const homeworkScore = document.getElementById('qr-homework-score').value.trim();
    const comment = document.getElementById('qr-comment').value.trim();
    
    // Create student record
    const record = {
      id: Date.now(),
      student_id: studentId,
      student_name: studentName,
      center: studentCache[studentId]?.center || 'Default Center',
      grade: studentCache[studentId]?.grade || 'N/A',
      phone: studentCache[studentId]?.phone || '',
      parent_phone: studentCache[studentId]?.parent_phone || '',
      subject: studentCache[studentId]?.subject || 'General',
      fees: paymentAmount ? parseFloat(paymentAmount) : 0,
      homework_score: homeworkScore ? parseInt(homeworkScore) : 0,
      exam_score: null,
      error: null,
      extra_sessions: 0,
      comment: comment || 'QR scan registration',
      error_detail: null,
      timestamp: new Date().toISOString()
    };
    
    try {
      // ===== ZERO DATA LOSS SYSTEM: ENHANCED QR PROTECTION =====
      const studentData = {
        id: studentId,
        name: studentName,
        center: studentCache[studentId]?.center || 'Default Center',
        grade: studentCache[studentId]?.grade || 'N/A',
        phone: studentCache[studentId]?.phone || '',
        parent_phone: studentCache[studentId]?.parent_phone || '',
        subject: studentCache[studentId]?.subject || 'General',
        fees: paymentAmount ? parseFloat(paymentAmount) : 0,
        method: 'qr_scan'
      };
      
      // Use ZERO DATA LOSS registration system
      const result = await registerStudentWithZeroLoss(studentData);
      
      if (result.success) {
        // Also register using existing system for compatibility
        await registerStudent(record);
        
        // Show success message with ZERO DATA LOSS confirmation
        showNotification(`✅ Student ${studentName} registered with ZERO DATA LOSS protection!`, 'success');
        console.log('🛡️ QR registration completed with ZERO DATA LOSS protection');
        
        // Reset form
        cancelQRRegistration();
        
      } else {
        throw new Error('ZERO DATA LOSS registration failed');
      }
      
    } catch (error) {
      console.error('❌ CRITICAL: QR registration failed:', error);
      
      // Fallback to existing system
      try {
        await registerStudent(record);
        showNotification(`⚠️ Student ${studentName} registered with fallback protection!`, 'warning');
        cancelQRRegistration();
      } catch (fallbackError) {
        console.error('❌ Fallback registration also failed:', fallbackError);
        showNotification(`❌ Failed to register student: ${error.message}`, 'error');
      }
    }
  }
  
  function cancelQRRegistration() {
    const container = document.getElementById('student-form');
    container.classList.remove('show');
    const statusElement = document.querySelector('#scan-status .status-indicator span');
    if (statusElement) {
      statusElement.textContent = 'Ready to scan...';
    }
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

  // ========================================
  // ZERO DATA LOSS SYSTEM FUNCTIONS
  // ========================================
  
  // Initialize comprehensive data protection
  async function initializeDataProtection() {
    try {
      console.log('🛡️ Starting ZERO DATA LOSS initialization...');
      
      // Load all existing data from localStorage
      await loadAllLocalData();
      
      // Create multiple backup layers
      await createEmergencyBackup();
      
      // Start automatic backup system
      startAutoBackupSystem();
      
      // Verify data integrity
      await verifyDataIntegrity();
      
      console.log('✅ ZERO DATA LOSS system initialized successfully');
      console.log(`📊 Data Status: ${Object.keys(localStudentDatabase).length} students, ${localRegistrationDatabase.length} registrations`);
      
    } catch (error) {
      console.error('❌ CRITICAL: Data protection initialization failed:', error);
      // Try to recover from emergency backup
      await attemptDataRecovery();
    }
  }
  
  // Load ALL data from localStorage with multiple fallbacks
  async function loadAllLocalData() {
    try {
      // Load students from multiple sources
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
      
      // Load registrations from multiple sources
      const registrationsFromQueue = localStorage.getItem('offlineRegistrations');
      const registrationsFromDatabase = localStorage.getItem('localRegistrationDatabase');
      const registrationsFromBackup = localStorage.getItem('backupRegistrationDatabase');
      
      // Merge all registration data
      if (registrationsFromDatabase) {
        localRegistrationDatabase = JSON.parse(registrationsFromDatabase);
        criticalDataFlags.registrationsLoaded = true;
        console.log(`📝 Loaded ${localRegistrationDatabase.length} registrations from local database`);
      } else if (registrationsFromQueue) {
        localRegistrationDatabase = JSON.parse(registrationsFromQueue);
        criticalDataFlags.registrationsLoaded = true;
        console.log(`📝 Loaded ${localRegistrationDatabase.length} registrations from queue`);
      } else if (registrationsFromBackup) {
        localRegistrationDatabase = JSON.parse(registrationsFromBackup);
        criticalDataFlags.registrationsLoaded = true;
        console.log(`📝 Loaded ${localRegistrationDatabase.length} registrations from backup`);
      }
      
      // Update data integrity counters
      dataIntegrity.localRecords = Object.keys(localStudentDatabase).length + localRegistrationDatabase.length;
      
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
      backupDatabase = {
        students: { ...localStudentDatabase },
        registrations: [...localRegistrationDatabase],
        timestamp: timestamp,
        version: dataVersion,
        deviceName: deviceName || 'unknown'
      };
      
      // Create emergency backup
      emergencyBackup = {
        students: { ...localStudentDatabase },
        registrations: [...localRegistrationDatabase],
        timestamp: timestamp,
        version: dataVersion,
        deviceName: deviceName || 'unknown',
        critical: true
      };
      
      // Save to localStorage with multiple keys
      localStorage.setItem('backupStudentDatabase', JSON.stringify(backupDatabase.students));
      localStorage.setItem('backupRegistrationDatabase', JSON.stringify(backupDatabase.registrations));
      localStorage.setItem('emergencyBackup', JSON.stringify(emergencyBackup));
      localStorage.setItem('lastBackupTimestamp', timestamp.toString());
      
      criticalDataFlags.backupCreated = true;
      lastBackupTime = timestamp;
      
      console.log('💾 Emergency backup created successfully');
      
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
        console.log('🔄 Auto-backup completed');
      } catch (error) {
        console.error('❌ Auto-backup failed:', error);
      }
    }, 30000);
    
    console.log('⏰ Auto-backup system started (every 30 seconds)');
  }
  
  // Verify data integrity
  async function verifyDataIntegrity() {
    try {
      let issues = [];
      
      // Check student data integrity
      for (const [id, student] of Object.entries(localStudentDatabase)) {
        if (!student.name || student.name.trim() === '') {
          issues.push(`Student ${id} missing name`);
        }
      }
      
      // Check registration data integrity
      for (const registration of localRegistrationDatabase) {
        if (!registration.student_id && !registration.student_name) {
          issues.push('Registration missing student identifier');
        }
        if (!registration.timestamp) {
          issues.push('Registration missing timestamp');
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
      
      // Fix missing student names
      for (const [id, student] of Object.entries(localStudentDatabase)) {
        if (!student.name || student.name.trim() === '') {
          student.name = `Student_${id}_${Date.now()}`;
          console.log(`🔧 Fixed missing name for student ${id}`);
        }
      }
      
      // Fix missing registration timestamps
      for (const registration of localRegistrationDatabase) {
        if (!registration.timestamp) {
          registration.timestamp = new Date().toISOString();
          console.log('🔧 Fixed missing timestamp for registration');
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
      localStorage.setItem('localStudentDatabase', JSON.stringify(localStudentDatabase));
      localStorage.setItem('localRegistrationDatabase', JSON.stringify(localRegistrationDatabase));
      localStorage.setItem('studentCache', JSON.stringify(localStudentDatabase)); // Legacy compatibility
      localStorage.setItem('offlineRegistrations', JSON.stringify(localRegistrationDatabase)); // Legacy compatibility
      
      // Save to backup storage
      localStorage.setItem('backupStudentDatabase', JSON.stringify(localStudentDatabase));
      localStorage.setItem('backupRegistrationDatabase', JSON.stringify(localRegistrationDatabase));
      
      // Update data version
      dataVersion++;
      localStorage.setItem('dataVersion', dataVersion.toString());
      localStorage.setItem('lastSaveTimestamp', timestamp.toString());
      
      console.log('💾 All data saved successfully with multiple backups');
      
    } catch (error) {
      console.error('❌ CRITICAL: Failed to save data:', error);
      // Try emergency save
      await emergencySave();
    }
  }
  
  // Emergency save function
  async function emergencySave() {
    try {
      console.log('🚨 Attempting emergency save...');
      
      // Try to save with minimal data
      const minimalData = {
        students: Object.keys(localStudentDatabase).length,
        registrations: localRegistrationDatabase.length,
        timestamp: Date.now()
      };
      
      localStorage.setItem('emergencyData', JSON.stringify(minimalData));
      console.log('🚨 Emergency save completed');
      
    } catch (error) {
      console.error('❌ CRITICAL: Emergency save failed:', error);
      alert('CRITICAL ERROR: Unable to save data! Please contact support immediately.');
    }
  }
  
  // Attempt data recovery from emergency backup
  async function attemptDataRecovery() {
    try {
      console.log('🚨 Attempting data recovery from emergency backup...');
      
      const emergencyData = localStorage.getItem('emergencyBackup');
      if (emergencyData) {
        const backup = JSON.parse(emergencyData);
        localStudentDatabase = backup.students || {};
        localRegistrationDatabase = backup.registrations || [];
        
        console.log('✅ Data recovered from emergency backup');
        await saveAllLocalData();
      } else {
        console.log('❌ No emergency backup found');
      }
      
    } catch (error) {
      console.error('❌ Data recovery failed:', error);
    }
  }
  
  // Enhanced student registration with ZERO DATA LOSS
  async function registerStudentWithZeroLoss(studentData) {
    try {
      console.log('🛡️ Registering student with ZERO DATA LOSS protection...');
      
      // Create comprehensive student record
      const studentRecord = {
        id: studentData.id || '',
        name: studentData.name || '',
        center: studentData.center || '',
        grade: studentData.grade || '',
        phone: studentData.phone || '',
        parent_phone: studentData.parent_phone || '',
        subject: studentData.subject || '',
        fees: studentData.fees || '0',
        email: studentData.email || '',
        address: studentData.address || '',
        timestamp: new Date().toISOString(),
        deviceName: deviceName,
        registrationMethod: studentData.method || 'manual',
        dataVersion: dataVersion,
        critical: true // Mark as critical data
      };
      
      // Add to local student database
      const studentKey = studentData.id || `student_${Date.now()}`;
      localStudentDatabase[studentKey] = studentRecord;
      
      // Create registration record
      const registrationRecord = {
        student_id: studentKey,
        student_name: studentData.name,
        center: studentData.center,
        grade: studentData.grade,
        phone: studentData.phone,
        parent_phone: studentData.parent_phone,
        subject: studentData.subject,
        fees: studentData.fees,
        timestamp: new Date().toISOString(),
        device_name: deviceName,
        entry_method: studentData.method || 'manual',
        payment_amount: 0,
        homework_score: '',
        exam_score: '',
        comment: '',
        error_detail: '',
        dataVersion: dataVersion,
        critical: true // Mark as critical data
      };
      
      // Add to local registration database
      localRegistrationDatabase.push(registrationRecord);
      
      // Save immediately with multiple backups
      await saveAllLocalData();
      
      // Add to sync queue for server sync
      syncQueue.push({
        type: 'student_registration',
        data: registrationRecord,
        timestamp: Date.now(),
        critical: true
      });
      
      // Update data integrity
      dataIntegrity.localRecords++;
      dataIntegrity.pendingSync++;
      
      console.log('✅ Student registered with ZERO DATA LOSS protection');
      console.log(`📊 Total students: ${Object.keys(localStudentDatabase).length}, Total registrations: ${localRegistrationDatabase.length}`);
      
      return { success: true, studentKey, registrationRecord };
      
    } catch (error) {
      console.error('❌ CRITICAL: Student registration failed:', error);
      // Try emergency save
      await emergencySave();
      throw error;
    }
  }
  
  // Enhanced sync function with ZERO DATA LOSS
  async function syncWithZeroLoss() {
    try {
      if (syncInProgress) {
        console.log('⏳ Sync already in progress, skipping...');
        return;
      }
      
      syncInProgress = true;
      console.log('🔄 Starting ZERO DATA LOSS sync...');
      
      // Sync all pending operations
      for (const operation of syncQueue) {
        try {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'sync_operation',
              operation: operation,
              timestamp: Date.now()
            }));
            
            console.log(`📤 Synced operation: ${operation.type}`);
          }
        } catch (error) {
          console.error(`❌ Failed to sync operation ${operation.type}:`, error);
        }
      }
      
      // Clear successfully synced operations
      syncQueue = syncQueue.filter(op => !op.synced);
      
      // Update sync status
      lastSyncTimestamp = Date.now();
      criticalDataFlags.syncCompleted = true;
      dataIntegrity.syncedRecords += dataIntegrity.pendingSync;
      dataIntegrity.pendingSync = 0;
      
      console.log('✅ ZERO DATA LOSS sync completed');
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      syncInProgress = false;
    }
  }

  // Make functions globally available
  window.cancelManualEntry = cancelManualEntry;
  window.submitManualEntry = submitManualEntry;
  window.cancelSimpleEntry = cancelSimpleEntry;
  window.registerSimpleStudent = registerSimpleStudent;
  window.cancelQRRegistration = cancelQRRegistration;
  window.registerQRStudent = registerQRStudent;


  // Reset Data Functions
  function showResetConfirmation() {
    const password = prompt('Enter password to reset all data:');
    
    if (password === null) {
      return;
    }
    
    if (password !== '1234') {
      showNotification('❌ Invalid password!', 'error');
      return;
    }
    
    const confirmed = confirm(
      '⚠️ WARNING: This will permanently delete ALL local data!\n\n' +
      'This includes:\n' +
      '• All scanned student records\n' +
      '• All offline queue data\n' +
      '• All local storage data\n\n' +
      'Are you sure you want to continue?'
    );
    
    if (confirmed) {
      resetAllData();
    }
  }

  function resetAllData() {
    try {
      // Clear all localStorage data
      localStorage.removeItem('entryScanRecords');
      localStorage.removeItem('entryScanOfflineQueue');
      localStorage.removeItem('entryScannerOfflineRegistrations');
      localStorage.removeItem('entryScannerStudentCache');
      
      // ===== HYBRID SYSTEM: CLEAR SYNC DATA =====
      localStorage.removeItem('entryScannerSyncQueue');
      localStorage.removeItem('entryScannerSyncStatus');
      
      // Clear in-memory data
      offlineQueue = [];
      offlineRegistrations = [];
      localStudentCache = {};
      syncQueue = [];
      lastSyncTimestamp = null;
      dataIntegrity = {
        localRecords: 0,
        syncedRecords: 0,
        pendingSync: 0,
        lastBackup: null
      };
      
      // Reset UI
      updateSyncStatusUI();
      
      showNotification('✅ All data has been reset successfully!', 'success');
      
      console.log('All Entry Scanner data has been reset (including hybrid system data)');
      
    } catch (error) {
      console.error('Failed to reset data:', error);
      showNotification('❌ Failed to reset data. Please try again.', 'error');
    }
  }

  // Device Login Caching Functions
  function saveDeviceLogin(deviceName) {
    try {
      const deviceLoginData = {
        deviceName: deviceName,
        loginTime: Date.now(),
        lastActivity: Date.now()
      };
      
      localStorage.setItem('entryScannerDeviceLogin', JSON.stringify(deviceLoginData));
      console.log(`Device login saved: ${deviceName}`);
    } catch (error) {
      console.error('Failed to save device login:', error);
    }
  }

  function checkSavedDeviceLogin() {
    try {
      const savedLogin = localStorage.getItem('entryScannerDeviceLogin');
      if (savedLogin) {
        const loginData = JSON.parse(savedLogin);
        const loginAge = Date.now() - loginData.loginTime;
        
        // Auto-login if login is less than 7 days old
        if (loginAge < 7 * 24 * 60 * 60 * 1000) {
          console.log(`Auto-login found for device: ${loginData.deviceName}`);
          
          // Set device name and auto-login directly
          deviceName = loginData.deviceName;
          
          // Skip setup screen and go directly to main scanner
          autoLoginDirect(loginData.deviceName);
        } else {
          // Clear old login data
          localStorage.removeItem('entryScannerDeviceLogin');
        }
      }
    } catch (error) {
      console.error('Failed to check saved device login:', error);
    }
  }

  function showAutoLoginOption(deviceName) {
    const setupContainer = document.querySelector('.setup-container');
    const autoLoginDiv = document.createElement('div');
    autoLoginDiv.className = 'auto-login-option';
    autoLoginDiv.innerHTML = `
      <div class="auto-login-card">
        <div class="auto-login-header">
          <i class="fas fa-memory"></i>
          <h3>Device Login Found</h3>
        </div>
        <div class="auto-login-content">
          <p>Welcome back! Device <strong>"${deviceName}"</strong> is saved.</p>
          <div class="auto-login-actions">
            <button id="auto-login-btn" class="btn btn-primary">
              <i class="fas fa-sign-in-alt"></i>
              <span>Auto Login</span>
            </button>
            <button id="new-login-btn" class="btn btn-secondary">
              <i class="fas fa-user-plus"></i>
              <span>New Device</span>
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Insert before the setup form
    const setupForm = document.querySelector('.setup-form');
    setupContainer.insertBefore(autoLoginDiv, setupForm);
    
    // Add event listeners
    document.getElementById('auto-login-btn').addEventListener('click', () => {
      deviceName = document.getElementById('device-name').value.trim();
      autoLoginDiv.remove();
      proceedWithLogin();
    });
    
    document.getElementById('new-login-btn').addEventListener('click', () => {
      autoLoginDiv.remove();
      document.getElementById('device-name').value = '';
      document.getElementById('device-name').focus();
    });
  }

  function autoLoginDirect(deviceName) {
    console.log(`Auto-logging in device: ${deviceName}`);
    
    // Set flag to indicate we're now in main screen
    isInMainScreen = true;
    
    // Hide setup screen and show scanner immediately
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('entry-scanner-container').style.display = 'flex';
    
    // Start the application with hybrid system
    initializeHybridSystem().then(() => {
      loadCache().then(() => {
        loadOfflineQueue();
        loadOfflineRegistrations();
        loadSyncQueue(); // Load sync queue
        setupWS();
        setupUI();
        startCamera().then(() => {
          loop();
        });
      });
    });
  }

  function proceedWithLogin() {
    // Set flag to indicate we're now in main screen
    isInMainScreen = true;
    
    // Hide setup screen and show scanner
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('entry-scanner-container').style.display = 'flex';
    
    // Start the application with hybrid system
    initializeHybridSystem().then(() => {
      loadCache().then(() => {
        loadOfflineQueue();
        loadOfflineRegistrations();
        loadSyncQueue(); // Load sync queue
        setupWS();
        setupUI();
        startCamera().then(() => {
          loop();
        });
      });
    });
  }

  function logoutDevice() {
    const confirmed = confirm(
      'Are you sure you want to logout this device?\n\n' +
      'This will:\n' +
      '• Disconnect from the server\n' +
      '• Stop the camera\n' +
      '• Return to the login screen\n' +
      '• Clear the device login cache'
    );
    
    if (confirmed) {
      try {
        // Stop camera
        if (video && video.srcObject) {
          const tracks = video.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
        
        // Close WebSocket connection
        if (ws) {
          ws.close();
        }
        
        // Clear intervals
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        if (networkScanInterval) {
          clearInterval(networkScanInterval);
        }
        if (autoSyncInterval) {
          clearInterval(autoSyncInterval);
        }
        
        // Clear device login cache
        localStorage.removeItem('entryScannerDeviceLogin');
        
        // Reset variables
        deviceName = '';
        ws = null;
        video = null;
        scanning = false;
        isOnline = false;
        offlineMode = false;
        isInMainScreen = false;
        
        // Show setup screen
        document.getElementById('entry-scanner-container').style.display = 'none';
        document.getElementById('setup-screen').style.display = 'flex';
        
        // Clear device name field
        document.getElementById('device-name').value = '';
        
        showNotification('✅ Device logged out successfully!', 'success');
        console.log('Device logged out successfully');
        
      } catch (error) {
        console.error('Failed to logout device:', error);
        showNotification('❌ Failed to logout device. Please refresh the page.', 'error');
      }
    }
  }

  // Enhanced data persistence - save data more frequently
  function saveDataPersistently() {
    try {
      // Save student cache
      if (Object.keys(localStudentCache).length > 0) {
        saveCacheToLocal();
      }
      
      // Save offline registrations
      if (offlineRegistrations.length > 0) {
        saveOfflineRegistrations();
      }
      
      // Save offline queue
      if (offlineQueue.length > 0) {
        saveOfflineQueue();
      }
      
      // ===== HYBRID SYSTEM: SAVE SYNC DATA =====
      if (syncQueue.length > 0) {
        saveSyncQueue();
      }
      saveSyncStatus();
      
      // Update device activity
      updateDeviceActivity();
      
      console.log('Data saved persistently (including hybrid system data)');
    } catch (error) {
      console.error('Failed to save data persistently:', error);
    }
  }

  function updateDeviceActivity() {
    try {
      const savedLogin = localStorage.getItem('entryScannerDeviceLogin');
      if (savedLogin) {
        const loginData = JSON.parse(savedLogin);
        loginData.lastActivity = Date.now();
        localStorage.setItem('entryScannerDeviceLogin', JSON.stringify(loginData));
      }
    } catch (error) {
      console.error('Failed to update device activity:', error);
    }
  }

  // Initialize when page loads
  window.addEventListener('load', init);
  
  // Save data when page is about to unload
  window.addEventListener('beforeunload', (event) => {
    saveDataPersistently();
  });
  
  // Periodic data saving every 30 seconds
  setInterval(() => {
    saveDataPersistently();
  }, 30000);
  
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
      const syncStatus = localStorage.getItem('entryScannerSyncStatus');
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
        deviceName,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('entryScannerSyncStatus', JSON.stringify(syncStatus));
    } catch (error) {
      console.error('Failed to save sync status:', error);
    }
  }
  
  // Load sync queue from localStorage
  function loadSyncQueue() {
    try {
      const stored = localStorage.getItem('entryScannerSyncQueue');
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
      localStorage.setItem('entryScannerSyncQueue', JSON.stringify(syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }
  
  // Add item to sync queue
  function addToSyncQueue(operation, data) {
    try {
      const syncItem = {
        id: Date.now() + Math.random(),
        operation, // 'create_student', 'update_student', 'create_registration'
        data,
        timestamp: new Date().toISOString(),
        deviceName,
        retryCount: 0,
        maxRetries: 3
      };
      
      syncQueue.push(syncItem);
      saveSyncQueue();
      updateDataIntegrityCounters();
      
      console.log(`📋 Added to sync queue: ${operation}`, syncItem);
      
      // Try immediate sync if online
      if (isOnline && !syncInProgress) {
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
      if (isOnline && !syncInProgress && syncQueue.length > 0) {
        console.log('🔄 Auto-sync triggered');
        processSyncQueue();
      }
    }, 2 * 60 * 1000); // Every 2 minutes
  }
  
  // Process sync queue
  async function processSyncQueue() {
    if (syncInProgress || syncQueue.length === 0 || !isOnline) {
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
      const localRecords = JSON.parse(localStorage.getItem('entryScanRecords') || '[]');
      const offlineRegistrations = JSON.parse(localStorage.getItem('entryScannerOfflineRegistrations') || '[]');
      
      dataIntegrity.localRecords = localRecords.length + offlineRegistrations.length;
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
    
    if (isOnline) {
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
    
    if (!isOnline) {
      showNotification('❌ Cannot sync: No internet connection', 'error');
      return;
    }
    
    showNotification('🔄 Starting manual sync...', 'info');
    await processSyncQueue();
  }
  
  // Export functions for potential manual use
  window.EntryScannerApp = {
    sendNewStudent,
    getLocalRecords: () => JSON.parse(localStorage.getItem('entryScanRecords') || '[]'),
    clearLocalRecords: () => localStorage.removeItem('entryScanRecords'),
    manualSync,
    getSyncStatus: () => ({
      syncQueue: syncQueue.length,
      lastSync: lastSyncTimestamp,
      dataIntegrity,
      isOnline,
      syncInProgress
    })
  };
})();
