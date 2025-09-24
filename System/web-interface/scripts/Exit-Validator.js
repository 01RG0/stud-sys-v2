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

  function todayKey() { 
    return new Date().toISOString().split('T')[0]; 
  }

  function init() {
    loadStoredRecords();
    setupWS();
    video = document.getElementById('camera');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    startCamera().then(() => loop());
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
    
    ws = new WebSocket(WS_URL);
    
    ws.addEventListener('open', () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ 
        type: 'register_device', 
        role: 'last_scan', 
        name: 'Exit-Validator' 
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
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.addEventListener('close', () => {
      console.log('WebSocket disconnected, attempting reconnect in 3s...');
      reconnectTimer = setTimeout(setupWS, 3000);
    });
    
    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
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

  function loop() {
    if (!scanning) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code && code.data) {
        onQr(code.data);
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

  function showResult(status, message, studentId, record = null) {
    const resultDiv = document.getElementById('result');
    resultDiv.className = `result ${status.toLowerCase()}`;
    
    const currentTime = new Date().toLocaleTimeString();
    
    resultDiv.innerHTML = `
      <h2>${status}</h2>
      <p><strong>Student ID:</strong> ${studentId}</p>
      <p><strong>Status:</strong> ${message}</p>
      <p><strong>Time:</strong> ${currentTime}</p>
      ${record ? `
        <p><strong>Name:</strong> ${record.student_name || 'N/A'}</p>
        <p><strong>Homework:</strong> ${record.homework_score || 'N/A'}/10</p>
        <p><strong>Exam:</strong> ${record.exam_score || 'N/A'}/10</p>
        <p><strong>Registered:</strong> ${new Date(record.timestamp).toLocaleString()}</p>
        <p><strong>Device:</strong> ${record.device_name || 'N/A'}</p>
      ` : ''}
    `;
    
    resultDiv.style.display = 'block';
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      resultDiv.style.display = 'none';
    }, 4000);
    
    // Log status
    if (status === 'PASSED') {
      console.log('✅ PASSED - Student validated');
    } else {
      console.log('❌ BLOCKED - Student not registered');
    }
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
      status: status,
      timestamp: new Date().toISOString(),
      record: record
    };
    
    // Store locally
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
    
    // Send to manager
    try {
      await fetch('/api/validation-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
      console.log('Validation logged to manager');
    } catch (error) {
      console.warn('Failed to log validation to manager:', error);
    }
  }

  // Initialize when page loads
  window.addEventListener('load', init);
  
  // Export functions for potential manual use
  window.ExitValidatorApp = {
    getTodayRegistrations: () => registeredByDate[todayKey()] || {},
    getValidationLogs: () => JSON.parse(localStorage.getItem('exitValidatorLogs') || '[]'),
    clearValidationLogs: () => localStorage.removeItem('exitValidatorLogs'),
    manualValidation: (studentId) => onQr(studentId)
  };
})();
