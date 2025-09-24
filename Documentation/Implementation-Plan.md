## Student Lab System - Implementation Plan (Win/PowerShell)

This plan translates the PRD into an actionable roadmap with phases, tasks, and Windows PowerShell commands. Phases are sequenced as requested: file/folder scaffolding → web UI → hosting → Manager core → First/Last scanners → remaining features.

---

## Phase 0 — Prerequisites and Environment

- Ensure you have:
  - Node.js 18+ and npm
  - Windows PowerShell (running as Administrator when noted)
  - Excel file ready at `manager/data/students.xlsx`

Commands:
```powershell
$workspace = "C:\Users\hamad\Desktop\stud sys v2"
Set-Location "$workspace"
node -v
npm -v
```

---

## Phase 1 — Files and Folders Creation (Scaffolding)

Goal: Create a clean, organized project layout with placeholders.

Planned structure:
```
stud sys v2/
  implementation-plan.md
  distributed-system-prd.md
  manager/
    package.json
    manager-server.js
    /public/
      first-scan.html
      last-scan.html
      /js/
        first-scan.js
        last-scan.js
      /css/
        styles.css
      /vendor/
        jsqr.min.js
    /data/
      students.xlsx
    /logs/
    README.md
    .gitignore
```

Commands:
```powershell
$workspace = "C:\Users\hamad\Desktop\stud sys v2"
Set-Location "$workspace"

# Create directories
New-Item -ItemType Directory -Force -Path "manager","manager\public","manager\public\js","manager\public\css","manager\public\vendor","manager\data","manager\logs" | Out-Null

# Create placeholder files
New-Item -ItemType File -Force -Path "manager\manager-server.js","manager\public\first-scan.html","manager\public\last-scan.html","manager\public\js\first-scan.js","manager\public\js\last-scan.js","manager\public\css\styles.css","manager\README.md","manager\.gitignore" | Out-Null

# Optional placeholder for Excel (you will replace with the real file)
New-Item -ItemType File -Force -Path "manager\data\students.xlsx" | Out-Null
```

---

## Phase 2 — Web UI (Static, Offline-First UIs)

Goal: Build the First Scan and Last Scan HTML/JS/CSS interfaces to run fully in the browser using localStorage/IndexedDB and camera + jsQR.

Tasks:
- First Scan UI
  - Setup screen for device name
  - Camera view + scan overlay
  - Student form (homework/exam/extra/comment)
  - Local caching of records; send events to Manager via WebSocket
- Last Scan UI
  - Display of validation result
  - Receive student-records in real time; validate by scanning
  - Local storage of today’s registered students
- Shared
  - Styles in `public/css/styles.css`
  - Vendor `jsqr.min.js` locally stored for offline use

Commands:
```powershell
$workspace = "C:\Users\hamad\Desktop\stud sys v2"
Set-Location "$workspace"

# Download jsQR vendor locally (for offline use)
$jsqrUrl = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"
$jsqrOut = "manager\public\vendor\jsqr.min.js"
Invoke-WebRequest -Uri $jsqrUrl -OutFile $jsqrOut
```

Notes:
- Embed minimal inline scripts in `first-scan.html` and `last-scan.html` to bootstrap; load app logic from `public/js/*.js`.
- Ensure camera access via `navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })`.

---

## Phase 3 — Hosting (Local LAN + Autostart)

Goal: Serve static UIs and APIs from the Manager node; enable LAN access and autostart.

Tasks:
- Express static hosting of `manager/public`
- API `GET /api/student-cache` returns converted Excel cache
- WebSocket server on port 3001 (forward records to Last Scan)
- Bind HTTP server to `0.0.0.0:3000` for LAN access
- Optional: Windows Firewall rule and PM2 process manager

Commands (initialize Node project and deps):
```powershell
Set-Location "C:\Users\hamad\Desktop\stud sys v2\manager"

npm init -y
npm install express ws xlsx cors
npm install --save-dev nodemon

# Add scripts
npm pkg set scripts.start="node manager-server.js"
npm pkg set scripts.dev="nodemon manager-server.js"
```

Commands (run server locally):
```powershell
Set-Location "C:\Users\hamad\Desktop\stud sys v2\manager"
npm run dev
```

