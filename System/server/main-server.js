const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const XLSX = require('xlsx');
const cors = require('cors');
const https = require('https');
const http = require('http');

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const WS_PORT = process.env.WS_PORT || 3001;
const WSS_PORT = process.env.WSS_PORT || 3444;

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from organized web interface folder
app.use(express.static(path.join(__dirname, '..', 'web-interface')));

let studentCache = {};
let systemLogs = [];
let serverStartTime = Date.now();
let totalRegistrations = 0;
let totalValidations = 0;

// Initialize devices Map early to avoid reference errors
const devices = new Map();

// Enhanced logging system
function logToSystem(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };
  
  // Add to in-memory logs (keep last 500 entries)
  systemLogs.push(logEntry);
  if (systemLogs.length > 500) {
    systemLogs.shift();
  }
  
  // Broadcast log to admin dashboards
  broadcastToAdmins({
    type: 'log_entry',
    level: level,
    message: message,
    timestamp: timestamp,
    data: data
  });
  
  // Console output with colors
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'
  };
  
  const color = colors[level] || colors.info;
  console.log(`${color}[${new Date(timestamp).toLocaleTimeString()}] ${level.toUpperCase()}: ${message}${colors.reset}`);
  
  // Broadcast to admin dashboards
  broadcastToAdmins({
    type: 'system_log',
    level,
    message,
    timestamp,
    data
  });
}

// Broadcast message to admin dashboards only
function broadcastToAdmins(message) {
  for (const [wsClient, info] of devices.entries()) {
    if (info.role === 'admin_dashboard' && wsClient.readyState === WebSocket.OPEN) {
      try {
        wsClient.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send to admin:', error);
      }
    }
  }
}

function loadStudentData() {
  try {
    // Look for student data in organized location
    const excelPath = path.join(__dirname, '..', '..', 'Student-Data', 'students-database.xlsx');
    if (!fs.existsSync(excelPath)) {
      logToSystem('warning', `Excel file not found at: ${excelPath}`);
      logToSystem('info', 'Using sample data for testing');
      // Create sample data for testing
      studentCache = {
        "557": {
          id: "557",
          name: "lian mohamed mahmoud sohail",
          center: "Alakbal",
          subject: "Math",
          grade: "Senior 1",
          fees: "50",
          phone: "1228802000",
          parent_phone: "1002674000"
        },
        "123": {
          id: "123",
          name: "Test Student",
          center: "Test Center",
          subject: "Science",
          grade: "Grade 10",
          fees: "40",
          phone: "1234567890",
          parent_phone: "0987654321"
        }
      };
      return;
    }
    
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const byId = {};
    
    rows.forEach(r => {
      byId[r.ID] = {
        id: r.ID,
        name: r.Name,
        center: r.Center,
        subject: r.Subject,
        grade: r.Grade,
        fees: r.Fees,
        phone: r.Phone,
        parent_phone: r['Parent Phone']
      };
    });
    
    studentCache = byId;
    logToSystem('success', `Loaded ${Object.keys(studentCache).length} students from Excel database`);
  } catch (e) {
    logToSystem('error', `Failed to load Excel: ${e.message}`);
    logToSystem('info', 'Falling back to sample data for testing');
    studentCache = {
      "557": {
        id: "557",
        name: "lian mohamed mahmoud sohail",
        center: "Alakbal",
        subject: "Math",
        grade: "Senior 1",
        fees: "50",
        phone: "1228802000",
        parent_phone: "1002674000"
      }
    };
  }
}

// Auto-reload student data when Excel file changes
function setupFileWatcher() {
  const excelPath = path.join(__dirname, '..', '..', 'Student-Data', 'students-database.xlsx');
  
  if (fs.existsSync(excelPath)) {
    logToSystem('info', 'Setting up file watcher for student database');
    
    fs.watchFile(excelPath, { interval: 2000 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        logToSystem('info', 'Student database file changed, reloading...', {
          previousModified: prev.mtime,
          currentModified: curr.mtime
        });
        
        const oldCount = Object.keys(studentCache).length;
        loadStudentData();
        const newCount = Object.keys(studentCache).length;
        
        logToSystem('success', `Student database reloaded: ${oldCount} → ${newCount} students`, {
          oldCount,
          newCount,
          difference: newCount - oldCount
        });
        
        // AUTO-PUSH updated data to all connected Entry Scanners
        broadcastStudentCacheUpdate();
      }
    });
  } else {
    logToSystem('warning', 'Cannot set up file watcher - Excel file not found');
  }
}

