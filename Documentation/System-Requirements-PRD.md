# Student Lab System - Distributed Architecture PRD
## Product Requirements Document - Final Version

### System Overview
A distributed student management system where each scanning device operates independently using local resources and cached data, with minimal dependency on the Manager node.

---

## 1. System Architecture

### Node Distribution & Responsibilities

```
[First Scan Node] → [Manager Node] → [Last Scan Node]
       ↓                  ↓               ↓
[Local Cache]      [Central Coordination]  [Local Records]
[Own Processing]   [Lightweight Tasks]     [Own Processing]
[QR Scanning]      [Data Distribution]     [Validation]
```

### A) First Scan Node (Independent Operation)
**Hardware Requirements:**
- Laptop with camera (web browser only)
- Local storage: 50MB minimum
- No external dependencies

**Local Resources & Capabilities:**
```javascript
// Local cached student database (JSON format)
const localStudentCache = {
    "557": {
        "id": 557,
        "name": "lian mohamed mahmoud sohail",
        "center": "Alakbal",
        "subject": "Math",
        "grade": "Senior 1",
        "fees": "50",
        "phone": "1228802e+09"
    }
    // ... more students
};
```

**Core Functions:**
1. **QR Code Scanning** (using device camera + jsQR library)
2. **Student Validation** (against local cache)
3. **Registration Processing** (homework scores, attendance)
4. **Manual Student Addition** (for new students)
5. **Local Data Storage** (IndexedDB/LocalStorage)
6. **Send to Manager** (only validated records)

### B) Last Scan Node (Independent Validation)
**Hardware Requirements:**
- Laptop with camera (web browser only)
- Local storage: 50MB minimum
- Receives real-time updates from Manager

**Local Resources:**
```javascript
// Local registered students file
const localRegisteredStudents = {
    "2025-09-23": [
        {
            "id": 557,
            "name": "lian mohamed mahmoud sohail",
            "registered_time": "18:49:38",
            "homework_score": 6,
            "first_scan_device": "Lab-01"
        }
        // ... students registered today
    ]
};
```

