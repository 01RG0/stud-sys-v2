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

  async function init() {
    document.getElementById('btn-start').addEventListener('click', start);
  }

  async function start() {
    deviceName = document.getElementById('device-name').value.trim();
    if (!deviceName) { 
      alert('Please enter device name'); 
      return; 
    }
    
    // Hide setup screen and show scanner
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('entry-scanner-container').style.display = 'flex';
    
    await loadCache();
    loadOfflineQueue(); // Load offline queue on startup
    setupWS();
    setupUI();
    await startCamera();
    loop();
  }

  async function loadCache() {
    try {
      // Check if cache is embedded (from entry-scanner-embedded route)
      if (typeof STUDENT_CACHE !== 'undefined') {
        studentCache = STUDENT_CACHE;
        console.log('Using embedded student cache');
        return;
      }
      
      // Otherwise fetch from API
      const res = await fetch('/api/student-cache');
      studentCache = await res.json();
      console.log('Loaded student cache from API');
    } catch (error) {
      console.error('Failed to load student cache:', error);
      alert('Failed to load student data. Please check connection.');
    }
  }

  function setupWS() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.addEventListener('open', () => {
      console.log('WebSocket connected');
      isOnline = true;
      updateConnectionStatus(true);
      ws.send(JSON.stringify({ 
        type: 'register_device', 
        role: 'first_scan', 
        name: deviceName 
      }));
      
      // Process offline queue when connection is restored
      setTimeout(() => {
        processOfflineQueue();
      }, 1000);
      
      // Send heartbeat every 10 seconds
      setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 10000);
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
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.addEventListener('close', () => {
      console.log('WebSocket disconnected, attempting reconnect in 3s...');
      isOnline = false;
      updateConnectionStatus(false);
      reconnectTimer = setTimeout(setupWS, 3000);
    });
    
    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      isOnline = false;
      updateConnectionStatus(false);
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
    const student = studentCache[studentId];
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
      entry_method: 'qr_scan'
    };
    
    persistLocal(record);
    sendToManager(record);
    
    document.getElementById('student-form').classList.remove('show');
    
    const statusElement = document.querySelector('#scan-status .status-indicator span');
    if (statusElement) {
      statusElement.textContent = `Registered: ${student.name}`;
    }
    
    showResult('success', `Student ${student.name} registered successfully!`, studentId, record);
    
    // Auto-clear status after 3 seconds
    setTimeout(() => {
      if (statusElement) {
        statusElement.textContent = 'Ready to scan...';
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
    if (offlineQueue.length === 0 || !isOnline) {
      return;
    }

    console.log(`Processing ${offlineQueue.length} offline queue items...`);
    
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
  }

  function updateOfflineIndicator() {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;

    if (isOnline) {
      if (offlineQueue.length > 0) {
        statusElement.innerHTML = `
          <i class="fas fa-circle"></i>
          <span>Connected (${offlineQueue.length} pending)</span>
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
      statusElement.innerHTML = `
        <i class="fas fa-circle"></i>
        <span>Offline (${offlineQueue.length} queued)</span>
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

  function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.className = connected ? 'status-online' : 'status-offline';
      statusElement.innerHTML = `
        <i class="fas fa-circle"></i>
        <span>${connected ? 'Connected' : 'Disconnected'}</span>
      `;
    }
  }

  // Manual Entry Functions
  function showManualEntryForm() {
    const studentForm = document.getElementById('student-form');
    const currentResult = document.getElementById('current-result');
    
    // Hide current result and show manual form
    currentResult.style.display = 'none';
    studentForm.style.display = 'block';
    
    // Create manual entry form
    studentForm.innerHTML = `
      <div class="manual-entry-form">
        <h3><i class="fas fa-keyboard"></i> Manual Student Entry</h3>
        
        <div class="form-row">
          <div class="form-group">
            <label for="manual-student-id">Student ID *</label>
            <input type="text" id="manual-student-id" placeholder="Enter student ID" required>
          </div>
          <div class="form-group">
            <label for="manual-student-name">Student Name *</label>
            <input type="text" id="manual-student-name" placeholder="Enter student name" required>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="manual-center">Center</label>
            <input type="text" id="manual-center" placeholder="Enter center name">
          </div>
          <div class="form-group">
            <label for="manual-grade">Grade</label>
            <input type="text" id="manual-grade" placeholder="Enter grade">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="manual-phone">Phone</label>
            <input type="tel" id="manual-phone" placeholder="Enter phone number">
          </div>
          <div class="form-group">
            <label for="manual-parent-phone">Parent Phone</label>
            <input type="tel" id="manual-parent-phone" placeholder="Enter parent phone">
          </div>
        </div>
        
        <div class="form-group">
          <label for="manual-subject">Subject</label>
          <input type="text" id="manual-subject" placeholder="Enter subject">
        </div>
        
        <div class="payment-section">
          <h4><i class="fas fa-dollar-sign"></i> Payment Information</h4>
          <div class="form-row">
            <div class="form-group payment-amount">
              <label for="manual-payment-amount">Payment Amount</label>
              <input type="number" id="manual-payment-amount" placeholder="0.00" step="0.01" min="0">
            </div>
            <div class="form-group">
              <label for="manual-homework">Homework</label>
              <input type="text" id="manual-homework" placeholder="Enter homework details">
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="manual-comments">Comments</label>
          <textarea id="manual-comments" placeholder="Enter any additional comments"></textarea>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="cancelManualEntry()">
            <i class="fas fa-times"></i>
            Cancel
          </button>
          <button type="button" class="btn btn-primary" onclick="submitManualEntry()">
            <i class="fas fa-check"></i>
            Register Student
          </button>
        </div>
      </div>
    `;
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
    const studentId = document.getElementById('manual-student-id').value.trim();
    const studentName = document.getElementById('manual-student-name').value.trim();
    const center = document.getElementById('manual-center').value.trim();
    const grade = document.getElementById('manual-grade').value.trim();
    const phone = document.getElementById('manual-phone').value.trim();
    const parentPhone = document.getElementById('manual-parent-phone').value.trim();
    const subject = document.getElementById('manual-subject').value.trim();
    const paymentAmount = document.getElementById('manual-payment-amount').value.trim();
    const homework = document.getElementById('manual-homework').value.trim();
    const comments = document.getElementById('manual-comments').value.trim();
    
    // Validate required fields
    if (!studentId || !studentName) {
      alert('Please fill in Student ID and Student Name');
      return;
    }
    
    // Create student object with all details
    const studentData = {
      id: studentId,
      name: studentName,
      center: center || 'Manual Entry',
      grade: grade || '',
      phone: phone || '',
      parentPhone: parentPhone || '',
      subject: subject || '',
      paymentAmount: paymentAmount ? parseFloat(paymentAmount) : 0,
      homework: homework || '',
      comments: comments || '',
      registered: true,
      timestamp: new Date().toISOString(),
      entryMethod: 'manual',
      deviceName: deviceName
    };
    
    try {
      // Send to server
      await sendNewStudent(studentData);
      
      // Show success message
      showResult('success', `Student ${studentName} registered successfully!`, {
        id: studentId,
        name: studentName,
        paymentAmount: paymentAmount ? `$${paymentAmount}` : 'No payment',
        method: 'Manual Entry'
      });
      
      // Clear form and return to waiting state
      cancelManualEntry();
      
    } catch (error) {
      console.error('Failed to register student:', error);
      showResult('error', 'Failed to register student. Please try again.');
    }
  }

  // Make functions globally available
  window.cancelManualEntry = cancelManualEntry;
  window.submitManualEntry = submitManualEntry;


  // Initialize when page loads
  window.addEventListener('load', init);
  
  // Export functions for potential manual use
  window.EntryScannerApp = {
    sendNewStudent,
    getLocalRecords: () => JSON.parse(localStorage.getItem('entryScanRecords') || '[]'),
    clearLocalRecords: () => localStorage.removeItem('entryScanRecords')
  };
})();