// Broadcast updated student cache to all Entry Scanner devices
function broadcastStudentCacheUpdate() {
  const studentCount = Object.keys(studentCache).length;
  let deviceCount = 0;
  
  for (const [wsClient, info] of devices.entries()) {
    if (info.role === 'first_scan' && wsClient.readyState === WebSocket.OPEN) {
      try {
        wsClient.send(JSON.stringify({
          type: 'student_cache_update',
          cache: studentCache,
          timestamp: new Date().toISOString(),
          totalStudents: studentCount,
          updateReason: 'database_file_changed'
        }));
        deviceCount++;
      } catch (error) {
        logToSystem('error', `Failed to send cache update to device: ${info.name}`, {
          error: error.message
        });
      }
    }
  }
  
  if (deviceCount > 0) {
    logToSystem('success', `Broadcasted updated student cache to ${deviceCount} Entry Scanner devices`, {
      deviceCount,
      studentCount,
      cacheSize: JSON.stringify(studentCache).length
    });
  }
}

// API Routes
app.get('/api/student-cache', (req, res) => {
  res.json(studentCache);
});

// Device list endpoint
app.get('/api/devices', (req, res) => {
  const list = [];
  for (const [wsClient, info] of devices.entries()) {
    list.push({ 
      role: info.role, 
      name: info.name, 
      lastSeen: info.lastSeen || null 
    });
  }
  res.json(list);
});

// Validation log endpoint
app.post('/api/validation-log', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const logsDir = path.join(__dirname, '..', '..', 'Logs');
    const file = path.join(logsDir, `registrations-${today}.json`);
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const arr = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    arr.push(req.body);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf8');
    
    // Increment validation counter
    totalValidations++;
    
    // Broadcast validation result to admin dashboards
    broadcastToAdmins({
      type: 'validation_result',
      result: {
        status: req.body.status,
        student_id: req.body.student_id,
        student_name: req.body.student_name,
        timestamp: req.body.timestamp
      }
    });
    
    // Log the validation
    logToSystem('info', `Exit validation: ${req.body.status} for student ${req.body.student_id} (${req.body.student_name})`);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error logging validation:', error);
    res.status(500).json({ error: 'Failed to log validation' });
  }
});

// Route mappings for organized file names
app.get('/entry-scanner', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web-interface', 'pages', 'Entry-Scanner.html'));
});

app.get('/exit-validator', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web-interface', 'pages', 'Exit-Validator.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web-interface', 'pages', 'Admin-Dashboard.html'));
});

// Legacy route support
app.get('/first-scan.html', (req, res) => {
  res.redirect('/entry-scanner');
});

app.get('/last-scan.html', (req, res) => {
  res.redirect('/exit-validator');
});

app.get('/dashboard.html', (req, res) => {
  res.redirect('/admin-dashboard');
});

// Embedded entry scanner route
app.get('/entry-scanner-embedded', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Entry Scanner (Embedded)</title>
  <link rel="stylesheet" href="/styles/main-styles.css" />
</head>
<body>
  <div id="setup-screen">
    <input id="device-name" placeholder="Device Name (e.g., Lab-01)" />
    <button id="btn-start">Start Scanning</button>
  </div>
  <div id="scanner-screen" style="display:none;">
    <video id="camera" autoplay></video>
    <canvas id="canvas" style="display:none;"></canvas>
    <div id="scan-status">Ready</div>
    <div id="student-form" style="display:none;"></div>
  </div>
  <script>const STUDENT_CACHE = ${JSON.stringify(studentCache)};</script>
  <script src="/libraries/qr-scanner-library.js"></script>
  <script src="/scripts/Entry-Scanner.js"></script>
</body>
</html>`;
  res.send(html);
});

// Create HTTPS server if certificate files exist (optional)
function createHTTPSServer() {
  const certPath = path.join(__dirname, 'certs', 'server.crt');
  const keyPath = path.join(__dirname, 'certs', 'server.key');

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    logToSystem('info', 'HTTPS disabled: certs/server.crt or certs/server.key not found');
    logToSystem('info', `To enable HTTPS, place certificate files at: ${certPath} and ${keyPath}`);
    return null;
  }

  try {
    const httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };

    const httpsServer = https.createServer(httpsOptions, app);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      logToSystem('success', `HTTPS server listening on https://localhost:${HTTPS_PORT}`);
      console.log(`🔒 HTTPS server listening on https://localhost:${HTTPS_PORT}`);
    });

    return httpsServer;
  } catch (error) {
    logToSystem('warning', `Failed to start HTTPS server: ${error.message}`);
    return null;
  }
}

