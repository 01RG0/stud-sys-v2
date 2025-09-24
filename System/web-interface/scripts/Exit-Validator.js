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
    setupUI();
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
      updateConnectionStatus(true);
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
          updateStudentsTable();
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

  function updateConnectionStatus(isConnected) {
    const statusEl = document.getElementById('connection-status');
    if (isConnected) {
      statusEl.textContent = '● Connected';
      statusEl.className = 'status-online';
    } else {
      statusEl.textContent = '● Disconnected';
      statusEl.className = 'status-offline';
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

  // Initialize when page loads
  window.addEventListener('load', init);
  
  // Export functions for potential manual use
  window.ExitValidatorApp = {
    getTodayRegistrations: () => registeredByDate[todayKey()] || {},
    getValidationLogs: () => JSON.parse(localStorage.getItem('exitValidatorLogs') || '[]'),
    clearValidationLogs: () => localStorage.removeItem('exitValidatorLogs'),
    manualValidation: (studentId) => onQr(studentId),
    exportToExcel: exportToExcel
  };
})();
