## Student Lab System — Tasks Backlog (Windows/PowerShell Oriented)

Use this backlog to execute the project end-to-end. Tasks are organized by phases as requested: files/folders → web UI → hosting → Manager core → scanners → remaining features. Each task includes exact PowerShell commands. Execute tasks in order.

---

## PRD Coverage Verification

This section maps PRD requirements to tasks and adds missing items.

- [x] Independent First/Last scan nodes using local storage (Phases 2, 5)
- [x] Manager minimal coordination, Excel → JSON, real-time forwarding (Phase 4)
- [x] Operation flow: First scan → Manager → Last scan validation (Phases 4–5)
- [ ] Initial data distribution variant: Embedded cache HTML from Manager
  - Add dynamic route that serves `first-scan` with embedded `STUDENT_CACHE` for offline-first bootstrap.
- [ ] Device connection monitoring (register, heartbeat, list devices)
- [ ] Dashboard & Reports (basic page + API to show devices and counts)
- [ ] Data export/backup (daily dump of registrations)
- [ ] Manual student addition flow wired end-to-end
- [ ] Validation logging (Last Scan logs, optional post to Manager)
- [ ] WS reconnect logic on both scanners

Tasks below implement the missing items.

---

## Phase 0 — Prerequisites and Environment

- [ ] Verify Node.js and npm versions
  ```powershell
  $workspace = "C:\Users\hamad\Desktop\stud sys v2"
  Set-Location "$workspace"
  node -v
  npm -v
  ```

- [ ] Place Excel data file
  - Put your latest `students.xlsx` at: `manager\data\students.xlsx` (created in Phase 1).

---

## Phase 1 — Files and Folders Creation (Scaffolding)

- [ ] Create directories
  ```powershell
  $workspace = "C:\Users\hamad\Desktop\stud sys v2"
  Set-Location "$workspace"
  New-Item -ItemType Directory -Force -Path "manager","manager\public","manager\public\js","manager\public\css","manager\public\vendor","manager\data","manager\logs" | Out-Null
  ```

- [ ] Create placeholder files
  ```powershell
  New-Item -ItemType File -Force -Path "manager\manager-server.js","manager\public\first-scan.html","manager\public\last-scan.html","manager\public\js\first-scan.js","manager\public\js\last-scan.js","manager\public\css\styles.css","manager\README.md","manager\.gitignore" | Out-Null
  ```

- [ ] (Optional) Create placeholder Excel (replace with real file later)
  ```powershell
  New-Item -ItemType File -Force -Path "manager\data\students.xlsx" | Out-Null
  ```

- [ ] Create `.gitignore`
  ```powershell
  @"
  node_modules/
  logs/
  *.log
  .DS_Store
  "@ | Set-Content -Encoding UTF8 "manager\.gitignore"
  ```

---

## Phase 2 — Web UI (Static, Offline-First)

- [ ] Download jsQR vendor locally (offline safe)
  ```powershell
  $workspace = "C:\Users\hamad\Desktop\stud sys v2"
  Set-Location "$workspace"
  $jsqrUrl = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"
  $jsqrOut = "manager\public\vendor\jsqr.min.js"
  Invoke-WebRequest -Uri $jsqrUrl -OutFile $jsqrOut
  ```

- [ ] Populate `manager/public/first-scan.html` skeleton
  ```powershell
  @"
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>First Scan</title>
    <link rel=\"stylesheet\" href=\"/css/styles.css\" />
  </head>
  <body>
    <div id=\"setup-screen\">
      <input id=\"device-name\" placeholder=\"Device Name (e.g., Lab-01)\" />
      <button id=\"btn-start\">Start Scanning</button>
    </div>
    <div id=\"scanner-screen\" style=\"display:none\;\">
      <video id=\"camera\" autoplay></video>
      <canvas id=\"canvas\" style=\"display:none\;\"></canvas>
      <div id=\"scan-status\">Ready</div>
      <div id=\"student-form\" style=\"display:none\;\"></div>
    </div>
    <script src=\"/vendor/jsqr.min.js\"></script>
    <script src=\"/js/first-scan.js\"></script>
  </body>
  </html>
  "@ | Set-Content -Encoding UTF8 "manager\public\first-scan.html"
  ```

