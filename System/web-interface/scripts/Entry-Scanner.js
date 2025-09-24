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
      updateConnectionStatus(true);
      ws.send(JSON.stringify({ 
        type: 'register_device', 
        role: 'first_scan', 
        name: deviceName 
      }));
      
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
      updateConnectionStatus(false);
      reconnectTimer = setTimeout(setupWS, 3000);
    });
    
    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
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
      timestamp: new Date().toISOString(),
      device_name: deviceName,
      registered: true
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

  function sendToManager(record) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ 
        type: 'student_registered', 
        record 
      }));
      console.log('Record sent to manager');
    } else {
      console.warn('WebSocket not connected, record saved locally only');
    }
  }

  function sendNewStudent(student) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ 
        type: 'new_student', 
        student 
      }));
      console.log('New student sent to manager');
    } else {
      console.warn('WebSocket not connected, cannot add new student');
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


  // Initialize when page loads
  window.addEventListener('load', init);
  
  // Export functions for potential manual use
  window.EntryScannerApp = {
    sendNewStudent,
    getLocalRecords: () => JSON.parse(localStorage.getItem('entryScanRecords') || '[]'),
    clearLocalRecords: () => localStorage.removeItem('entryScanRecords')
  };
})();