**Core Functions:**
1. **Receive Student Records** (from Manager in real-time)
2. **Local Storage Management** (maintain today's registered students)
3. **Final Validation Scanning** (QR code verification)
4. **Pass/Fail Decision** (based on local records)
5. **Log Management** (track all validations)

### C) Manager Node (Lightweight Coordinator)
**Hardware Requirements:**
- One laptop with Node.js installed
- Central coordination only

**Core Functions (Minimal Load):**
1. **Initial Data Distribution** (send student cache to First Scan nodes)
2. **Real-time Record Forwarding** (First Scan → Last Scan)
3. **Device Connection Monitoring**
4. **Dashboard & Reports**
5. **Data Export/Backup**

---

## 2. Data Flow Architecture

### Initial Setup Flow:
```
1. Manager loads Excel → converts to JSON
2. Manager distributes student cache → First Scan nodes
3. System ready for operation
```

### Operation Flow:
```
1. Student arrives → First Scan scans QR
2. First Scan checks local cache → validates student
3. First Scan processes homework/attendance → stores locally
4. First Scan sends record → Manager
5. Manager forwards record → Last Scan (real-time)
6. Last Scan stores in local file
7. Student reaches exit → Last Scan scans QR
8. Last Scan checks local file → Pass/Fail decision
```

---

## 3. Technical Implementation

### A) First Scan Node Implementation

#### Local Student Cache Structure:
```javascript
// students-cache.js (embedded in HTML)
const STUDENT_CACHE = {
    "557": {
        id: 557,
        name: "lian mohamed mahmoud sohail",
        center: "Alakbal",
        subject: "Math",
        grade: "Senior 1",
        fees: "50",
        phone: "1228802000",
        parent_phone: "1002674000"
    }
    // ... all students from Excel
};

class FirstScanNode {
    constructor() {
        this.deviceName = '';
        this.localRecords = [];
        this.managerConnection = null;
        this.scanning = false;
        
        this.init();
    }
    
    init() {
        this.setupDevice();
        this.connectToManager();
        this.initLocalStorage();
    }
    
    // QR Scanning with local processing
    async scanStudent(studentId) {
        const student = STUDENT_CACHE[studentId];
        
        if (!student) {
            this.showError("Student not found in cache");
            return;
        }
        
        // Process locally
        this.showStudentForm(student);
    }
    
    // Process and store locally
    processStudent(studentData) {
        const record = {
            id: Date.now(),
            student_id: studentData.student_id,
            homework_score: studentData.homework_score,
            exam_score: studentData.exam_score,
            timestamp: new Date().toISOString(),
            device_name: this.deviceName,
            synced: false
        };
        
        // Store locally
        this.localRecords.push(record);
        this.saveToLocalStorage();
        
        // Send to Manager
        this.sendToManager(record);
    }
    
    // Manual student addition
    addNewStudent(studentData) {
        const newId = this.generateNewId();
        const newStudent = {
            id: newId,
            ...studentData,
            created_by: this.deviceName,
            created_at: new Date().toISOString()
        };
        
        // Add to local cache
        STUDENT_CACHE[newId] = newStudent;
        
        // Send to Manager for distribution
        this.sendNewStudentToManager(newStudent);
    }
}
```

#### First Scan HTML Interface:
```html
<!DOCTYPE html>
<html>
<head>
    <title>First Scan Node</title>
    <style>
        /* Embedded CSS for offline operation */
        .scanner-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        .camera-view {
            flex: 1;
            position: relative;
        }
        
        #camera {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .scan-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 300px;
            height: 300px;
            border: 2px solid #00ff00;
        }
        
        .student-form {
            padding: 20px;
            background: white;
            display: none;
        }
    </style>
</head>
<body>
    <div class="scanner-container">
        <!-- Device Setup -->
        <div id="setup-screen">
            <h2>First Scan Node Setup</h2>
            <input type="text" id="device-name" placeholder="Device Name (e.g., Lab-01)">
            <button onclick="startScanning()">Start Scanning</button>
        </div>
        
        <!-- Camera View -->
        <div id="scanner-screen" style="display: none;">
            <div class="camera-view">
                <video id="camera" autoplay></video>
                <div class="scan-overlay"></div>
                <div id="scan-status">Ready to scan...</div>
            </div>
            
            <!-- Student Form -->
            <div id="student-form" class="student-form">
                <div id="student-info"></div>
                <form id="registration-form">
                    <label>Homework Score:</label>
                    <input type="number" id="homework-score" min="0" max="10">
                    
                    <label>Exam Score:</label>
                    <input type="number" id="exam-score" min="0" max="10">
                    
                    <label>Extra Sessions:</label>
                    <input type="number" id="extra-sessions" min="0" value="0">
                    
                    <label>Comment:</label>
                    <textarea id="comment"></textarea>
                    
                    <button type="submit">Register Student</button>
                    <button type="button" onclick="continueScanning()">Continue Scanning</button>
                </form>
            </div>
            
            <!-- Manual Add Form -->
            <div id="manual-add-form" style="display: none;">
                <h3>Add New Student</h3>
                <form id="new-student-form">
                    <input type="text" id="student-name" placeholder="Student Name" required>
                    <input type="text" id="student-center" placeholder="Center">
                    <input type="text" id="student-subject" placeholder="Subject">
                    <input type="text" id="student-grade" placeholder="Grade">
                    <input type="text" id="student-phone" placeholder="Phone">
                    <input type="text" id="parent-phone" placeholder="Parent Phone">
                    <button type="submit">Add Student</button>
                    <button type="button" onclick="cancelManualAdd()">Cancel</button>
                </form>
            </div>
        </div>
    </div>
    
    <!-- Embedded jsQR Library -->
    <script>
        // jsQR library code embedded here (minified)
        /* jsQR library content */
    </script>
    
    <!-- Embedded Student Cache -->
    <script>
        // Student cache embedded from Excel conversion
        const STUDENT_CACHE = {
            // ... student data from Excel
        };
    </script>
    
    <!-- Main Application -->
    <script>
        class FirstScanNode {
            // ... implementation as above
        }
        
        let scanner = null;
        
        function startScanning() {
            const deviceName = document.getElementById('device-name').value;
            if (!deviceName) {
                alert('Please enter device name');
                return;
            }
            
            document.getElementById('setup-screen').style.display = 'none';
            document.getElementById('scanner-screen').style.display = 'block';
            
            scanner = new FirstScanNode();
            scanner.deviceName = deviceName;
            scanner.startCamera();
        }
    </script>
</body>
</html>
```

### B) Last Scan Node Implementation

```javascript
class LastScanNode {
    constructor() {
        this.deviceName = '';
        this.registeredStudents = new Map();
        this.managerConnection = null;
        
        this.init();
    }
    
    init() {
        this.setupDevice();
        this.connectToManager();
        this.initLocalStorage();
        this.loadTodayRecords();
    }
    
    // Receive student record from Manager
    receiveStudentRecord(record) {
        const today = new Date().toISOString().split('T')[0];
        
        if (!this.registeredStudents.has(today)) {
            this.registeredStudents.set(today, new Map());
        }
        
        this.registeredStudents.get(today).set(record.student_id, record);
        this.saveToLocalStorage();
        
        this.updateUI(`Student ${record.student_id} registered for validation`);
    }
    
    // Validate student at exit
    async validateStudent(studentId) {
        const today = new Date().toISOString().split('T')[0];
        const todayRecords = this.registeredStudents.get(today);
        
        if (!todayRecords || !todayRecords.has(studentId)) {
            this.showResult("BLOCKED", "Student not registered today", studentId);
            return false;
        }
        
        const studentRecord = todayRecords.get(studentId);
        this.showResult("PASSED", "Student validated successfully", studentId, studentRecord);
        
        // Log the validation
        this.logValidation(studentId, "PASSED", studentRecord);
        return true;
    }
    
    showResult(status, message, studentId, record = null) {
        const resultDiv = document.getElementById('validation-result');
        resultDiv.className = `result ${status.toLowerCase()}`;
        resultDiv.innerHTML = `
            <h2>${status}</h2>
            <p><strong>Student ID:</strong> ${studentId}</p>
            <p><strong>Status:</strong> ${message}</p>
            ${record ? `
                <p><strong>Name:</strong> ${record.student_name || 'N/A'}</p>
                <p><strong>Homework:</strong> ${record.homework_score || 'N/A'}</p>
                <p><strong>Registered:</strong> ${record.timestamp || 'N/A'}</p>
            ` : ''}
        `;
        resultDiv.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            resultDiv.style.display = 'none';
            this.continueScanningMode();
        }, 3000);
    }
}
```

### C) Manager Node (Lightweight Server)

```javascript
// manager-server.js
const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const XLSX = require('xlsx');

class ManagerNode {
    constructor() {
        this.app = express();
        this.server = null;
        this.wss = null;
        this.connectedDevices = new Map();
        this.studentCache = {};
        
        this.init();
    }
    
    init() {
        this.loadStudentData();
        this.setupServer();
        this.setupWebSocket();
        this.startServer();
    }
    
    // Load and convert Excel to JSON
    loadStudentData() {
        try {
            const workbook = XLSX.readFile('./data/students.xlsx');
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            // Convert to cache format
            jsonData.forEach(row => {
                this.studentCache[row.ID] = {
                    id: row.ID,
                    name: row.Name,
                    center: row.Center,
                    subject: row.Subject,
                    grade: row.Grade,
                    fees: row.Fees,
                    phone: row.Phone,
                    parent_phone: row['Parent Phone']
                };
            });
            
            console.log(`✅ Loaded ${Object.keys(this.studentCache).length} students`);
        } catch (error) {
            console.error('❌ Failed to load student data:', error.message);
        }
    }
    
    setupServer() {
        this.app.use(express.static('public'));
        this.app.use(express.json());
        
        // Serve First Scan interface
        this.app.get('/first-scan', (req, res) => {
            // Generate HTML with embedded student cache
            const html = this.generateFirstScanHTML();
            res.send(html);
        });
        
        // Serve Last Scan interface
        this.app.get('/last-scan', (req, res) => {
            res.sendFile(path.join(__dirname, 'public/last-scan.html'));
        });
        
        // API for student cache
        this.app.get('/api/student-cache', (req, res) => {
            res.json(this.studentCache);
        });
    }
    
    setupWebSocket() {
        this.wss = new WebSocket.Server({ port: 3001 });
        
        this.wss.on('connection', (ws) => {
            ws.on('message', (message) => {
                const data = JSON.parse(message);
                this.handleMessage(ws, data);
            });
        });
    }
    
    handleMessage(ws, data) {
        switch (data.type) {
            case 'register_device':
                this.registerDevice(ws, data);
                break;
                
            case 'student_registered':
                this.forwardToLastScan(data);
                break;
                
            case 'new_student':
                this.distributeNewStudent(data);
                break;
        }
    }
    
    // Forward student record from First Scan to Last Scan
    forwardToLastScan(studentRecord) {
        this.connectedDevices.forEach((device, ws) => {
            if (device.type === 'last_scan') {
                ws.send(JSON.stringify({
                    type: 'receive_student_record',
                    record: studentRecord
                }));
            }
        });
    }
    
    // Generate First Scan HTML with embedded cache
    generateFirstScanHTML() {
        const cacheScript = `const STUDENT_CACHE = ${JSON.stringify(this.studentCache, null, 2)};`;
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>First Scan Node</title>
            <!-- ... CSS styles ... -->
        </head>
        <body>
            <!-- ... HTML structure ... -->
            
            <script>
                ${cacheScript}
                // ... First Scan implementation ...
            </script>
        </body>
        </html>
        `;
    }
}

new ManagerNode();
```

---

## 4. System Benefits

### ✅ Independent Operation:
- Each scanning node works with local resources
- No dependency on Manager for scanning operations
- Minimal network traffic

### ✅ Fast Performance:
- Local cache lookup (no database queries)
- Instant QR code validation
- Real-time processing

### ✅ Fault Tolerance:
- Nodes continue working if Manager goes down
- Local storage preserves data
- Graceful degradation

### ✅ Scalability:
- Easy to add more scanning nodes
- Manager handles minimal load
- Distributed processing

This architecture gives you maximum independence for each device while maintaining coordination through the lightweight Manager node.