Optional LAN setup (firewall + PM2):
```powershell
# Allow inbound on ports 3000 (HTTP) and 3001 (WS)
New-NetFirewallRule -DisplayName "StudentLab-HTTP-3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -Profile Any | Out-Null
New-NetFirewallRule -DisplayName "StudentLab-WS-3001"   -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -Profile Any | Out-Null

# Optional: PM2 for Windows autostart
npm install -g pm2
pm2 start manager-server.js --name "student-manager" --cwd "C:\Users\hamad\Desktop\stud sys v2\manager"
pm2 save
pm2 startup windows
```

---

## Phase 4 — Manager Core (Coordinator)

Goal: Implement minimal Manager server that loads Excel → serves cache → forwards records.

Tasks:
- Load Excel: `XLSX.readFile('data/students.xlsx')` and convert to cache map keyed by ID
- HTTP: serve static `public`, `GET /api/student-cache`
- WebSocket: accept device registration; forward `student_registered` to all `last_scan` clients
- Broadcast new students to `first_scan` clients
- Logging to `manager/logs`

Acceptance:
- `GET http://<host>:3000/first-scan` loads UI
- `GET http://<host>:3000/last-scan` loads UI
- `GET /api/student-cache` returns JSON
- WS broadcast observed by Last Scan when First Scan sends a record

Run:
```powershell
Set-Location "C:\Users\hamad\Desktop\stud sys v2\manager"
npm start
```

---

## Phase 5 — First and Last Scanners (Browser Apps)

Goal: Implement scanning logic and local persistence.

First Scan tasks:
- Read student ID from QR via `jsQR` on video frames
- Lookup in in-memory `STUDENT_CACHE` (fetched once or embedded)
- Show form; on submit, create record `{ student_id, homework_score, exam_score, timestamp, device_name }`
- Save locally (localStorage/IndexedDB) and send WS `{ type: 'student_registered', record }`

Last Scan tasks:
- Maintain `registeredStudents[today][student_id] = record`
- On scan, validate: if record exists → show PASSED; else BLOCKED
- Log results to local storage (and optionally to Manager)

Commands (development run and quick open):
```powershell
# Start Manager (serves both UIs)
Set-Location "C:\Users\hamad\Desktop\stud sys v2\manager"
npm run dev
# In browser: http://localhost:3000/first-scan and http://localhost:3000/last-scan
```

---

## Phase 6 — Remaining Features, QA, and Ops

Features:
- Device registration handshake on WS (`register_device` with role + name)
- New student addition flow (`new_student`) and broadcast to all First Scans
- Daily export of registered students (JSON/CSV) to `manager/logs`
- Dashboard view for basic reports

QA Checklist:
- Offline mode: First Scan continues scanning and storing if WS down
- Reconnect logic for WS
- Data correctness between Excel → cache → UIs

Ops:
- Backup `manager/data/students.xlsx` and `manager/logs/*`
- PM2 restart and logs: `pm2 restart student-manager`, `pm2 logs student-manager`

---

## Appendix — File Content Stubs (to fill during implementation)

Use these commands when you’re ready to populate files with initial boilerplate. Replace the here-strings with your actual implementation.

manager/.gitignore:
```powershell
@"
node_modules/
logs/
*.log
.DS_Store
"@ | Set-Content -Encoding UTF8 "manager\.gitignore"
```

manager/manager-server.js (skeleton):
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
      // Broadcast to first_scan devices if needed
      for (const [client, info] of devices.entries()) {
        if (info.role === 'first_scan' && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'new_student', student: data.student }));
        }
      }
      // Update cache in memory (and optionally persist)
      studentCache[data.student.id] = data.student;
      return;
    }
  });

  ws.on('close', () => devices.delete(ws));
});

console.log(`WS listening on ${WS_PORT}`);
"@ | Set-Content -Encoding UTF8 "manager\manager-server.js"
```

manager/public/first-scan.html (skeleton):
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

manager/public/last-scan.html (skeleton):
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

---

## Done
- Execute phases in order. Use the provided PowerShell commands to scaffold, install, run, and (optionally) host with PM2.
- Fill each stub with production-ready code following the PRD once scaffolding and hosting are verified.

manager/public/js/first-scan.js (skeleton):
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
    if (!deviceName) {
      alert('Enter device name');
      return;
    }
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
      status.textContent = `Not found: ${studentId}`;
      return;
    }
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

manager/public/js/last-scan.js (skeleton):
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

  function todayKey() {
    return new Date().toISOString().split('T')[0];
  }

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
      if (code && code.data) {
        onQr(code.data);
      }
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

manager/public/css/styles.css (skeleton):
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
