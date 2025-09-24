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
      reconnectTimer = setTimeout(setupWS, 3000);
    });
    
    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      try { ws.close(); } catch(e) {}
    });
  }

  function setupUI() {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('scanner-screen').style.display = 'block';
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
    const student = studentCache[studentId];
    const status = document.getElementById('scan-status');
    
    if (!student) { 
      status.textContent = `❌ Student not found: ${studentId}`;
      status.style.background = '#ffebee';
      status.style.color = '#c62828';
      return; 
    }
    
    status.textContent = `✅ Found: ${student.name} (#${studentId})`;
    status.style.background = '#e8f5e8';
    status.style.color = '#2e7d32';
    showStudentForm(studentId, student);
  }

  function showStudentForm(studentId, student) {
    const container = document.getElementById('student-form');
    container.style.display = 'block';
    container.innerHTML = `
      <div style="margin-bottom: 12px; padding: 8px; background: #f0f8ff; border-radius: 4px;">
        <strong>${student.name}</strong> (ID: ${studentId})<br>
        <small>Center: ${student.center} | Subject: ${student.subject} | Grade: ${student.grade}</small>
      </div>
      <label>Homework Score (0-10):</label>
      <input id="hw" type="number" min="0" max="10" step="0.5" />
      
      <label>Exam Score (0-10):</label>
      <input id="ex" type="number" min="0" max="10" step="0.5" />
      
      <label>Extra Sessions:</label>
      <input id="extra" type="number" min="0" value="0" />
      
      <label>Comment:</label>
      <input id="comment" type="text" placeholder="Optional comment..." />
      
      <div style="margin-top: 16px;">
        <button id="btn-register" type="button">✅ Register Student</button>
        <button id="btn-continue" type="button">➡️ Continue Scanning</button>
      </div>
    `;
    
    document.getElementById('btn-register').onclick = () => registerStudent(studentId, student);
    document.getElementById('btn-continue').onclick = () => { 
      container.style.display = 'none'; 
      document.getElementById('scan-status').textContent = 'Ready to scan...';
      document.getElementById('scan-status').style.background = '#f5f5f5';
      document.getElementById('scan-status').style.color = '#333';
    };
    
    // Focus on homework score input
    document.getElementById('hw').focus();
  }

  function registerStudent(studentId, student) {
    const record = {
      id: Date.now(),
      student_id: studentId,
      student_name: student.name,
      homework_score: Number(document.getElementById('hw').value || 0),
      exam_score: Number(document.getElementById('ex').value || 0),
      extra_sessions: Number(document.getElementById('extra').value || 0),
      comment: String(document.getElementById('comment').value || '').trim(),
      timestamp: new Date().toISOString(),
      device_name: deviceName
    };
    
    persistLocal(record);
    sendToManager(record);
    
    document.getElementById('student-form').style.display = 'none';
    document.getElementById('scan-status').textContent = `✅ Registered: ${student.name}`;
    document.getElementById('scan-status').style.background = '#e8f5e8';
    document.getElementById('scan-status').style.color = '#2e7d32';
    
    // Auto-clear status after 3 seconds
    setTimeout(() => {
      document.getElementById('scan-status').textContent = 'Ready to scan...';
      document.getElementById('scan-status').style.background = '#f5f5f5';
      document.getElementById('scan-status').style.color = '#333';
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

  // Initialize when page loads
  window.addEventListener('load', init);
  
  // Export functions for potential manual use
  window.EntryScannerApp = {
    sendNewStudent,
    getLocalRecords: () => JSON.parse(localStorage.getItem('entryScanRecords') || '[]'),
    clearLocalRecords: () => localStorage.removeItem('entryScanRecords')
  };
})();