// Start HTTP server
const httpServer = app.listen(HTTP_PORT, '0.0.0.0', () => {
  loadStudentData();
  setupFileWatcher(); // Enable auto-reload when Excel file changes
  
  // Use new logging system
  logToSystem('success', 'Student Lab System started successfully');
  logToSystem('info', `HTTP server listening on http://localhost:${HTTP_PORT}`);
  logToSystem('info', 'System URLs available:');
  logToSystem('info', `  Entry Scanner: http://localhost:${HTTP_PORT}/entry-scanner`);
  logToSystem('info', `  Exit Validator: http://localhost:${HTTP_PORT}/exit-validator`);
  logToSystem('info', `  Admin Dashboard: http://localhost:${HTTP_PORT}/admin-dashboard`);
  logToSystem('info', `  Embedded Scanner: http://localhost:${HTTP_PORT}/entry-scanner-embedded`);
  
  // Also keep console output for direct server monitoring
  console.log('🎉 Student Lab System - Clean Organization');
  console.log(`🌐 HTTP server listening on http://localhost:${HTTP_PORT}`);
  console.log('📱 Access URLs:');
  console.log(`   Entry Scanner:    http://localhost:${HTTP_PORT}/entry-scanner`);
  console.log(`   Exit Validator:   http://localhost:${HTTP_PORT}/exit-validator`);
  console.log(`   Admin Dashboard:  http://localhost:${HTTP_PORT}/admin-dashboard`);
  console.log(`   Embedded Scanner: http://localhost:${HTTP_PORT}/entry-scanner-embedded`);
});

// Start HTTPS server for phone camera access
const httpsServer = createHTTPSServer();
if (httpsServer) {
  console.log('📱 For phone camera access, use HTTPS URLs:');
  console.log(`   https://YOUR_IP:${HTTPS_PORT}/entry-scanner`);
  console.log(`   https://YOUR_IP:${HTTPS_PORT}/exit-validator`);
}

// WebSocket server (attach to both HTTP and HTTPS servers)
let wss;
let wssHttps;

try {
  // Attach WebSocket to HTTP server
  wss = new WebSocket.Server({ server: httpServer });
  logToSystem('success', 'WebSocket server attached to HTTP server');
  
  // If HTTPS server exists, also attach WebSocket to it
  if (httpsServer) {
    wssHttps = new WebSocket.Server({ server: httpsServer });
    logToSystem('success', 'WebSocket server attached to HTTPS server');
  }
} catch (error) {
  logToSystem('warning', `Failed to attach WS to HTTP: ${error.message}. Falling back to port ${WS_PORT}`);
  wss = new WebSocket.Server({ port: WS_PORT });
}

