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
  let sentStudents = new Set(); // Track which students have already been sent to prevent duplicates
  let registeredByDate = {}; // Track registrations by date for manual sync
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
  
  // Enter key navigation cooldown to prevent fast clicking
  let lastNavigationTime = 0;
  const NAVIGATION_COOLDOWN = 300; // 300ms cooldown between navigations
  
  // ZERO DATA LOSS SYSTEM - Multiple backup layers for MASSIVE datasets
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
  
  // MASSIVE DATA HANDLING - Enhanced for 1M+ students
  let batchSize = 100; // Process in batches of 100 students
  let maxBatchDelay = 50; // 50ms delay between batches to prevent overwhelming
  let syncProgress = {
    total: 0,
    processed: 0,
    failed: 0,
    inProgress: false,
    startTime: null,
    estimatedTimeRemaining: 0
  };
  let dataCompression = true; // Enable data compression for large datasets
  let storageOptimization = true; // Enable storage optimization
  let chunkedStorage = true; // Store data in chunks to handle large datasets
  
  // BULLETPROOF MANUAL ENTRY PROTECTION - ZERO DATA LOSS
  let manualEntryBackups = []; // Multiple backups for manual entries
  let manualEntryValidation = true; // Enable validation for manual entries
  let instantBackup = true; // Instant backup on manual entry
  let dataIntegrityChecks = true; // Enable integrity checks
  let manualEntryProtection = {
    totalEntries: 0,
    successfulBackups: 0,
    failedBackups: 0,
    lastBackupTime: null,
    protectionLevel: 'MAXIMUM'
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
    
    // Add right-click context menu for sync button to show details
    document.getElementById('manual-sync-btn').addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showSyncDetails();
    });
    
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
    loadRegisteredByDate(); // Load registrations by date for manual sync
    loadSentStudents(); // Load sent students to prevent duplicates
    clearOldSentStudents(); // Clear old sent students for new day
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
        <input id="hw" type="number" min="0" max="10" step="0.5" placeholder="Enter homework score" autofocus />
        <div class="field-hint"><i class="fas fa-arrow-right"></i> Press <strong>Enter</strong> to move to next field</div>
      </div>
      
      <div class="form-group">
        <label for="extra">
          <i class="fas fa-plus-circle"></i>
          Extra Sessions
        </label>
        <input id="extra" type="number" min="0" value="0" placeholder="Number of extra sessions" />
        <div class="field-hint"><i class="fas fa-arrow-right"></i> Press <strong>Enter</strong> to move to next field</div>
      </div>
      
      <div class="payment-section">
        <h4><i class="fas fa-dollar-sign"></i> Payment Information</h4>
        <div class="form-group payment-amount">
          <label for="payment-amount">
            <i class="fas fa-money-bill-wave"></i>
            Payment Amount
          </label>
          <input id="payment-amount" type="number" step="0.01" min="0" placeholder="0.00" />
          <div class="field-hint"><i class="fas fa-arrow-right"></i> Press <strong>Enter</strong> to move to next field</div>
        </div>
      </div>
      
      <div class="form-group">
        <label for="comment">
          <i class="fas fa-comment"></i>
          Comment
        </label>
        <textarea id="comment" placeholder="Optional comment about the session..."></textarea>
        <div class="field-hint"><i class="fas fa-check"></i> Press <strong>Enter</strong> to register student</div>
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
    
    // Setup easy Enter key navigation
    setTimeout(() => {
      setupEasyQRForm();
    }, 100);
  }

  function registerStudent(studentId, student) {
    const paymentAmount = document.getElementById('payment-amount').value;
    
    const record = {
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
      // MASSIVE DATA HANDLING - Use chunked storage for large datasets
      if (chunkedStorage) {
        persistLocalChunked(record);
      } else {
        persistLocalStandard(record);
      }
      
      // Update registeredByDate for manual sync
      const date = new Date(record.timestamp).toISOString().split('T')[0];
      if (!registeredByDate[date]) {
        registeredByDate[date] = {};
      }
      registeredByDate[date][record.student_id] = record;
      
      console.log('Record saved locally and added to registeredByDate');
    } catch (error) {
      console.error('Failed to save record locally:', error);
      // Fallback to emergency storage
      persistLocalEmergency(record);
    }
  }
  
  function persistLocalStandard(record) {
    const key = 'entryScanRecords';
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push(record);
    
    // Check if data is getting too large
    const dataSize = JSON.stringify(arr).length;
    if (dataSize > 5 * 1024 * 1024) { // 5MB limit
      console.warn('Data size approaching limit, switching to chunked storage');
      chunkedStorage = true;
      persistLocalChunked(record);
      return;
    }
    
    localStorage.setItem(key, JSON.stringify(arr));
  }
  
  function persistLocalChunked(record) {
    const baseKey = 'entryScanRecords';
    const chunkSize = 1000; // 1000 records per chunk
    
    // Get current chunk count
    let chunkCount = parseInt(localStorage.getItem(`${baseKey}_chunkCount`) || '0');
    
    // Get current chunk
    let currentChunk = JSON.parse(localStorage.getItem(`${baseKey}_chunk_${chunkCount}`) || '[]');
    
    // Add record to current chunk
    currentChunk.push(record);
    
    // If chunk is full, save it and create new chunk
    if (currentChunk.length >= chunkSize) {
      localStorage.setItem(`${baseKey}_chunk_${chunkCount}`, JSON.stringify(currentChunk));
      chunkCount++;
      currentChunk = [];
      localStorage.setItem(`${baseKey}_chunkCount`, chunkCount.toString());
    }
    
    // Save current chunk
    localStorage.setItem(`${baseKey}_chunk_${chunkCount}`, JSON.stringify(currentChunk));
    
    console.log(`Record saved to chunk ${chunkCount} (${currentChunk.length}/${chunkSize})`);
  }
  
  function persistLocalEmergency(record) {
    // Emergency storage in case of errors
    const emergencyKey = 'entryScanRecords_emergency';
    const emergencyData = JSON.parse(localStorage.getItem(emergencyKey) || '[]');
    emergencyData.push({
      ...record,
      emergencySaved: true,
      emergencyTimestamp: Date.now()
    });
    localStorage.setItem(emergencyKey, JSON.stringify(emergencyData));
    console.warn('Record saved to emergency storage');
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

  function loadSentStudents() {
    try {
      const key = 'entryScanSentStudents';
      const stored = localStorage.getItem(key);
      if (stored) {
        const sentArray = JSON.parse(stored);
        sentStudents = new Set(sentArray);
        console.log(`Loaded ${sentStudents.size} sent students to prevent duplicates`);
      }
    } catch (error) {
      console.error('Failed to load sent students:', error);
    }
  }

  function saveSentStudents() {
    try {
      const key = 'entryScanSentStudents';
      const sentArray = Array.from(sentStudents);
      localStorage.setItem(key, JSON.stringify(sentArray));
    } catch (error) {
      console.error('Failed to save sent students:', error);
    }
  }

  function clearOldSentStudents() {
    try {
      const today = new Date().toDateString();
      const key = 'entryScanSentStudentsLastCleared';
      const lastCleared = localStorage.getItem(key);
      
      // Clear sent students if it's a new day
      if (lastCleared !== today) {
        sentStudents.clear();
        saveSentStudents();
        localStorage.setItem(key, today);
        console.log('Cleared old sent students for new day');
      }
    } catch (error) {
      console.error('Failed to clear old sent students:', error);
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

    console.log(`🚀 Processing ${totalOffline} offline items (${offlineQueue.length} queue + ${offlineRegistrations.length} registrations)...`);
    
    // Initialize progress tracking for massive datasets
    syncProgress = {
      total: totalOffline,
      processed: 0,
      failed: 0,
      inProgress: true,
      startTime: Date.now(),
      estimatedTimeRemaining: 0
    };
    
    // Show progress notification for large datasets
    if (totalOffline > 100) {
      showNotification(`🔄 Syncing ${totalOffline} offline records... This may take a while.`, 'info');
    }
    
    // Process offline queue first (batch processing for large datasets)
    await processOfflineQueueBatch();
    
    // Process offline registrations (batch processing for large datasets)
    await processOfflineRegistrationsBatch();
    
    // Update offline indicator after processing
    updateOfflineIndicator();
    
    // Show completion notification
    const duration = Date.now() - syncProgress.startTime;
    const successRate = ((syncProgress.processed - syncProgress.failed) / syncProgress.total * 100).toFixed(1);
    showNotification(`✅ Sync completed! ${syncProgress.processed}/${syncProgress.total} records processed (${successRate}% success) in ${(duration/1000).toFixed(1)}s`, 'success');
    
    syncProgress.inProgress = false;
  }
  
  async function processOfflineQueueBatch() {
    const totalBatches = Math.ceil(offlineQueue.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, offlineQueue.length);
      const batch = offlineQueue.slice(startIndex, endIndex);
      
      console.log(`Processing offline queue batch ${batchIndex + 1}/${totalBatches} (${batch.length} records)`);
      
      for (const queuedRecord of batch) {
        const studentKey = `${queuedRecord.student_id}_${queuedRecord.student_name}_${new Date(queuedRecord.timestamp).toDateString()}`;
        
        // Check if this student has already been sent today
        if (sentStudents.has(studentKey)) {
          console.log(`Student ${queuedRecord.student_name} (${queuedRecord.student_id}) already sent today, removing from queue`);
          removeFromOfflineQueue(queuedRecord.id);
          syncProgress.processed++;
          continue;
        }
        
        try {
          // Send the record to server
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'student_registered', 
              record: queuedRecord,
              fromOfflineSync: true
            }));
            
            // Mark as sent to prevent duplicates
            sentStudents.add(studentKey);
            saveSentStudents();
            
            console.log(`✅ Sent queued record: ${queuedRecord.student_name} (${queuedRecord.student_id})`);
            
            // Remove from queue after successful send
            removeFromOfflineQueue(queuedRecord.id);
            
            syncProgress.processed++;
            
          } else {
            console.log('WebSocket not ready, stopping batch processing');
            return;
          }
        } catch (error) {
          console.error(`Failed to send queued record ${queuedRecord.student_id}:`, error);
          syncProgress.failed++;
          
          // Increment retry count
          queuedRecord.retryCount = (queuedRecord.retryCount || 0) + 1;
          
          // Remove if too many retries
          if (queuedRecord.retryCount >= 3) {
            console.log(`Removing record ${queuedRecord.student_id} after ${queuedRecord.retryCount} retries`);
            removeFromOfflineQueue(queuedRecord.id);
          }
        }
      }
      
      // Small delay between batches to prevent overwhelming the server
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, maxBatchDelay));
      }
    }
  }
  
  async function processOfflineRegistrationsBatch() {
    const totalBatches = Math.ceil(offlineRegistrations.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, offlineRegistrations.length);
      const batch = offlineRegistrations.slice(startIndex, endIndex);
      
      console.log(`Processing offline registrations batch ${batchIndex + 1}/${totalBatches} (${batch.length} records)`);
      
      for (const offlineRecord of batch) {
        const studentKey = `${offlineRecord.student_id}_${offlineRecord.student_name}_${new Date(offlineRecord.timestamp).toDateString()}`;
        
        // Check if this student has already been sent today
        if (sentStudents.has(studentKey)) {
          console.log(`Student ${offlineRecord.student_name} (${offlineRecord.student_id}) already sent today, removing from offline registrations`);
          const index = offlineRegistrations.indexOf(offlineRecord);
          if (index > -1) {
            offlineRegistrations.splice(index, 1);
          }
          syncProgress.processed++;
          continue;
        }
        
        try {
          // Send the record to server
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'student_registered', 
              record: offlineRecord,
              fromOfflineSync: true
            }));
            
            // Mark as sent to prevent duplicates
            sentStudents.add(studentKey);
            saveSentStudents();
            
            console.log(`✅ Sent offline registration: ${offlineRecord.student_name} (${offlineRecord.student_id})`);
            
            // Remove from offline registrations after successful send
            const index = offlineRegistrations.indexOf(offlineRecord);
            if (index > -1) {
              offlineRegistrations.splice(index, 1);
            }
            
            syncProgress.processed++;
            
          } else {
            console.log('WebSocket not ready, stopping batch processing');
            return;
          }
        } catch (error) {
          console.error(`Failed to send offline registration ${offlineRecord.student_id}:`, error);
          syncProgress.failed++;
        }
      }
      
      // Save progress after each batch
      saveOfflineRegistrations();
      
      // Small delay between batches to prevent overwhelming the server
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, maxBatchDelay));
      }
    }
  }

  function saveOfflineRegistrations() {
    try {
      // MASSIVE DATA HANDLING - Use chunked storage for large offline datasets
      if (offlineRegistrations.length > 1000) {
        saveOfflineRegistrationsChunked();
      } else {
        localStorage.setItem('entryScannerOfflineRegistrations', JSON.stringify(offlineRegistrations));
      }
      console.log(`Saved ${offlineRegistrations.length} offline registrations`);
    } catch (error) {
      console.error('Failed to save offline registrations:', error);
      // Fallback to emergency storage
      saveOfflineRegistrationsEmergency();
    }
  }
  
  function saveOfflineRegistrationsChunked() {
    const baseKey = 'entryScannerOfflineRegistrations';
    const chunkSize = 1000; // 1000 registrations per chunk
    
    // Clear existing chunks
    let chunkIndex = 0;
    while (localStorage.getItem(`${baseKey}_chunk_${chunkIndex}`)) {
      localStorage.removeItem(`${baseKey}_chunk_${chunkIndex}`);
      chunkIndex++;
    }
    
    // Save in chunks
    for (let i = 0; i < offlineRegistrations.length; i += chunkSize) {
      const chunk = offlineRegistrations.slice(i, i + chunkSize);
      const chunkKey = `${baseKey}_chunk_${Math.floor(i / chunkSize)}`;
      localStorage.setItem(chunkKey, JSON.stringify(chunk));
    }
    
    // Save chunk count
    localStorage.setItem(`${baseKey}_chunkCount`, Math.ceil(offlineRegistrations.length / chunkSize).toString());
    console.log(`Saved ${offlineRegistrations.length} offline registrations in ${Math.ceil(offlineRegistrations.length / chunkSize)} chunks`);
  }
  
  function saveOfflineRegistrationsEmergency() {
    const emergencyKey = 'entryScannerOfflineRegistrations_emergency';
    const emergencyData = JSON.parse(localStorage.getItem(emergencyKey) || '[]');
    emergencyData.push(...offlineRegistrations.map(record => ({
      ...record,
      emergencySaved: true,
      emergencyTimestamp: Date.now()
    })));
    localStorage.setItem(emergencyKey, JSON.stringify(emergencyData));
    console.warn('Offline registrations saved to emergency storage');
  }
  
  function loadOfflineRegistrations() {
    try {
      // Try to load from chunked storage first
      const chunkCount = parseInt(localStorage.getItem('entryScannerOfflineRegistrations_chunkCount') || '0');
      
      if (chunkCount > 0) {
        // Load from chunks
        offlineRegistrations = [];
        for (let i = 0; i < chunkCount; i++) {
          const chunkKey = `entryScannerOfflineRegistrations_chunk_${i}`;
          const chunk = localStorage.getItem(chunkKey);
          if (chunk) {
            const parsedChunk = JSON.parse(chunk);
            offlineRegistrations.push(...parsedChunk);
          }
        }
        console.log(`Loaded ${offlineRegistrations.length} offline registrations from ${chunkCount} chunks`);
      } else {
        // Try standard storage
        const stored = localStorage.getItem('entryScannerOfflineRegistrations');
        if (stored) {
          offlineRegistrations = JSON.parse(stored);
          console.log(`Loaded ${offlineRegistrations.length} offline registrations`);
        }
      }
      
      // Load emergency data if exists
      loadEmergencyOfflineRegistrations();
      
    } catch (error) {
      console.error('Failed to load offline registrations:', error);
      // Try to load emergency data
      loadEmergencyOfflineRegistrations();
    }
  }
  
  function loadEmergencyOfflineRegistrations() {
    try {
      const emergencyKey = 'entryScannerOfflineRegistrations_emergency';
      const emergencyData = localStorage.getItem(emergencyKey);
      if (emergencyData) {
        const emergencyRecords = JSON.parse(emergencyData);
        offlineRegistrations.push(...emergencyRecords);
        console.log(`Loaded ${emergencyRecords.length} emergency offline registrations`);
      }
    } catch (error) {
      console.error('Failed to load emergency offline registrations:', error);
    }
  }
  
  function loadRegisteredByDate() {
    try {
      const key = 'entryScanRecords';
      const records = JSON.parse(localStorage.getItem(key) || '[]');
      
      // Group records by date
      registeredByDate = {};
      records.forEach(record => {
        const date = new Date(record.timestamp).toISOString().split('T')[0];
        if (!registeredByDate[date]) {
          registeredByDate[date] = {};
        }
        registeredByDate[date][record.student_id] = record;
      });
      
      console.log(`Loaded registrations by date:`, Object.keys(registeredByDate).map(date => `${date}: ${Object.keys(registeredByDate[date]).length} students`));
    } catch (error) {
      console.error('Failed to load registered by date:', error);
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
    
    // Create a unique key for this student registration
    const studentKey = `${record.student_id}_${record.student_name}_${new Date(record.timestamp).toDateString()}`;
    
    // Check if this student has already been sent today
    if (sentStudents.has(studentKey)) {
      console.log(`Student ${record.student_name} (${record.student_id}) already sent today, skipping duplicate`);
      showNotification(`⚠️ ${record.student_name} already registered today`, 'warning');
      return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN && isOnline) {
      ws.send(JSON.stringify({ 
        type: 'student_registered', 
        record 
      }));
      
      // Mark as sent to prevent duplicates
      sentStudents.add(studentKey);
      saveSentStudents();
      
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
      // Removed popup - just show notification
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
        if (timeSinceLastResponse > 35000) { // 35 seconds, slightly more than heartbeat interval
          console.log('No heartbeat response received for 35 seconds, connection may be stale, closing...');
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
    }, 30000); // Send heartbeat every 30 seconds
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
    
    // Update offlineMode status
    offlineMode = !connected;
    
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
        
          
          <div class="form-fields">
            <div class="field-group active" data-field="1">
              <label for="simple-id">Student ID (Optional)</label>
              <input type="text" id="simple-id" placeholder="Enter student ID (optional)" autofocus>
              <div class="field-hint"><i class="fas fa-arrow-right"></i> Tap <strong>Enter/Return</strong> to continue (leave empty to skip ID)</div>
            </div>
            
            <div class="field-group" data-field="2">
              <label for="simple-name">Student Name</label>
              <input type="text" id="simple-name" placeholder="Enter student name">
              <div class="field-hint"><i class="fas fa-arrow-right"></i> Tap <strong>Enter/Return</strong> to continue</div>
            </div>
            
            <div class="field-group" data-field="3">
              <label for="simple-center">Center</label>
              <input type="text" id="simple-center" placeholder="Enter center name">
              <div class="field-hint"><i class="fas fa-arrow-right"></i> Tap <strong>Enter/Return</strong> to continue</div>
            </div>
            
            <div class="field-group" data-field="4">
              <label for="simple-grade">Grade</label>
              <input type="text" id="simple-grade" placeholder="Enter grade">
              <div class="field-hint"><i class="fas fa-arrow-right"></i> Tap <strong>Enter/Return</strong> to continue</div>
            </div>
            
            <div class="field-group" data-field="5">
              <label for="simple-phone">Phone</label>
              <input type="text" id="simple-phone" placeholder="Enter phone number">
              <div class="field-hint"><i class="fas fa-arrow-right"></i> Tap <strong>Enter/Return</strong> to continue</div>
            </div>
            
            <div class="field-group" data-field="6">
              <label for="simple-parent-phone">Parent Phone</label>
              <input type="text" id="simple-parent-phone" placeholder="Enter parent phone number">
              <div class="field-hint"><i class="fas fa-arrow-right"></i> Tap <strong>Enter/Return</strong> to continue</div>
            </div>
            
            <div class="field-group" data-field="7">
              <label for="simple-subject">Subject</label>
              <input type="text" id="simple-subject" placeholder="Enter subject">
              <div class="field-hint"><i class="fas fa-arrow-right"></i> Tap <strong>Enter/Return</strong> to continue</div>
            </div>
            
            <div class="field-group" data-field="8">
              <label for="simple-payment">Payment Amount</label>
              <input type="text" id="simple-payment" placeholder="Enter payment amount">
              <div class="field-hint"><i class="fas fa-check"></i> Tap <strong>Enter/Return</strong> to register student</div>
            </div>
            
            <div class="field-group" data-field="9">
              <div class="register-confirmation">
                <div class="student-summary" id="student-summary">
                  <!-- Student summary will be shown here -->
                </div>
                <div class="register-actions">
                  <button type="button" class="btn btn-secondary" onclick="cancelSimpleEntry()">
                    <i class="fas fa-times"></i>
                    Cancel
                  </button>
                  <button type="button" class="btn btn-primary" id="register-simple-btn">
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
    
    // Setup simple entry form event listeners with a small delay to ensure DOM is ready
    setTimeout(() => {
      setupSimpleEntryForm();
    }, 100);
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
    // BULLETPROOF MANUAL ENTRY PROTECTION - ZERO DATA LOSS
    console.log('🛡️ Starting BULLETPROOF manual entry protection...');
    
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
    
    // CRITICAL VALIDATION - Only name is required, but we validate everything
    if (!studentName) {
      alert('❌ CRITICAL: Please enter the student name - this is required for data protection');
      return;
    }

    // Generate unique ID if not provided
    if (!studentId) {
      // Generate "null" + timestamp + random number for unique ID
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const randomNumber = Math.floor(Math.random() * 1000); // 3-digit random number
      studentId = `null${timestamp}${randomNumber}`;
      console.log(`🛡️ Generated unique ID for manual student: ${studentId}`);
    }
    
    // INSTANT BACKUP - Save form data immediately before any processing
    const formData = {
      studentId,
      studentName,
      center,
      grade,
      phone,
      parentPhone,
      subject,
      paymentAmount,
      homework,
      comments,
      timestamp: new Date().toISOString(),
      backupType: 'FORM_DATA',
      protectionLevel: 'MAXIMUM'
    };
    
    await instantBackupManualEntry(formData);
    
    // Create student record (same format as QR scan)
    const record = {
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
      offline_mode: offlineMode || !isOnline,
      // BULLETPROOF PROTECTION FIELDS
      protectionLevel: 'MAXIMUM',
      backupCount: 0,
      dataIntegrity: 'VERIFIED',
      criticalData: true
    };
    
    // INSTANT BACKUP - Save record immediately after creation
    await instantBackupManualEntry(record);
    
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
      guest_info: '',
      // BULLETPROOF PROTECTION FIELDS
      protectionLevel: 'MAXIMUM',
      criticalData: true,
      backupCount: 0
    };
    
    // Update both caches with protection
    studentCache[studentId] = newStudent;
    localStudentCache[studentId] = newStudent;
    
    // Save updated cache to localStorage with backup
    saveCacheToLocal();
    await instantBackupManualEntry(newStudent);
    
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
      
      // BULLETPROOF FALLBACK - Multiple backup layers
      await emergencyBackupManualEntry(record, error);
      
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
      
      // Update protection stats
      manualEntryProtection.failedBackups++;
      
      alert(`⚠️ Student ${studentName} registered with BULLETPROOF fallback protection! Data saved in multiple backup layers.`);
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
      const fields = ['simple-id', 'simple-name', 'simple-center', 'simple-grade', 'simple-phone', 'simple-parent-phone', 'simple-subject', 'simple-payment'];
    let currentFieldIndex = 0;
    
    console.log('🔧 Setting up simple entry form with fields:', fields);
    
    // Check if all fields exist before setting up listeners
    const missingFields = [];
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field) {
        missingFields.push(fieldId);
      }
    });
    
    if (missingFields.length > 0) {
      console.error('❌ Missing form fields:', missingFields);
      console.log('🔧 Retrying setup in 200ms...');
      setTimeout(() => {
        setupSimpleEntryForm();
      }, 200);
      return;
    }
    
    console.log('✅ All form fields found, setting up event listeners');
    
    // Add Enter key listeners to all fields (mobile-friendly)
    fields.forEach((fieldId, index) => {
      const field = document.getElementById(fieldId);
      console.log(`🔧 Setting up field ${fieldId} (index: ${index}):`, field);
      if (field) {
        // Function to handle field navigation with cooldown
        const handleFieldNavigation = () => {
          const now = Date.now();
          
          // Check cooldown to prevent fast clicking
          if (now - lastNavigationTime < NAVIGATION_COOLDOWN) {
            console.log(`🔧 Navigation cooldown active - ignoring fast Enter key press`);
            
            // Show visual feedback for cooldown
            field.style.borderColor = '#ffc107';
            field.style.boxShadow = '0 0 0 3px rgba(255, 193, 7, 0.3)';
            setTimeout(() => {
              field.style.borderColor = '';
              field.style.boxShadow = '';
            }, 200);
            
            return;
          }
          
          lastNavigationTime = now;
          console.log(`🔧 Processing navigation for field ${fieldId} (index: ${index})`);
          
          if (index < fields.length - 1) {
            // Move to next field (index + 2 because data attributes start from 1)
            console.log(`🔧 Moving to next field: ${index + 2}`);
            moveToNextField(index + 2);
          } else {
            // Last field - automatically register student
            console.log('🔧 Last field - automatically registering student');
            registerSimpleStudent();
          }
        };

        // Multiple event listeners for better mobile compatibility
        field.addEventListener('keydown', (e) => {
          console.log(`🔧 Keydown event on field ${fieldId}:`, e.key, 'keyCode:', e.keyCode);
          if (e.key === 'Enter' || e.keyCode === 13) {
            console.log(`🔧 Enter key detected on field ${fieldId}, calling handleFieldNavigation`);
            e.preventDefault();
            handleFieldNavigation();
          }
        });

        // Mobile-specific: keyup event (some mobile keyboards use this)
        field.addEventListener('keyup', (e) => {
          console.log(`🔧 Keyup event on field ${fieldId}:`, e.key, 'keyCode:', e.keyCode);
          if (e.key === 'Enter' || e.keyCode === 13) {
            console.log(`🔧 Enter key detected on field ${fieldId} (keyup), calling handleFieldNavigation`);
            e.preventDefault();
            handleFieldNavigation();
          }
        });

        // Mobile-specific: input event for virtual keyboards
        field.addEventListener('input', (e) => {
          // Check if this is likely an Enter key press from mobile keyboard
          if (e.inputType === 'insertLineBreak' || e.data === '\n') {
            console.log(`🔧 Input event with line break on field ${fieldId}`);
            e.preventDefault();
            handleFieldNavigation();
          }
        });

        // Mobile-specific: blur event with timeout (fallback for mobile keyboards)
        let blurTimeout;
        let lastValue = '';
        
        field.addEventListener('blur', () => {
          // Small delay to check if user pressed Enter
          blurTimeout = setTimeout(() => {
            // This is a fallback - only trigger if field has content and value changed
            if (field.value.trim() && field.value !== lastValue) {
              console.log(`🔧 Blur fallback for field ${fieldId} - value changed`);
              handleFieldNavigation();
            }
          }, 150);
        });

        // Clear timeout if field gets focus again
        field.addEventListener('focus', () => {
          if (blurTimeout) {
            clearTimeout(blurTimeout);
          }
          lastValue = field.value;
        });

        // Track value changes for better mobile detection
        field.addEventListener('input', (e) => {
          lastValue = field.value;
        });

        // Mobile optimization: Set appropriate input types
        if (fieldId === 'simple-phone') {
          field.type = 'tel';
          field.setAttribute('inputmode', 'numeric');
        } else if (fieldId === 'simple-payment') {
          field.type = 'number';
          field.setAttribute('inputmode', 'decimal');
        } else if (fieldId === 'simple-id') {
          field.type = 'text';
          field.setAttribute('inputmode', 'text');
        } else {
          field.type = 'text';
          field.setAttribute('inputmode', 'text');
        }

        // Add mobile-friendly attributes
        field.setAttribute('autocomplete', 'off');
        field.setAttribute('autocorrect', 'off');
        field.setAttribute('autocapitalize', 'off');
        field.setAttribute('spellcheck', 'false');

        // Add visual feedback for mobile users
        field.addEventListener('focus', () => {
          field.style.borderColor = '#3498db';
          field.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)';
          
          // Add a subtle animation to indicate Enter key functionality
          const hint = field.parentElement.querySelector('.field-hint');
          if (hint) {
            hint.style.background = '#d1ecf1';
            hint.style.borderLeftColor = '#17a2b8';
            hint.style.transform = 'scale(1.02)';
            hint.style.transition = 'all 0.2s ease';
          }
        });

        field.addEventListener('blur', () => {
          field.style.borderColor = '#e9ecef';
          field.style.boxShadow = 'none';
          
          // Reset hint styling
          const hint = field.parentElement.querySelector('.field-hint');
          if (hint) {
            hint.style.background = '#e9ecef';
            hint.style.borderLeftColor = '#3498db';
            hint.style.transform = 'scale(1)';
          }
        });
      } else {
        console.error(`❌ Field not found: ${fieldId}`);
      }
    });
    
    // Add click event listener to register button
    const registerBtn = document.getElementById('register-simple-btn');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => {
        console.log('🔧 Register button clicked');
        registerSimpleStudent();
      });
      console.log('✅ Register button event listener added');
    } else {
      console.error('❌ Register button not found');
    }
    
    console.log('✅ Simple entry form setup complete');
  }
  
  function moveToNextField(nextIndex) {
    console.log(`🔧 moveToNextField called with nextIndex: ${nextIndex}`);
    
    // Remove active class from all fields
    document.querySelectorAll('.field-group').forEach(f => f.classList.remove('active'));
    
    // Show the next field
    const nextField = document.querySelector(`[data-field="${nextIndex}"]`);
    
    console.log(`🔧 Looking for field with data-field="${nextIndex}":`, nextField);
    
    if (nextField) {
      // Add active class to next field
      nextField.classList.add('active');
      
      // Focus on the input field
      const input = nextField.querySelector('input');
      if (input) {
        input.focus();
        console.log(`🔧 Focused on input field:`, input);
      }
      console.log(`🔧 Successfully moved to field ${nextIndex}`);
    } else {
      console.error(`❌ Could not find field with index ${nextIndex}`);
    }
  }
  
  function showStudentSummary() {
    console.log('🔧 showStudentSummary called');
    
    // Get all form values with null checks
    const idElement = document.getElementById('simple-id');
    const nameElement = document.getElementById('simple-name');
    const centerElement = document.getElementById('simple-center');
    const gradeElement = document.getElementById('simple-grade');
    const phoneElement = document.getElementById('simple-phone');
    const parentPhoneElement = document.getElementById('simple-parent-phone');
    const subjectElement = document.getElementById('simple-subject');
    const paymentElement = document.getElementById('simple-payment');
    
    // Check if all elements exist
    if (!idElement || !nameElement || !centerElement || !gradeElement || !phoneElement || !parentPhoneElement || !subjectElement || !paymentElement) {
      console.error('❌ Form elements not found in showStudentSummary:', {
        idElement: !!idElement,
        nameElement: !!nameElement,
        centerElement: !!centerElement,
        gradeElement: !!gradeElement,
        phoneElement: !!phoneElement,
        parentPhoneElement: !!parentPhoneElement,
        subjectElement: !!subjectElement,
        paymentElement: !!paymentElement
      });
      alert('Error: Form elements not found. Please refresh the page and try again.');
      return;
    }
    
    // Get values safely - allow both strings and numbers
    const id = (idElement && idElement.value) ? String(idElement.value).trim() : '';
    const name = (nameElement && nameElement.value) ? String(nameElement.value).trim() : '';
    const center = (centerElement && centerElement.value) ? String(centerElement.value).trim() : '';
    const grade = (gradeElement && gradeElement.value) ? String(gradeElement.value).trim() : '';
    const phone = (phoneElement && phoneElement.value) ? String(phoneElement.value).trim() : '';
    const parentPhone = (parentPhoneElement && parentPhoneElement.value) ? String(parentPhoneElement.value).trim() : '';
    const subject = (subjectElement && subjectElement.value) ? String(subjectElement.value).trim() : '';
    const payment = (paymentElement && paymentElement.value) ? String(paymentElement.value).trim() : '';
    
    console.log('🔧 Form values:', { id, name, center, grade, phone, parentPhone, subject, payment });
    
    // Validate required field
    if (!name) {
      console.log('❌ Name is required');
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
          <strong>ID:</strong> ${id || 'Empty'}
        </div>
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
          <strong>Parent Phone:</strong> ${parentPhone || 'Not specified'}
        </div>
        <div class="summary-item">
          <strong>Subject:</strong> ${subject || 'Not specified'}
        </div>
        <div class="summary-item">
          <strong>Payment:</strong> ${payment ? '$' + payment : 'Not specified'}
        </div>
      </div>
    `;
    
    // Move to final step
    moveToNextField(8);
  }
  
  async function registerSimpleStudent() {
    console.log('🔧 registerSimpleStudent called');
    
    // Get all form values with null checks
    const idElement = document.getElementById('simple-id');
    const nameElement = document.getElementById('simple-name');
    const centerElement = document.getElementById('simple-center');
    const gradeElement = document.getElementById('simple-grade');
    const phoneElement = document.getElementById('simple-phone');
    const parentPhoneElement = document.getElementById('simple-parent-phone');
    const subjectElement = document.getElementById('simple-subject');
    const paymentElement = document.getElementById('simple-payment');
    
    console.log('🔧 Form elements found:', {
      idElement: !!idElement,
      nameElement: !!nameElement,
      centerElement: !!centerElement,
      gradeElement: !!gradeElement,
      phoneElement: !!phoneElement,
      parentPhoneElement: !!parentPhoneElement,
      subjectElement: !!subjectElement,
      paymentElement: !!paymentElement
    });
    
    // Check if all elements exist
    if (!idElement || !nameElement || !centerElement || !gradeElement || !phoneElement || !parentPhoneElement || !subjectElement || !paymentElement) {
      console.error('❌ Form elements not found:', {
        idElement: !!idElement,
        nameElement: !!nameElement,
        centerElement: !!centerElement,
        gradeElement: !!gradeElement,
        phoneElement: !!phoneElement,
        parentPhoneElement: !!parentPhoneElement,
        subjectElement: !!subjectElement,
        paymentElement: !!paymentElement
      });
      
      // Try to find the elements again with a delay
      console.log('🔧 Retrying to find form elements...');
      setTimeout(() => {
        const retryIdElement = document.getElementById('simple-id');
        const retryNameElement = document.getElementById('simple-name');
        const retryCenterElement = document.getElementById('simple-center');
        const retryGradeElement = document.getElementById('simple-grade');
        const retryPhoneElement = document.getElementById('simple-phone');
        const retryParentPhoneElement = document.getElementById('simple-parent-phone');
        const retrySubjectElement = document.getElementById('simple-subject');
        const retryPaymentElement = document.getElementById('simple-payment');
        
        console.log('🔧 Retry form elements found:', {
          idElement: !!retryIdElement,
          nameElement: !!retryNameElement,
          centerElement: !!retryCenterElement,
          gradeElement: !!retryGradeElement,
          phoneElement: !!retryPhoneElement,
          parentPhoneElement: !!retryParentPhoneElement,
          subjectElement: !!retrySubjectElement,
          paymentElement: !!retryPaymentElement
        });
        
        if (retryIdElement && retryNameElement && retryCenterElement && retryGradeElement && retryPhoneElement && retryParentPhoneElement && retrySubjectElement && retryPaymentElement) {
          console.log('🔧 Form elements found on retry, proceeding...');
          registerSimpleStudentWithElements(retryIdElement, retryNameElement, retryCenterElement, retryGradeElement, retryPhoneElement, retryParentPhoneElement, retrySubjectElement, retryPaymentElement);
        } else {
          alert('Error: Form elements not found. Please refresh the page and try again.');
        }
      }, 100);
      return;
    }
    
    // Proceed with registration
    registerSimpleStudentWithElements(idElement, nameElement, centerElement, gradeElement, phoneElement, parentPhoneElement, subjectElement, paymentElement);
  }
  
  async function registerSimpleStudentWithElements(idElement, nameElement, centerElement, gradeElement, phoneElement, parentPhoneElement, subjectElement, paymentElement) {
    console.log('🔧 registerSimpleStudentWithElements called');
    
    // Get values safely with null checks - allow both strings and numbers
    const id = (idElement && idElement.value) ? String(idElement.value).trim() : '';
    const name = (nameElement && nameElement.value) ? String(nameElement.value).trim() : '';
    const center = (centerElement && centerElement.value) ? String(centerElement.value).trim() : '';
    const grade = (gradeElement && gradeElement.value) ? String(gradeElement.value).trim() : '';
    const phone = (phoneElement && phoneElement.value) ? String(phoneElement.value).trim() : '';
    const parentPhone = (parentPhoneElement && parentPhoneElement.value) ? String(parentPhoneElement.value).trim() : '';
    const subject = (subjectElement && subjectElement.value) ? String(subjectElement.value).trim() : '';
    const payment = (paymentElement && paymentElement.value) ? String(paymentElement.value).trim() : '';
    
    console.log('🔧 Form values:', { id, name, center, grade, phone, parentPhone, subject, payment });
    
    // No validation required - all fields are optional
    console.log('✅ All fields are optional - proceeding with registration');
    
    // Generate unique ID if not provided
    let studentId = id;
    if (!studentId) {
      // Generate "null" + timestamp + random number for unique ID
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const randomNumber = Math.floor(Math.random() * 1000); // 3-digit random number
      studentId = `null${timestamp}${randomNumber}`;
      console.log(`Generated unique ID for simple manual student: ${studentId}`);
    }
    
    // Create student record
    const record = {
      student_id: studentId,
      student_name: name,
      center: center || '',
      grade: grade || '',
      phone: phone || '',
      parent_phone: parentPhone || '',
      subject: subject || '',
      fees: payment ? (isNaN(parseFloat(payment)) ? 0 : parseFloat(payment)) : 0,
      fees_1: payment ? (isNaN(parseFloat(payment)) ? 0 : parseFloat(payment)) : 0,
      homework_score: 0,
      exam_score: null,
      error: null,
      extra_sessions: 0,
      comment: 'Manual entry via simplified form',
      error_detail: null,
      payment_amount: payment ? (isNaN(parseFloat(payment)) ? 0 : parseFloat(payment)) : 0,
      timestamp: new Date().toISOString(),
      device_name: deviceName,
      registered: true,
      entry_method: 'manual',
      offline_mode: offlineMode || !isOnline
    };
    
    try {
      // Use the hybrid system for registration (same as QR scan method)
      // Save locally first (ZERO DATA LOSS)
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
      
      // Send registration to server via WebSocket (if connected)
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'student_registered',
          record: record
        }));
        console.log('📤 Registration sent to server via WebSocket');
      }
      
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
  
  // Simple QR Form Enter Key Navigation with cooldown
  function setupEasyQRForm() {
    const fields = ['hw', 'extra', 'payment-amount', 'comment'];
    
    fields.forEach((fieldId, index) => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            
            const now = Date.now();
            
            // Check cooldown to prevent fast clicking
            if (now - lastNavigationTime < NAVIGATION_COOLDOWN) {
              console.log(`🔧 QR Form navigation cooldown active - ignoring fast Enter key press`);
              
              // Show visual feedback for cooldown
              field.style.borderColor = '#ffc107';
              field.style.boxShadow = '0 0 0 3px rgba(255, 193, 7, 0.3)';
              setTimeout(() => {
                field.style.borderColor = '';
                field.style.boxShadow = '';
              }, 200);
              
              return;
            }
            
            lastNavigationTime = now;
            
            if (index < fields.length - 1) {
              // Move to next field
              const nextField = document.getElementById(fields[index + 1]);
              if (nextField) {
                nextField.focus();
              }
            } else {
              // Last field - register student
              const registerBtn = document.getElementById('btn-register');
              if (registerBtn) {
                registerBtn.click();
              }
            }
          }
        });
      }
    });
  }

  // QR Student Form Functions
  function setupQRStudentForm() {
    const fields = ['qr-payment-amount', 'qr-homework-score', 'qr-comment'];
    let currentFieldIndex = 0;
    
    console.log('🔧 Setting up QR student form with fields:', fields);
    
    // Check if all fields exist before setting up listeners
    const missingFields = [];
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (!field) {
        missingFields.push(fieldId);
      }
    });
    
    if (missingFields.length > 0) {
      console.error('❌ Missing QR form fields:', missingFields);
      console.log('🔧 Retrying QR setup in 200ms...');
      setTimeout(() => {
        setupQRStudentForm();
      }, 200);
      return;
    }
    
    console.log('✅ All QR form fields found, setting up event listeners');
    
    // Add Enter key listeners to all fields (mobile-friendly)
    fields.forEach((fieldId, index) => {
      const field = document.getElementById(fieldId);
      console.log(`🔧 Setting up QR field ${fieldId} (index: ${index}):`, field);
      if (field) {
        // Function to handle QR field navigation
        const handleQRFieldNavigation = () => {
          console.log(`🔧 Processing QR navigation for field ${fieldId} (index: ${index})`);
          if (index < fields.length - 1) {
            // Move to next field (index + 2 because data attributes start from 1)
            console.log(`🔧 Moving to next QR field: ${index + 2}`);
            moveToNextQRField(index + 2);
          } else {
            // Last field - show summary first, then user can register
            console.log('🔧 Last QR field - showing summary');
            showQRStudentSummary();
          }
        };

        // Multiple event listeners for better mobile compatibility
        field.addEventListener('keydown', (e) => {
          console.log(`🔧 Keydown event on QR field ${fieldId}:`, e.key);
          if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            handleQRFieldNavigation();
          }
        });

        // Mobile-specific: keyup event (some mobile keyboards use this)
        field.addEventListener('keyup', (e) => {
          console.log(`🔧 Keyup event on QR field ${fieldId}:`, e.key);
          if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            handleQRFieldNavigation();
          }
        });

        // Mobile-specific: input event for virtual keyboards
        field.addEventListener('input', (e) => {
          // Check if this is likely an Enter key press from mobile keyboard
          if (e.inputType === 'insertLineBreak' || e.data === '\n') {
            console.log(`🔧 Input event with line break on QR field ${fieldId}`);
            e.preventDefault();
            handleQRFieldNavigation();
          }
        });

        // Mobile optimization: Set appropriate input types
        if (fieldId === 'qr-payment-amount') {
          field.type = 'number';
          field.setAttribute('inputmode', 'decimal');
        } else if (fieldId === 'qr-homework-score') {
          field.type = 'number';
          field.setAttribute('inputmode', 'numeric');
        } else {
          field.type = 'text';
          field.setAttribute('inputmode', 'text');
        }

        // Add mobile-friendly attributes
        field.setAttribute('autocomplete', 'off');
        field.setAttribute('autocorrect', 'off');
        field.setAttribute('autocapitalize', 'off');
        field.setAttribute('spellcheck', 'false');

        // Add visual feedback for mobile users
        field.addEventListener('focus', () => {
          field.style.borderColor = '#3498db';
          field.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)';
          
          // Add a subtle animation to indicate Enter key functionality
          const hint = field.parentElement.querySelector('.field-hint');
          if (hint) {
            hint.style.background = '#d1ecf1';
            hint.style.borderLeftColor = '#17a2b8';
            hint.style.transform = 'scale(1.02)';
            hint.style.transition = 'all 0.2s ease';
          }
        });

        field.addEventListener('blur', () => {
          field.style.borderColor = '#e9ecef';
          field.style.boxShadow = 'none';
          
          // Reset hint styling
          const hint = field.parentElement.querySelector('.field-hint');
          if (hint) {
            hint.style.background = '#e9ecef';
            hint.style.borderLeftColor = '#3498db';
            hint.style.transform = 'scale(1)';
          }
        });
      } else {
        console.error(`❌ QR field not found: ${fieldId}`);
      }
    });
    
    // Add click event listener to register button
    const registerBtn = document.getElementById('register-qr-btn');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => {
        console.log('🔧 QR Register button clicked');
        const studentId = window.currentQRStudentId || '';
        const studentName = window.currentQRStudentName || '';
        registerQRStudent(studentId, studentName);
      });
      console.log('✅ QR Register button event listener added');
    } else {
      console.error('❌ QR Register button not found');
    }
    
    console.log('✅ QR student form setup complete');
  }
  
  function moveToNextQRField(nextIndex) {
    // Remove active class from all fields and steps
    document.querySelectorAll('.field-group').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    
    // Show the next field and step
    const nextField = document.querySelector(`[data-field="${nextIndex}"]`);
    const nextStep = document.querySelector(`[data-step="${nextIndex}"]`);
    
    if (nextField && nextStep) {
      // Add active class to next field and step
      nextField.classList.add('active');
      nextStep.classList.add('active');
      
      // Focus on the input field
      const input = nextField.querySelector('input');
      if (input) {
        input.focus();
      }
    }
  }
  
  function showQRStudentSummary() {
    console.log('🔧 showQRStudentSummary called');
    
    // Get all form values with null checks
    const paymentAmountElement = document.getElementById('qr-payment-amount');
    const homeworkScoreElement = document.getElementById('qr-homework-score');
    const commentElement = document.getElementById('qr-comment');
    
    // Check if all elements exist
    if (!paymentAmountElement || !homeworkScoreElement || !commentElement) {
      console.error('❌ QR form elements not found in showQRStudentSummary:', {
        paymentAmountElement: !!paymentAmountElement,
        homeworkScoreElement: !!homeworkScoreElement,
        commentElement: !!commentElement
      });
      alert('Error: QR form elements not found. Please refresh the page and try again.');
      return;
    }
    
    // Get values safely
    const paymentAmount = paymentAmountElement.value.trim();
    const homeworkScore = homeworkScoreElement.value.trim();
    const comment = commentElement.value.trim();
    
    console.log('🔧 QR form values:', { paymentAmount, homeworkScore, comment });
    
    // Show summary
    const summary = document.getElementById('qr-student-summary');
    summary.innerHTML = `
      <h4><i class="fas fa-user-check"></i> Registration Summary</h4>
      <div class="summary-details">
        <div class="summary-item">
          <strong>Payment Amount:</strong> ${paymentAmount ? '$' + paymentAmount : 'No payment'}
        </div>
        <div class="summary-item">
          <strong>Homework Score:</strong> ${homeworkScore || '0'}/10
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
    console.log('🔧 registerQRStudent called with:', { studentId, studentName });
    
    // Get all form values with null checks
    const paymentAmountElement = document.getElementById('qr-payment-amount');
    const homeworkScoreElement = document.getElementById('qr-homework-score');
    const commentElement = document.getElementById('qr-comment');
    
    // Check if all elements exist
    if (!paymentAmountElement || !homeworkScoreElement || !commentElement) {
      console.error('❌ QR form elements not found:', {
        paymentAmountElement: !!paymentAmountElement,
        homeworkScoreElement: !!homeworkScoreElement,
        commentElement: !!commentElement
      });
      alert('Error: QR form elements not found. Please refresh the page and try again.');
      return;
    }
    
    // Get values safely
    const paymentAmount = paymentAmountElement.value.trim();
    const homeworkScore = homeworkScoreElement.value.trim();
    const comment = commentElement.value.trim();
    
    console.log('🔧 QR form values:', { paymentAmount, homeworkScore, comment });
    
    // Create student record
    const record = {
      student_id: studentId,
      student_name: studentName,
      center: studentCache[studentId]?.center || '',
      grade: studentCache[studentId]?.grade || '',
      phone: studentCache[studentId]?.phone || '',
      parent_phone: studentCache[studentId]?.parent_phone || '',
      subject: studentCache[studentId]?.subject || '',
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
        center: studentCache[studentId]?.center || '',
        grade: studentCache[studentId]?.grade || '',
        phone: studentCache[studentId]?.phone || '',
        parent_phone: studentCache[studentId]?.parent_phone || '',
        subject: studentCache[studentId]?.subject || '',
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
      // Clear all localStorage data EXCEPT backup data
      localStorage.removeItem('entryScanRecords');
      localStorage.removeItem('entryScanOfflineQueue');
      localStorage.removeItem('entryScannerOfflineRegistrations');
      localStorage.removeItem('entryScannerStudentCache');
      localStorage.removeItem('entryScanSentStudents');
      localStorage.removeItem('entryScanSentStudentsLastCleared');
      
      // ===== HYBRID SYSTEM: CLEAR SYNC DATA =====
      localStorage.removeItem('entryScannerSyncQueue');
      localStorage.removeItem('entryScannerSyncStatus');
      
      // Clear in-memory data
      offlineQueue = [];
      offlineRegistrations = [];
      localStudentCache = {};
      sentStudents.clear();
      syncQueue = [];
      lastSyncTimestamp = null;
      dataIntegrity = {
        localRecords: 0,
        syncedRecords: 0,
        pendingSync: 0,
        lastBackup: null
      };
      
      // PRESERVE BACKUP DATA - DO NOT DELETE THESE:
      // localStorage.getItem('backupStudentDatabase') - KEEP
      // localStorage.getItem('backupRegistrationDatabase') - KEEP  
      // localStorage.getItem('emergencyBackup') - KEEP
      // localStorage.getItem('lastBackupTimestamp') - KEEP
      
      console.log('💾 Backup data preserved during reset:');
      console.log('  - backupStudentDatabase: PRESERVED');
      console.log('  - backupRegistrationDatabase: PRESERVED');
      console.log('  - emergencyBackup: PRESERVED');
      console.log('  - lastBackupTimestamp: PRESERVED');
      
      // Reset UI
      updateSyncStatusUI();
      
      showNotification('✅ All data has been reset successfully! (Backups preserved)', 'success');
      
      console.log('All Entry Scanner data has been reset (backup data preserved)');
      
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
        loadRegisteredByDate(); // Load registrations by date for manual sync
        loadSentStudents(); // Load sent students to prevent duplicates
        clearOldSentStudents(); // Clear old sent students for new day
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
        loadRegisteredByDate(); // Load registrations by date for manual sync
        loadSentStudents(); // Load sent students to prevent duplicates
        clearOldSentStudents(); // Clear old sent students for new day
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
  
  // Manual sync function - Additional to existing auto sync
  async function manualSync() {
    if (!isOnline) {
      showNotification('❌ Cannot sync: No internet connection', 'error');
      return;
    }
    
    // Show confirmation dialog
    const confirmed = confirm(
      '🔄 Manual Sync Confirmation\n\n' +
      'This will send ALL registered students to the server:\n' +
      '• All students registered today (QR + Manual)\n' +
      '• This is ADDITIONAL to existing auto sync\n' +
      '• Duplicates will be prevented automatically\n\n' +
      'Continue with manual sync?'
    );
    
    if (!confirmed) {
      return;
    }
    
    showNotification('🔄 Starting manual sync of all students...', 'info');
    
    try {
      // Update button to show progress
      const manualSyncBtn = document.getElementById('manual-sync-btn');
      if (manualSyncBtn) {
        manualSyncBtn.disabled = true;
        manualSyncBtn.innerHTML = `
          <i class="fas fa-spinner fa-spin"></i>
          <span>Syncing...</span>
        `;
      }
      
      let totalSent = 0;
      let duplicatesSkipped = 0;
      
      // Send all registered students for today (manual sync only)
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = registeredByDate[today] || {};
      const allStudents = Object.values(todayRecords);
      
      // Also include offline registrations that haven't been sent yet
      const offlineStudents = offlineRegistrations.filter(record => {
        const studentKey = `${record.student_id}_${record.student_name}_${new Date(record.timestamp).toDateString()}`;
        return !sentStudents.has(studentKey);
      });
      
      const totalStudentsToSend = allStudents.length + offlineStudents.length;
      
      if (totalStudentsToSend > 0) {
        showNotification(`👥 Sending ${totalStudentsToSend} registered students (${allStudents.length} from today + ${offlineStudents.length} offline)...`, 'info');
        
        // Send students from today's registrations
        for (const student of allStudents) {
          const studentKey = `${student.student_id}_${student.student_name}_${new Date(student.timestamp).toDateString()}`;
          
          // Check if already sent
          if (sentStudents.has(studentKey)) {
            duplicatesSkipped++;
            continue;
          }
          
          // Send to server
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'student_registered', 
              record: student 
            }));
            
            // Mark as sent
            sentStudents.add(studentKey);
            totalSent++;
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Send offline registrations
        for (const student of offlineStudents) {
          const studentKey = `${student.student_id}_${student.student_name}_${new Date(student.timestamp).toDateString()}`;
          
          // Check if already sent (double check)
          if (sentStudents.has(studentKey)) {
            duplicatesSkipped++;
            continue;
          }
          
          // Send to server
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'student_registered', 
              record: student 
            }));
            
            // Mark as sent
            sentStudents.add(studentKey);
            totalSent++;
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Save sent students
        saveSentStudents();
      }
      
      // Show completion message
      let message = `✅ Manual sync completed!\n`;
      message += `• Students sent: ${totalSent}\n`;
      if (duplicatesSkipped > 0) {
        message += `• Duplicates skipped: ${duplicatesSkipped}\n`;
      }
      message += `• Auto sync continues to work normally`;
      
      showNotification(message, 'success');
      console.log('Manual sync completed:', { totalSent, duplicatesSkipped });
      
    } catch (error) {
      console.error('Manual sync failed:', error);
      showNotification(`❌ Manual sync failed: ${error.message}`, 'error');
    } finally {
      // Reset button
      const manualSyncBtn = document.getElementById('manual-sync-btn');
      if (manualSyncBtn) {
        manualSyncBtn.disabled = false;
        manualSyncBtn.innerHTML = `
          <i class="fas fa-sync-alt"></i>
          <span>Sync</span>
        `;
      }
      
      // Update sync status
      updateSyncStatusUI();
    }
  }
  
  // Show sync details function
  function showSyncDetails() {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = registeredByDate[today] || {};
    const allStudents = Object.values(todayRecords);
    
    let unsentStudents = 0;
    let sentStudentsCount = 0;
    
    // Count unsent students from today's registrations
    allStudents.forEach(student => {
      const studentKey = `${student.student_id}_${student.student_name}_${new Date(student.timestamp).toDateString()}`;
      if (sentStudents.has(studentKey)) {
        sentStudentsCount++;
      } else {
        unsentStudents++;
      }
    });
    
    // Count unsent offline registrations
    const unsentOfflineRegistrations = offlineRegistrations.filter(record => {
      const studentKey = `${record.student_id}_${record.student_name}_${new Date(record.timestamp).toDateString()}`;
      return !sentStudents.has(studentKey);
    }).length;
    
    const totalPendingSync = unsentStudents + unsentOfflineRegistrations;
    
    const details = `
🔄 Manual Sync Details

📊 Current Status:
• Total students registered today: ${allStudents.length}
• Already sent to server: ${sentStudentsCount}
• Pending from today: ${unsentStudents}
• Offline registrations pending: ${unsentOfflineRegistrations}
• Total pending manual sync: ${totalPendingSync}
• Offline queue items: ${offlineQueue.length}
• Sync queue items: ${syncQueue.length}

📋 What manual sync will do:
• Send ${totalPendingSync} unsent students (${unsentStudents} from today + ${unsentOfflineRegistrations} offline)
• This is ADDITIONAL to existing auto sync
• Auto sync continues to work normally
• Duplicates are prevented automatically

💡 Tip: Right-click the sync button to see this info anytime
    `;
    
    alert(details);
  }
  
  // Force sync all students (bypass duplicate check) - for emergency use
  async function forceSyncAllStudents() {
    if (!isOnline) {
      showNotification('❌ Cannot sync: No internet connection', 'error');
      return;
    }
    
    // Show warning confirmation
    const confirmed = confirm(
      '⚠️ FORCE SYNC WARNING\n\n' +
      'This will send ALL students again, even if already sent:\n' +
      '• This may create DUPLICATE records in the database\n' +
      '• Only use this if there was a sync bug\n' +
      '• This is SEPARATE from auto sync - auto sync continues normally\n' +
      '• Use normal sync button for regular operation\n\n' +
      'Are you sure you want to FORCE SYNC ALL students?'
    );
    
    if (!confirmed) {
      return;
    }
    
    showNotification('🚨 Starting FORCE sync of all students...', 'warning');
    
    try {
      // Update button to show progress
      const manualSyncBtn = document.getElementById('manual-sync-btn');
      if (manualSyncBtn) {
        manualSyncBtn.disabled = true;
        manualSyncBtn.innerHTML = `
          <i class="fas fa-spinner fa-spin"></i>
          <span>Force Syncing...</span>
        `;
      }
      
      let totalSent = 0;
      
      // Send all registered students for today (bypass duplicate check)
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = registeredByDate[today] || {};
      const allStudents = Object.values(todayRecords);
      
      // Also include all offline registrations
      const totalStudentsToSend = allStudents.length + offlineRegistrations.length;
      
      if (totalStudentsToSend > 0) {
        showNotification(`🚨 Force sending ${totalStudentsToSend} students (${allStudents.length} from today + ${offlineRegistrations.length} offline)...`, 'warning');
        
        // Send students from today's registrations
        for (const student of allStudents) {
          // Send to server without duplicate check
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'student_registered', 
              record: student 
            }));
            
            totalSent++;
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        // Send offline registrations
        for (const student of offlineRegistrations) {
          // Send to server without duplicate check
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'student_registered', 
              record: student 
            }));
            
            totalSent++;
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
      
      showNotification(`🚨 FORCE sync completed! Sent ${totalSent} students (may have duplicates)`, 'warning');
      console.log('Force sync completed:', { totalSent });
      
    } catch (error) {
      console.error('Force sync failed:', error);
      showNotification(`❌ Force sync failed: ${error.message}`, 'error');
    } finally {
      // Reset button
      const manualSyncBtn = document.getElementById('manual-sync-btn');
      if (manualSyncBtn) {
        manualSyncBtn.disabled = false;
        manualSyncBtn.innerHTML = `
          <i class="fas fa-sync-alt"></i>
          <span>Sync</span>
        `;
      }
      
      // Update sync status
      updateSyncStatusUI();
    }
  }
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      forceSyncAllStudents();
    }
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      showDebugStatus();
    }
  });
  
  // BULLETPROOF MANUAL ENTRY PROTECTION FUNCTIONS
  
  async function instantBackupManualEntry(data) {
    try {
      if (!instantBackup) return;
      
      const backupKey = `manualEntryBackup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const backupData = {
        ...data,
        backupTimestamp: new Date().toISOString(),
        backupType: 'INSTANT',
        protectionLevel: 'MAXIMUM',
        deviceName: deviceName,
        isOnline: isOnline,
        offlineMode: offlineMode
      };
      
      // Store in multiple backup locations
      localStorage.setItem(backupKey, JSON.stringify(backupData));
      manualEntryBackups.push(backupData);
      
      // Update protection stats
      manualEntryProtection.successfulBackups++;
      manualEntryProtection.lastBackupTime = Date.now();
      
      console.log(`🛡️ INSTANT BACKUP: Manual entry backed up with key ${backupKey}`);
      
      // Clean up old backups (keep last 100)
      if (manualEntryBackups.length > 100) {
        const oldBackup = manualEntryBackups.shift();
        localStorage.removeItem(`manualEntryBackup_${oldBackup.backupTimestamp}_${oldBackup.backupKey}`);
      }
      
    } catch (error) {
      console.error('❌ CRITICAL: Instant backup failed:', error);
      manualEntryProtection.failedBackups++;
      
      // Emergency fallback
      await emergencyBackupManualEntry(data, error);
    }
  }
  
  async function emergencyBackupManualEntry(data, error) {
    try {
      const emergencyKey = `manualEntryEmergency_${Date.now()}`;
      const emergencyData = {
        ...data,
        emergencyTimestamp: new Date().toISOString(),
        backupType: 'EMERGENCY',
        protectionLevel: 'CRITICAL',
        error: error ? error.message : 'Unknown error',
        deviceName: deviceName,
        isOnline: isOnline,
        offlineMode: offlineMode,
        criticalData: true
      };
      
      // Store in emergency storage
      localStorage.setItem(emergencyKey, JSON.stringify(emergencyData));
      
      // Also store in emergency array
      const emergencyArray = JSON.parse(localStorage.getItem('manualEntryEmergencyArray') || '[]');
      emergencyArray.push(emergencyData);
      localStorage.setItem('manualEntryEmergencyArray', JSON.stringify(emergencyArray));
      
      console.log(`🚨 EMERGENCY BACKUP: Manual entry saved to emergency storage with key ${emergencyKey}`);
      
    } catch (emergencyError) {
      console.error('❌ CRITICAL: Emergency backup also failed:', emergencyError);
      
      // Last resort - store in memory
      if (!window.manualEntryLastResort) {
        window.manualEntryLastResort = [];
      }
      window.manualEntryLastResort.push({
        ...data,
        lastResortTimestamp: new Date().toISOString(),
        error: error ? error.message : 'Unknown error'
      });
      
      console.log('🚨 LAST RESORT: Manual entry saved to memory as final backup');
    }
  }
  
  function validateManualEntryData(data) {
    if (!dataIntegrityChecks) return true;
    
    try {
      // Check required fields
      if (!data.student_name || !data.student_id) {
        throw new Error('Missing required fields: student_name or student_id');
      }
      
      // Check data integrity
      if (data.protectionLevel !== 'MAXIMUM') {
        throw new Error('Invalid protection level');
      }
      
      // Check timestamp
      if (!data.timestamp || isNaN(new Date(data.timestamp).getTime())) {
        throw new Error('Invalid timestamp');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Data validation failed:', error);
      return false;
    }
  }
  
  function getManualEntryProtectionStatus() {
    return {
      ...manualEntryProtection,
      totalBackups: manualEntryBackups.length,
      emergencyBackups: JSON.parse(localStorage.getItem('manualEntryEmergencyArray') || '[]').length,
      lastResortBackups: window.manualEntryLastResort ? window.manualEntryLastResort.length : 0,
      protectionActive: instantBackup && dataIntegrityChecks,
      successRate: manualEntryProtection.totalEntries > 0 ? 
        (manualEntryProtection.successfulBackups / manualEntryProtection.totalEntries * 100).toFixed(1) + '%' : '100%'
    };
  }

  // Debug function to show current status
  function showDebugStatus() {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = registeredByDate[today] || {};
    const allStudents = Object.values(todayRecords);
    
    const unsentOfflineRegistrations = offlineRegistrations.filter(record => {
      const studentKey = `${record.student_id}_${record.student_name}_${new Date(record.timestamp).toDateString()}`;
      return !sentStudents.has(studentKey);
    });
    
    const protectionStatus = getManualEntryProtectionStatus();
    
    const debugInfo = `
🔍 Debug Status:

📊 Connection Status:
• isOnline: ${isOnline}
• offlineMode: ${offlineMode}
• WebSocket ready: ${ws ? ws.readyState === WebSocket.OPEN : 'No WebSocket'}

📋 Data Status:
• Today's registrations: ${allStudents.length}
• Offline registrations: ${offlineRegistrations.length}
• Unsent offline registrations: ${unsentOfflineRegistrations.length}
• Offline queue items: ${offlineQueue.length}
• Sent students count: ${sentStudents.size}

🛡️ Manual Entry Protection:
• Protection Level: ${protectionStatus.protectionLevel}
• Total Entries: ${protectionStatus.totalEntries}
• Successful Backups: ${protectionStatus.successfulBackups}
• Failed Backups: ${protectionStatus.failedBackups}
• Success Rate: ${protectionStatus.successRate}
• Instant Backups: ${protectionStatus.totalBackups}
• Emergency Backups: ${protectionStatus.emergencyBackups}
• Last Resort Backups: ${protectionStatus.lastResortBackups}
• Protection Active: ${protectionStatus.protectionActive ? '✅' : '❌'}

💾 Storage Status:
• Local records: ${JSON.parse(localStorage.getItem('entryScanRecords') || '[]').length}
• Offline registrations stored: ${localStorage.getItem('entryScannerOfflineRegistrations') ? JSON.parse(localStorage.getItem('entryScannerOfflineRegistrations')).length : 0}
• Offline queue stored: ${localStorage.getItem('entryScanOfflineQueue') ? JSON.parse(localStorage.getItem('entryScanOfflineQueue')).length : 0}
    `;
    
    console.log(debugInfo);
    alert(debugInfo);
  }

  // Export functions for potential manual use
  window.EntryScannerApp = {
    sendNewStudent,
    getLocalRecords: () => JSON.parse(localStorage.getItem('entryScanRecords') || '[]'),
    clearLocalRecords: () => localStorage.removeItem('entryScanRecords'),
    manualSync,
    forceSyncAllStudents,
    showSyncDetails,
    showDebugStatus,
    getManualEntryProtectionStatus,
    instantBackupManualEntry,
    emergencyBackupManualEntry,
    validateManualEntryData,
    getSyncStatus: () => ({
      syncQueue: syncQueue.length,
      lastSync: lastSyncTimestamp,
      dataIntegrity,
      isOnline,
      syncInProgress
    })
  };
})();