- [ ] Populate `manager/public/last-scan.html` skeleton
  ```powershell
  @"
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Last Scan</title>
    <link rel=\"stylesheet\" href=\"/css/styles.css\" />
  </head>
  <body>
    <div id=\"result\"></div>
    <video id=\"camera\" autoplay></video>
    <canvas id=\"canvas\" style=\"display:none\;\"></canvas>
    <script src=\"/vendor/jsqr.min.js\"></script>
    <script src=\"/js/last-scan.js\"></script>
  </body>
  </html>
  "@ | Set-Content -Encoding UTF8 "manager\public\last-scan.html"
  ```

- [ ] Populate `manager/public/css/styles.css`
  ```powershell
  @"
  body { font-family: system-ui, Arial, sans-serif; margin: 0; }
  #setup-screen { padding: 16px; display: flex; gap: 8px; align-items: center; }
  #scanner-screen { position: relative; height: 100vh; }
  #camera { width: 100%; height: auto; max-height: 60vh; background: #000; }
  #scan-status { padding: 8px 16px; }
  #student-form { padding: 12px; background: #fff; display: none; }
  #student-form label { display: block; margin-top: 8px; }
  #student-form input { width: 100%; padding: 6px; margin-top: 4px; }
  #student-form button { margin-top: 12px; }
  .result { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); padding: 12px 16px; border-radius: 8px; color: #fff; display: none; }
  .result.passed { background: #2e7d32; }
  .result.blocked { background: #c62828; }
  "@ | Set-Content -Encoding UTF8 "manager\public\css\styles.css"
  ```

---

## Phase 3 — Hosting (Local LAN + Autostart)

- [ ] Initialize Node project and install dependencies
  ```powershell
  Set-Location "C:\Users\hamad\Desktop\stud sys v2\manager"
  npm init -y
  npm install express ws xlsx cors
  npm install --save-dev nodemon
  npm pkg set scripts.start="node manager-server.js"
  npm pkg set scripts.dev="nodemon manager-server.js"
  ```

- [ ] Allow LAN access (optional firewall rules)
  ```powershell
  New-NetFirewallRule -DisplayName "StudentLab-HTTP-3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Any | Out-Null
  New-NetFirewallRule -DisplayName "StudentLab-WS-3001"   -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -Profile Any | Out-Null
  ```

- [ ] Start server (development)
  ```powershell
  Set-Location "C:\Users\hamad\Desktop\stud sys v2\manager"
  npm run dev
  # Open: http://localhost:3000/first-scan  and  http://localhost:3000/last-scan
  ```

- [ ] Setup PM2 autostart (optional)
  ```powershell
  npm install -g pm2
  pm2 start manager-server.js --name "student-manager" --cwd "C:\Users\hamad\Desktop\stud sys v2\manager"
  pm2 save
  pm2 startup windows
  ```

---

## Phase 4 — Manager Core (Coordinator)