// WebSocket connection handler function
function handleWebSocketConnection(ws, source) {
  logToSystem('info', `New WebSocket connection established from ${source}`);
  
  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'register_device') {
        devices.set(ws, { 
          role: data.role, 
          name: data.name, 
          lastSeen: Date.now() 
        });
        
        logToSystem('success', `Device registered: ${data.name} (${data.role})`);
        
        // AUTO-PUSH: Send student cache to Entry Scanner devices immediately upon connection
        if (data.role === 'first_scan') {
          const studentCount = Object.keys(studentCache).length;
          
          // Send the complete student database to the newly connected Entry Scanner
          ws.send(JSON.stringify({
            type: 'student_cache_update',
            cache: studentCache,
            timestamp: new Date().toISOString(),
            totalStudents: studentCount
          }));
          
          logToSystem('success', `Auto-pushed ${studentCount} students to Entry Scanner: ${data.name}`, {
            deviceName: data.name,
            studentCount: studentCount,
            cacheSize: JSON.stringify(studentCache).length
          });
        }
        
        // Send current statistics to Admin Dashboards
        if (data.role === 'admin_dashboard') {
          // Update lastSeen immediately for admin dashboard
          const deviceInfo = devices.get(ws);
          if (deviceInfo) {
            deviceInfo.lastSeen = Date.now();
          }
          
          const uptime = Date.now() - serverStartTime;
          const stats = {
            totalDevices: devices.size,
            onlineDevices: Array.from(devices.values()).filter(d => d.lastSeen && (Date.now() - d.lastSeen < 30000)).length,
            totalStudents: Object.keys(studentCache).length,
            totalRegistrations,
            totalValidations,
            serverUptime: uptime,
            systemLogsCount: systemLogs.length
          };
          
          ws.send(JSON.stringify({
            type: 'server_stats',
            stats,
            timestamp: new Date().toISOString()
          }));
          
          logToSystem('info', `Sent initial statistics to Admin Dashboard: ${data.name}`);
        }
        
        // Notify other admin dashboards about new device
        broadcastToAdmins({
          type: 'device_connected',
          name: data.name,
          role: data.role,
          timestamp: new Date().toISOString()
        });
        
        return;
      }
      
      if (data.type === 'heartbeat') {
        const info = devices.get(ws) || {};
        info.lastSeen = Date.now();
        devices.set(ws, info);
        return;
      }
      
      if (data.type === 'student_registered') {
        totalRegistrations++;
        const record = data.record;
        
        logToSystem('success', `Student registered: ${record.student_name} (ID: ${record.student_id}) by ${record.device_name}`, {
          studentId: record.student_id,
          studentName: record.student_name,
          deviceName: record.device_name,
          homeworkScore: record.homework_score,
          examScore: record.exam_score
        });
        
        // Forward to all exit validator devices
        for (const [client, info] of devices.entries()) {
          if (info.role === 'last_scan' && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'receive_student_record', 
              record: data.record 
            }));
          }
        }
        
        // Notify admins
        broadcastToAdmins({
          type: 'student_registered',
          record: data.record,
          timestamp: new Date().toISOString()
        });
        
        return;
      }
      
      if (data.type === 'new_student') {
        const student = data.student;
        
        logToSystem('info', `New student added: ${student.name} (ID: ${student.id})`, {
          studentId: student.id,
          studentName: student.name
        });
        
        // Broadcast to all entry scanner devices
        for (const [client, info] of devices.entries()) {
          if (info.role === 'first_scan' && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'new_student', 
              student: data.student 
            }));
          }
        }
        // Update cache in memory
        studentCache[data.student.id] = data.student;
        return;
      }
      
      if (data.type === 'request_stats') {
        // Send server statistics to requesting admin
        const uptime = Date.now() - serverStartTime;
        const stats = {
          totalDevices: devices.size,
          onlineDevices: Array.from(devices.values()).filter(d => d.lastSeen && (Date.now() - d.lastSeen < 30000)).length,
          totalStudents: Object.keys(studentCache).length,
          totalRegistrations,
          totalValidations,
          serverUptime: uptime,
          systemLogsCount: systemLogs.length
        };
        
        ws.send(JSON.stringify({
          type: 'server_stats',
          stats,
          timestamp: new Date().toISOString()
        }));
        
        return;
      }
      
      // Log unknown message types
      logToSystem('warning', `Unknown message type received: ${data.type}`, data);
      
    } catch (error) {
      logToSystem('error', `Failed to process WebSocket message: ${error.message}`, {
        error: error.message,
        stack: error.stack
      });
    }
  });
  
  ws.on('close', () => {
    const deviceInfo = devices.get(ws);
    if (deviceInfo) {
      logToSystem('warning', `Device disconnected: ${deviceInfo.name} (${deviceInfo.role})`);
      
      // Notify admins about device disconnection
      broadcastToAdmins({
        type: 'device_disconnected',
        name: deviceInfo.name,
        role: deviceInfo.role,
        timestamp: new Date().toISOString()
      });
      
      devices.delete(ws);
    } else {
      logToSystem('info', 'WebSocket connection closed');
    }
  });
  
  ws.on('error', (error) => {
    logToSystem('error', `WebSocket error: ${error.message}`, {
      error: error.message
    });
  });
}

// Attach the connection handler to both WebSocket servers
wss.on('connection', (ws) => handleWebSocketConnection(ws, 'HTTP'));

if (wssHttps) {
  wssHttps.on('connection', (ws) => handleWebSocketConnection(ws, 'HTTPS'));
}

// WebSocket servers are now attached to both HTTP and HTTPS servers


// Add API endpoint to get system logs for admin
app.get('/api/system-logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const level = req.query.level || 'all';
    
    let filteredLogs = systemLogs;
    if (level !== 'all') {
      filteredLogs = systemLogs.filter(log => log.level === level);
    }
    
    const recentLogs = filteredLogs.slice(-limit);
    res.json(recentLogs);
  } catch (error) {
    logToSystem('error', `Failed to retrieve system logs: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  logToSystem('warning', 'Received shutdown signal, closing server gracefully...');
  console.log('\n🛑 Shutting down gracefully...');
  
  let closedCount = 0;
  const totalServers = wssHttps ? 2 : 1;
  
  const checkShutdown = () => {
    closedCount++;
    if (closedCount >= totalServers) {
      logToSystem('success', 'All WebSocket servers closed successfully');
      console.log('✅ All WebSocket servers closed');
      process.exit(0);
    }
  };
  
  wss.close(() => {
    logToSystem('success', 'HTTP WebSocket server closed');
    checkShutdown();
  });
  
  if (wssHttps) {
    wssHttps.close(() => {
      logToSystem('success', 'HTTPS WebSocket server closed');
      checkShutdown();
    });
  }
});