- [ ] Populate `manager/manager-server.js` with core server
  ```powershell
  @"
  const path = require('path');
  const express = require('express');
  const WebSocket = require('ws');
  const fs = require('fs');
  const XLSX = require('xlsx');
  const cors = require('cors');

  const HTTP_PORT = process.env.HTTP_PORT || 3000;
  const WS_PORT = process.env.WS_PORT || 3001;

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  let studentCache = {};

  function loadStudentData() {
    try {
      const workbook = XLSX.readFile(path.join(__dirname, 'data', 'students.xlsx'));
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
      console.log(`Loaded ${Object.keys(studentCache).length} students`);
    } catch (e) {
      console.error('Failed to load Excel:', e.message);
    }
  }

  app.get('/api/student-cache', (req, res) => {
    res.json(studentCache);
  });

  app.listen(HTTP_PORT, '0.0.0.0', () => {
    loadStudentData();
    console.log(`HTTP listening on ${HTTP_PORT}`);
  });

  const wss = new WebSocket.Server({ port: WS_PORT });
  const devices = new Map();

  wss.on('connection', ws => {
    ws.on('message', msg => {
      const data = JSON.parse(msg);
      if (data.type === 'register_device') {
        devices.set(ws, { role: data.role, name: data.name });
        return;
      }
      if (data.type === 'student_registered') {
        for (const [client, info] of devices.entries()) {
          if (info.role === 'last_scan' && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'receive_student_record', record: data.record }));
          }
        }
        return;
      }
      if (data.type === 'new_student') {
        for (const [client, info] of devices.entries()) {
          if (info.role === 'first_scan' && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'new_student', student: data.student }));
          }
        }
        studentCache[data.student.id] = data.student;
        return;
      }
    });
    ws.on('close', () => devices.delete(ws));
  });

  console.log(`WS listening on ${WS_PORT}`);
  "@ | Set-Content -Encoding UTF8 "manager\manager-server.js"
  ```

- [ ] Verify endpoints and WS
  - `GET http://localhost:3000/api/student-cache` returns JSON
  - Open both UIs; simulate a record from First Scan, ensure it reaches Last Scan

---

## Phase 4.1 — Manager Enhancements (Embedded Cache and Devices)

- [ ] Add dynamic `GET /first-scan-embedded` route with embedded cache
  ```powershell
  @"
  // Add below existing routes in manager-server.js
  const html = () => `<!DOCTYPE html>
  <html><head><meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>First Scan (Embedded)</title><link rel=\"stylesheet\" href=\"/css/styles.css\" /></head>
  <body>
    <div id=\"setup-screen\"><input id=\"device-name\" placeholder=\"Device Name (e.g., Lab-01)\" />
    <button id=\"btn-start\">Start Scanning</button></div>
    <div id=\"scanner-screen\" style=\"display:none\;\"><video id=\"camera\" autoplay></video>
    <canvas id=\"canvas\" style=\"display:none\;\"></canvas><div id=\"scan-status\">Ready</div>
    <div id=\"student-form\" style=\"display:none\;\"></div></div>
    <script>const STUDENT_CACHE = ${JSON.stringify(studentCache)};</script>
    <script src=\"/vendor/jsqr.min.js\"></script><script src=\"/js/first-scan.js\"></script>
  </body></html>`;

  app.get('/first-scan-embedded', (req, res) => { res.send(html()); });
  "@ | Add-Content -Encoding UTF8 "manager\manager-server.js"
  ```

- [ ] Add device monitoring: track lastSeen with heartbeat and list via `/api/devices`
  ```powershell
  @"
  // Device list endpoint (place with other app.get handlers)
  app.get('/api/devices', (req, res) => {
    const list = [];
    for (const [wsClient, info] of devices.entries()) {
      list.push({ role: info.role, name: info.name, lastSeen: info.lastSeen || null });
    }
    res.json(list);
  });

  // In WS connection handler, after parsing data
  if (data.type === 'register_device') {
    devices.set(ws, { role: data.role, name: data.name, lastSeen: Date.now() });
    return;
  }
  if (data.type === 'heartbeat') {
    const info = devices.get(ws) || {}; info.lastSeen = Date.now(); devices.set(ws, info); return;
  }
  "@ | Add-Content -Encoding UTF8 "manager\manager-server.js"
  ```

---

## Phase 4.2 — Manager Reports and Exports

- [ ] Create daily export script
  ```powershell
  @"
  // manager/scripts/export-daily.js
  const fs = require('fs');
  const path = require('path');
  function run() {
    const today = new Date().toISOString().split('T')[0];
    const src = path.join(__dirname, '..', 'logs', `registered-${today}.json`);
    if (!fs.existsSync(src)) { console.log('No registrations for today.'); return; }
    const csvOut = path.join(__dirname, '..', 'logs', `registered-${today}.csv`);
    const rows = JSON.parse(fs.readFileSync(src, 'utf8'));
    if (!Array.isArray(rows)) { console.log('Invalid JSON format'); return; }
    const headers = Object.keys(rows[0] || {id: '', student_id: '', student_name: ''});
    const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))).join('\n');
    fs.writeFileSync(csvOut, csv, 'utf8');
    console.log('Exported to', csvOut);
  }
  run();
  "@ | New-Item -ItemType File -Force -Path "manager\scripts\export-daily.js" -Value {
    param($inputData)
  }
  ```

- [ ] Add Manager endpoint to accept validation logs (from Last Scan)
  ```powershell
  @"
  // Place with other app routes
  const pathLogs = require('path');
  app.post('/api/validation-log', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const file = pathLogs.join(__dirname, 'logs', `registered-${today}.json`);
    const arr = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    arr.push(req.body);
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf8');
    res.json({ ok: true });
  });
  "@ | Add-Content -Encoding UTF8 "manager\manager-server.js"
  ```

- [ ] Add simple dashboard page and script
  ```powershell
  @"
  <!DOCTYPE html>
  <html><head><meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Dashboard</title><link rel=\"stylesheet\" href=\"/css/styles.css\" /></head>
  <body>
    <h2>Devices</h2>
    <table id=\"devices\"><thead><tr><th>Name</th><th>Role</th><th>Last Seen</th></tr></thead><tbody></tbody></table>
    <script src=\"/js/dashboard.js\"></script>
  </body></html>
  "@ | Set-Content -Encoding UTF8 "manager\public\dashboard.html"

  @"
  (async function(){
    async function load() {
      const res = await fetch('/api/devices');
      const devices = await res.json();
      const tbody = document.querySelector('#devices tbody');
      tbody.innerHTML = devices.map(d => `<tr><td>${d.name||''}</td><td>${d.role||''}</td><td>${d.lastSeen? new Date(d.lastSeen).toLocaleTimeString():''}</td></tr>`).join('');
    }
    setInterval(load, 3000); load();
  })();
  "@ | Set-Content -Encoding UTF8 "manager\public\js\dashboard.js"
  ```

---

## Phase 5 — First and Last Scanners (Browser Apps)

- [ ] Populate `manager/public/js/first-scan.js`
  ```powershell
  @"
  (function(){
    const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':3001';
    let deviceName = '';
    let ws = null;
    let video = null;
    let canvas = null;
    let ctx = null;
    let scanning = false;
    let studentCache = {};

    async function init() {
      document.getElementById('btn-start').addEventListener('click', start);
    }

    async function start() {
      deviceName = document.getElementById('device-name').value.trim();
      if (!deviceName) { alert('Enter device name'); return; }
      await loadCache();
      setupWS();
      setupUI();
      await startCamera();
      loop();
    }

    async function loadCache() {
      const res = await fetch('/api/student-cache');
      studentCache = await res.json();
    }

    function setupWS() {
      ws = new WebSocket(WS_URL);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'register_device', role: 'first_scan', name: deviceName }));
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play();
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      scanning = true;
    }

    function loop() {
      if (!scanning) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) onQr(code.data);
      }
      requestAnimationFrame(loop);
    }

    function onQr(text) {
      const studentId = String(text).trim();
      const student = studentCache[studentId];
      const status = document.getElementById('scan-status');
      if (!student) { status.textContent = `Not found: ${studentId}`; return; }
      status.textContent = `Found ${student.name} (#${studentId})`;
      showStudentForm(studentId, student);
    }

    function showStudentForm(studentId, student) {
      const container = document.getElementById('student-form');
      container.style.display = 'block';
      container.innerHTML = `
        <div><strong>${student.name}</strong> (ID: ${studentId})</div>
        <label>Homework</label><input id="hw" type="number" min="0" max="10" />
        <label>Exam</label><input id="ex" type="number" min="0" max="10" />
        <label>Extra</label><input id="extra" type="number" min="0" value="0" />
        <label>Comment</label><input id="comment" type="text" />
        <button id="btn-register">Register</button>
        <button id="btn-continue">Continue</button>
      `;
      document.getElementById('btn-register').onclick = () => registerStudent(studentId, student);
      document.getElementById('btn-continue').onclick = () => { container.style.display = 'none'; };
    }

    function registerStudent(studentId, student) {
      const record = {
        id: Date.now(),
        student_id: studentId,
        student_name: student.name,
        homework_score: Number(document.getElementById('hw').value || 0),
        exam_score: Number(document.getElementById('ex').value || 0),
        extra_sessions: Number(document.getElementById('extra').value || 0),
        comment: String(document.getElementById('comment').value || ''),
        timestamp: new Date().toISOString(),
        device_name: deviceName
      };
      persistLocal(record);
      sendToManager(record);
      document.getElementById('student-form').style.display = 'none';
      document.getElementById('scan-status').textContent = `Registered ${student.name}`;
    }

    function persistLocal(record) {
      const key = 'firstScanRecords';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.push(record);
      localStorage.setItem(key, JSON.stringify(arr));
    }

    function sendToManager(record) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'student_registered', record }));
      }
    }

    window.addEventListener('load', init);
  })();
  "@ | Set-Content -Encoding UTF8 "manager\public\js\first-scan.js"
  ```

- [ ] Populate `manager/public/js/last-scan.js`
  ```powershell
  @"
  (function(){
    const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':3001';
    let ws = null;
    let video = null;
    let canvas = null;
    let ctx = null;
    let scanning = false;
    const registeredByDate = {}; // { yyyy-mm-dd: { [id]: record } }

    function todayKey() { return new Date().toISOString().split('T')[0]; }

    function init() {
      setupWS();
      video = document.getElementById('camera');
      canvas = document.getElementById('canvas');
      ctx = canvas.getContext('2d');
      startCamera().then(() => loop());
    }

    function setupWS() {
      ws = new WebSocket(WS_URL);
      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ type: 'register_device', role: 'last_scan', name: 'Exit-Node' }));
      });
      ws.addEventListener('message', (evt) => {
        const data = JSON.parse(evt.data);
        if (data.type === 'receive_student_record') {
          const record = data.record;
          const day = todayKey();
          if (!registeredByDate[day]) registeredByDate[day] = {};
          registeredByDate[day][record.student_id] = record;
          localStorage.setItem('lastScanToday', JSON.stringify(registeredByDate[day]));
        }
      });
    }

    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      await video.play();
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      scanning = true;
    }

    function loop() {
      if (!scanning) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) onQr(code.data);
      }
      requestAnimationFrame(loop);
    }

    function onQr(text) {
      const studentId = String(text).trim();
      const day = todayKey();
      const todayMap = registeredByDate[day] || JSON.parse(localStorage.getItem('lastScanToday') || '{}');
      const resultDiv = document.getElementById('result');
      if (todayMap && todayMap[studentId]) {
        const rec = todayMap[studentId];
        resultDiv.className = 'result passed';
        resultDiv.innerHTML = `<h2>PASSED</h2><p>${rec.student_name} (#${studentId})</p><p>${rec.timestamp}</p>`;
      } else {
        resultDiv.className = 'result blocked';
        resultDiv.innerHTML = `<h2>BLOCKED</h2><p>ID ${studentId} not registered today</p>`;
      }
      resultDiv.style.display = 'block';
      setTimeout(() => { resultDiv.style.display = 'none'; }, 2500);
    }

    window.addEventListener('load', init);
  })();
  "@ | Set-Content -Encoding UTF8 "manager\public\js\last-scan.js"
  ```

- [ ] Run both UIs from Manager server
  ```powershell
  Set-Location "C:\Users\hamad\Desktop\stud sys v2\manager"
  npm run dev
  # Open: http://localhost:3000/first-scan and http://localhost:3000/last-scan
  ```

---

## Phase 5.1 — First Scan: Manual Student Addition & Heartbeat

- [ ] Wire manual add student flow and `new_student` WS message
  ```powershell
  @"
  // Append to first-scan.js after functions
  function sendNewStudent(student) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'new_student', student }));
    }
  }
  // Example usage: collect form fields and call sendNewStudent({...})
  "@ | Add-Content -Encoding UTF8 "manager\public\js\first-scan.js"
  ```

- [ ] Add WS heartbeat every 10s
  ```powershell
  @"
  // Append inside setupWS() open event or after it
  setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'heartbeat' }));
    }
  }, 10000);
  "@ | Add-Content -Encoding UTF8 "manager\public\js\first-scan.js"
  ```

- [ ] Add WS reconnect logic
  ```powershell
  @"
  // Near setupWS definition
  function setupWS() {
    ws = new WebSocket(WS_URL);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ type: 'register_device', role: 'first_scan', name: deviceName }));
    });
    ws.addEventListener('close', () => { setTimeout(setupWS, 3000); });
    ws.addEventListener('error', () => { try { ws.close(); } catch(e){} });
  }
  "@ | Add-Content -Encoding UTF8 "manager\public\js\first-scan.js"
  ```

---

## Phase 5.2 — Last Scan: Validation Logging & Heartbeat

- [ ] Post validation result to Manager `/api/validation-log`
  ```powershell
  @"
  // Append to last-scan.js inside onQr() after showing result
  try {
    fetch('/api/validation-log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Date.now(), student_id: studentId, status: (todayMap && todayMap[studentId]) ? 'PASSED' : 'BLOCKED', timestamp: new Date().toISOString() })
    });
  } catch(e) {}
  "@ | Add-Content -Encoding UTF8 "manager\public\js\last-scan.js"
  ```

- [ ] Add WS heartbeat and reconnect
  ```powershell
  @"
  // Inside setupWS in last-scan.js
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'register_device', role: 'last_scan', name: 'Exit-Node' }));
    setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'heartbeat' })); }, 10000);
  });
  ws.addEventListener('close', () => { setTimeout(setupWS, 3000); });
  ws.addEventListener('error', () => { try { ws.close(); } catch(e){} });
  "@ | Add-Content -Encoding UTF8 "manager\public\js\last-scan.js"
  ```

---

## Phase 6 — Remaining Features, QA, and Ops

- [ ] Device registration handshake (already in skeleton)
  - First Scan registers `{ role: 'first_scan', name }`
  - Last Scan registers `{ role: 'last_scan', name }`

- [ ] New student addition (wire later in First Scan UI)
  - Send `{ type: 'new_student', student }` via WS; Manager updates cache and broadcasts to First Scans

- [ ] Daily export of registered students (add to Manager later)
  - Plan: write JSON/CSV to `manager/logs/registered-YYYY-MM-DD.json`

- [ ] Dashboard and reports (later)
  - Serve a simple dashboard page from `public/` and a `GET /api/reports/today` endpoint

- [ ] QA Checklist
  - Offline mode: First Scan continues scanning and storing if WS down
  - Reconnect logic for WS (auto-retry)
  - Data consistency: Excel → /api/student-cache → First Scan lookup

- [ ] Operations
  ```powershell
  # PM2 common
  pm2 status
  pm2 logs student-manager
  pm2 restart student-manager
  ```

---

## Phase 6 — Run and Validate New Features

- [ ] Start server and open dashboard
  ```powershell
  Set-Location "C:\Users\hamad\Desktop\stud sys v2\manager"
  npm run dev
  # Open: http://localhost:3000/dashboard.html
  ```

- [ ] Test embedded cache route
  ```powershell
  # Open: http://localhost:3000/first-scan-embedded
  ```

- [ ] Verify device list updates while scanners run
  - Ensure lastSeen updates every ~10s (heartbeat)

- [ ] Verify validation logs are written to `manager/logs/registered-YYYY-MM-DD.json`

- [ ] Export CSV for the day
  ```powershell
  node .\scripts\export-daily.js
  ```

---

## Quick Start Execution Order

1) Phase 1 → scaffold directories/files
2) Phase 2 → download jsQR and populate UI skeletons
3) Phase 3 → npm init, install deps, start dev server
4) Phase 4 → populate Manager core, verify API and WS
5) Phase 5 → populate scanner JS, test end-to-end flow
6) Phase 6 → add enhancements, QA, and ops
