const path = require('path');
const express = require('express');
const WebSocket = require('ws');
const fs = require('fs');
const XLSX = require('xlsx');
const cors = require('cors');
const https = require('https');
const http = require('http');
const { initializeDatabase, Database } = require('./database');
const multer = require('multer');

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const WS_PORT = process.env.WS_PORT || 3001;
const WSS_PORT = process.env.WSS_PORT || 3444;

// OFFLINE-FIRST CONFIGURATION - No internet required after setup
const OFFLINE_MODE = process.env.OFFLINE_MODE || true; // Enable offline-first mode
const HOTSPOT_ONLY = process.env.HOTSPOT_ONLY || true; // Work with hotspot/router only
const ZERO_DATA_LOSS = process.env.ZERO_DATA_LOSS || true; // Enable zero data loss protection

// Function to get real IP address
function getRealIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) addresses and IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const REAL_IP = getRealIP();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'students-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) and CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const app = express();
app.use(cors());
app.use(express.json());

// HTTPS Security Headers Middleware
app.use((req, res, next) => {
  // Add security headers for HTTPS requests
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  
  // Add Content Security Policy for HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Content-Security-Policy', 
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "connect-src 'self' wss: ws:; " +
      "media-src 'self' blob:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data:;"
    );
  }
  
  next();
});

// Serve static files from organized web interface folder
app.use(express.static(path.join(__dirname, '..', 'web-interface')));

let studentCache = {};
let systemLogs = [];
let serverStartTime = Date.now();
let totalRegistrations = 0;
let totalValidations = 0;

// Initialize devices Map early to avoid reference errors
const devices = new Map();

// Connection management and auto-reconnection settings
const CONNECTION_CONFIG = {
  HEARTBEAT_INTERVAL: 30000, // 30 seconds (increased from 10)
  CONNECTION_TIMEOUT: 120000, // 2 minutes (increased from 30 seconds)
  RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 5000, // 5 seconds (increased from 3)
  DEVICE_DISCOVERY_INTERVAL: 15000, // 15 seconds (increased from 5)
  NETWORK_SCAN_INTERVAL: 30000 // 30 seconds (increased from 10)
};

// Track connection attempts and network status
const connectionAttempts = new Map();
const networkStatus = {
  isOnline: true,
  lastCheck: Date.now(),
  devicesFound: new Set()
};

// Smart Excel File Detection and Import System
function detectColumnMappings(headers) {
  const mappings = {
    id: null,
    name: null,
    center: null,
    subject: null,
    grade: null,
    fees: null,
    phone: null,
    parent_phone: null,
    email: null,
    address: null
  };
  
  // Common variations for each field
  const fieldVariations = {
    id: ['id', 'student_id', 'studentid', 'student id', 'رقم الطالب', 'رقم الطالب', 'رقم', 'number', 'no', '#'],
    name: ['name', 'student_name', 'studentname', 'student name', 'full_name', 'fullname', 'الاسم', 'اسم الطالب', 'الاسم الكامل'],
    center: ['center', 'centre', 'branch', 'location', 'المركز', 'الفرع', 'المكان', 'branch_name'],
    subject: ['subject', 'course', 'material', 'المادة', 'المقرر', 'الدرس', 'course_name'],
    grade: ['grade', 'level', 'class', 'الصف', 'المستوى', 'الدرجة', 'class_name'],
    fees: ['fees', 'fee', 'amount', 'price', 'cost', 'الرسوم', 'المبلغ', 'التكلفة', 'السعر'],
    phone: ['phone', 'mobile', 'tel', 'telephone', 'phone_number', 'mobile_number', 'الهاتف', 'الجوال', 'رقم الهاتف'],
    parent_phone: ['parent_phone', 'parentphone', 'parent phone', 'guardian_phone', 'guardianphone', 'هاتف الوالد', 'هاتف الوالدة', 'رقم ولي الأمر'],
    email: ['email', 'e_mail', 'email_address', 'البريد الإلكتروني', 'الإيميل'],
    address: ['address', 'location', 'العنوان', 'المكان', 'الموقع']
  };
  
  // Convert headers to lowercase for comparison
  const lowerHeaders = headers.map(h => h ? h.toString().toLowerCase().trim() : '');
  
  // Find matches for each field
  for (const [field, variations] of Object.entries(fieldVariations)) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      const header = lowerHeaders[i];
      if (variations.some(variation => 
        header.includes(variation) || 
        variation.includes(header) ||
        header === variation
      )) {
        mappings[field] = i;
        break;
      }
    }
  }
  
  return mappings;
}

function parseStudentData(worksheet, mappings) {
  const students = [];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  // Start from row 2 (skip header row)
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const student = {};
    let hasData = false;
    
    // Extract data based on mappings
    for (const [field, colIndex] of Object.entries(mappings)) {
      if (colIndex !== null) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
        const cell = worksheet[cellAddress];
        if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
          student[field] = cell.v.toString().trim();
          hasData = true;
        } else {
          student[field] = null;
        }
      } else {
        student[field] = null;
      }
    }
    
    // Only add student if they have a name (name is required, ID is optional)
    if (hasData && student.name) {
      // Keep ID empty if not provided
      if (!student.id) {
        student.id = '';
      }
      
      // Keep fields empty if not provided (no default values)
      // student.center = student.center || '';
      // student.subject = student.subject || '';
      // student.grade = student.grade || '';
      // student.fees = student.fees || '0';
      // student.phone = student.phone || '';
      // student.parent_phone = student.parent_phone || '';
      // student.email = student.email || '';
      // student.address = student.address || '';
      
      students.push(student);
    }
  }
  
  return students;
}

function analyzeExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet || !worksheet['!ref']) {
      throw new Error('No data found in the Excel file');
    }
    
    // Get headers from first row
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headers = [];
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
      const cell = worksheet[cellAddress];
      headers.push(cell ? cell.v : `Column ${col + 1}`);
    }
    
    // Detect column mappings
    const mappings = detectColumnMappings(headers);
    
    // Parse student data
    const students = parseStudentData(worksheet, mappings);
    
    return {
      success: true,
      headers: headers,
      mappings: mappings,
      students: students,
      totalRows: range.e.r - range.s.r,
      detectedFields: Object.keys(mappings).filter(field => mappings[field] !== null)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Analyze CSV files
function analyzeCSVFile(filePath) {
  try {
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return { success: false, error: 'CSV file must have at least a header and one data row' };
    }
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const mappings = detectFieldMappings(headers);
    
    const students = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length === headers.length) {
        const student = parseStudentDataFromValues(values, headers, mappings);
        if (student) {
          students.push(student);
        }
      }
    }
    
    return {
      success: true,
      headers: headers,
      mappings: mappings,
      students: students,
      totalRows: lines.length - 1,
      detectedFields: Object.keys(mappings).filter(field => mappings[field] !== null)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Analyze JSON files
function analyzeJSONFile(filePath) {
  try {
    const jsonContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(jsonContent);
    
    let students = [];
    if (Array.isArray(data)) {
      students = data;
    } else if (data.students && Array.isArray(data.students)) {
      students = data.students;
    } else if (data.data && Array.isArray(data.data)) {
      students = data.data;
    } else {
      return { success: false, error: 'JSON file must contain an array of students or an object with students/data array' };
    }
    
    // Normalize student data
    const normalizedStudents = students.map(student => {
      return {
        id: student.id || student.student_id || student.ID || '',
        name: student.name || student.student_name || student.Name || student.full_name || '',
        center: student.center || student.Center || student.centre || '',
        grade: student.grade || student.Grade || student.class || student.level || '',
        phone: student.phone || student.Phone || student.phone_number || student.mobile || '',
        parent_phone: student.parent_phone || student.Parent_Phone || student.parent_phone_number || student.guardian_phone || '',
        subject: student.subject || student.Subject || student.course || student.material || '',
        fees: student.fees || student.Fees || student.fee || student.cost || '0',
        email: student.email || student.Email || student.email_address || '',
        address: student.address || student.Address || student.location || ''
      };
    });
    
    return {
      success: true,
      headers: Object.keys(normalizedStudents[0] || {}),
      mappings: {},
      students: normalizedStudents,
      totalRows: normalizedStudents.length,
      detectedFields: Object.keys(normalizedStudents[0] || {})
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Analyze XML files
function analyzeXMLFile(filePath) {
  try {
    const xmlContent = fs.readFileSync(filePath, 'utf8');
    
    // Simple XML parsing for student data
    const studentMatches = xmlContent.match(/<student[^>]*>[\s\S]*?<\/student>/gi) || 
                          xmlContent.match(/<record[^>]*>[\s\S]*?<\/record>/gi) ||
                          xmlContent.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
    
    if (!studentMatches || studentMatches.length === 0) {
      return { success: false, error: 'No student records found in XML file' };
    }
    
    const students = [];
    for (const match of studentMatches) {
      const student = {};
      
      // Extract common fields
      const idMatch = match.match(/<(?:id|student_id|ID)[^>]*>([^<]*)<\/(?:id|student_id|ID)>/i);
      const nameMatch = match.match(/<(?:name|student_name|Name)[^>]*>([^<]*)<\/(?:name|student_name|Name)>/i);
      const centerMatch = match.match(/<(?:center|Center|centre)[^>]*>([^<]*)<\/(?:center|Center|centre)>/i);
      const gradeMatch = match.match(/<(?:grade|Grade|class|level)[^>]*>([^<]*)<\/(?:grade|Grade|class|level)>/i);
      const phoneMatch = match.match(/<(?:phone|Phone|mobile)[^>]*>([^<]*)<\/(?:phone|Phone|mobile)>/i);
      const parentPhoneMatch = match.match(/<(?:parent_phone|parent_phone_number|guardian_phone)[^>]*>([^<]*)<\/(?:parent_phone|parent_phone_number|guardian_phone)>/i);
      const subjectMatch = match.match(/<(?:subject|Subject|course|material)[^>]*>([^<]*)<\/(?:subject|Subject|course|material)>/i);
      const feesMatch = match.match(/<(?:fees|Fees|fee|cost)[^>]*>([^<]*)<\/(?:fees|Fees|fee|cost)>/i);
      const emailMatch = match.match(/<(?:email|Email|email_address)[^>]*>([^<]*)<\/(?:email|Email|email_address)>/i);
      const addressMatch = match.match(/<(?:address|Address|location)[^>]*>([^<]*)<\/(?:address|Address|location)>/i);
      
      student.id = idMatch ? idMatch[1].trim() : '';
      student.name = nameMatch ? nameMatch[1].trim() : '';
      student.center = centerMatch ? centerMatch[1].trim() : '';
      student.grade = gradeMatch ? gradeMatch[1].trim() : '';
      student.phone = phoneMatch ? phoneMatch[1].trim() : '';
      student.parent_phone = parentPhoneMatch ? parentPhoneMatch[1].trim() : '';
      student.subject = subjectMatch ? subjectMatch[1].trim() : '';
      student.fees = feesMatch ? feesMatch[1].trim() : '0';
      student.email = emailMatch ? emailMatch[1].trim() : '';
      student.address = addressMatch ? addressMatch[1].trim() : '';
      
      if (student.name) {
        students.push(student);
      }
    }
    
    return {
      success: true,
      headers: ['id', 'name', 'center', 'grade', 'phone', 'parent_phone', 'subject', 'fees', 'email', 'address'],
      mappings: {},
      students: students,
      totalRows: students.length,
      detectedFields: ['id', 'name', 'center', 'grade', 'phone', 'parent_phone', 'subject', 'fees', 'email', 'address']
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Helper function to parse student data from values
function parseStudentDataFromValues(values, headers, mappings) {
  const student = {};
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const value = values[i] || '';
    
    if (mappings.id && mappings.id.toLowerCase() === header.toLowerCase()) {
      student.id = value;
    } else if (mappings.name && mappings.name.toLowerCase() === header.toLowerCase()) {
      student.name = value;
    } else if (mappings.center && mappings.center.toLowerCase() === header.toLowerCase()) {
      student.center = value;
    } else if (mappings.grade && mappings.grade.toLowerCase() === header.toLowerCase()) {
      student.grade = value;
    } else if (mappings.phone && mappings.phone.toLowerCase() === header.toLowerCase()) {
      student.phone = value;
    } else if (mappings.parent_phone && mappings.parent_phone.toLowerCase() === header.toLowerCase()) {
      student.parent_phone = value;
    } else if (mappings.subject && mappings.subject.toLowerCase() === header.toLowerCase()) {
      student.subject = value;
    } else if (mappings.fees && mappings.fees.toLowerCase() === header.toLowerCase()) {
      student.fees = value;
    } else if (mappings.email && mappings.email.toLowerCase() === header.toLowerCase()) {
      student.email = value;
    } else if (mappings.address && mappings.address.toLowerCase() === header.toLowerCase()) {
      student.address = value;
    }
  }
  
  return student.name ? student : null;
}

// Auto Excel Import from Student-Data folder
function setupAutoExcelImport() {
  const studentDataPath = path.join(__dirname, '..', '..', 'Student-Data');
  
  // Check if Student-Data folder exists
  if (!fs.existsSync(studentDataPath)) {
    logToSystem('info', 'Student-Data folder not found, creating it...');
    fs.mkdirSync(studentDataPath, { recursive: true });
    return;
  }

  // Auto-import Excel files on startup
  autoImportExcelFiles();

  // Set up periodic scanning (every 30 seconds)
  setInterval(() => {
    autoImportExcelFiles();
  }, 30000);

  logToSystem('success', 'Auto Excel import system initialized');
}

async function autoImportExcelFiles() {
  const studentDataPath = path.join(__dirname, '..', '..', 'Student-Data');
  
  try {
    const files = fs.readdirSync(studentDataPath);
    
    // Support all common data file formats
    const dataFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.xlsx', '.xls', '.csv', '.txt', '.json', '.xml'].includes(ext);
    });

    if (dataFiles.length === 0) {
      return; // No data files found
    }

    logToSystem('info', `Found ${dataFiles.length} data file(s) in Student-Data folder: ${dataFiles.join(', ')}`);

    for (const file of dataFiles) {
      const filePath = path.join(studentDataPath, file);
      await processAutoImportFile(filePath, file);
    }

  } catch (error) {
    logToSystem('error', `Auto import scan failed: ${error.message}`);
  }
}

async function processAutoImportFile(filePath, fileName) {
  try {
    logToSystem('info', `Processing auto-import: ${fileName}`);

    const fileExt = path.extname(fileName).toLowerCase();
    let analysis;

    // Handle different file formats
    if (['.xlsx', '.xls'].includes(fileExt)) {
      // Excel files
      analysis = analyzeExcelFile(filePath);
    } else if (fileExt === '.csv') {
      // CSV files
      analysis = analyzeCSVFile(filePath);
    } else if (fileExt === '.json') {
      // JSON files
      analysis = analyzeJSONFile(filePath);
    } else if (fileExt === '.txt') {
      // Text files (try CSV format first)
      analysis = analyzeCSVFile(filePath);
    } else if (fileExt === '.xml') {
      // XML files
      analysis = analyzeXMLFile(filePath);
    } else {
      logToSystem('warning', `Unsupported file format: ${fileExt} for ${fileName}`);
      return;
    }
    
    if (!analysis.success) {
      logToSystem('warning', `Failed to analyze ${fileName}: ${analysis.error}`);
      return;
    }

    if (analysis.students.length === 0) {
      logToSystem('warning', `No student data found in ${fileName}`);
      return;
    }

    logToSystem('info', `Found ${analysis.students.length} students in ${fileName}`);

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Import students to database
    for (const student of analysis.students) {
      try {
        // Create/update student (auto-import always uses 'add' mode)
        const result = await Database.createStudent(student);
        
        if (result.affectedRows > 0) {
          if (result.changedRows > 0) {
            updatedCount++;
          } else {
            importedCount++;
          }
        } else {
          skippedCount++;
        }

      } catch (error) {
        errors.push({
          student: student.name || student.id,
          error: error.message
        });
        skippedCount++;
      }
    }

    // Update student cache
    await loadStudentData();

    // Broadcast updated student cache to all devices
    broadcastStudentCacheUpdate();

    logToSystem('success', `Auto-import completed for ${fileName}: ${importedCount} imported, ${updatedCount} updated, ${skippedCount} skipped`);

    if (errors.length > 0) {
      logToSystem('warning', `Auto-import errors in ${fileName}: ${errors.length} errors`);
      errors.forEach(error => {
        logToSystem('warning', `  - ${error.student}: ${error.error}`);
      });
    }

    // Move processed file to backup folder
    await moveProcessedFile(filePath, fileName);

  } catch (error) {
    logToSystem('error', `Auto-import failed for ${fileName}: ${error.message}`);
  }
}

async function moveProcessedFile(filePath, fileName) {
  try {
    const backupPath = path.join(__dirname, '..', '..', 'Student-Data', 'processed');
    
    // Create backup folder if it doesn't exist
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(fileName);
    const name = path.basename(fileName, ext);
    const backupFileName = `${name}_processed_${timestamp}${ext}`;
    const backupFilePath = path.join(backupPath, backupFileName);

    // Move file to backup folder
    fs.renameSync(filePath, backupFilePath);
    
    logToSystem('info', `Moved processed file to: ${backupFileName}`);

  } catch (error) {
    logToSystem('warning', `Failed to move processed file ${fileName}: ${error.message}`);
  }
}

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

// Enhanced connection monitoring and device discovery
function startConnectionMonitoring() {
  // Monitor device connections and detect disconnections
  setInterval(() => {
    const now = Date.now();
    const disconnectedDevices = [];
    
    for (const [wsClient, info] of devices.entries()) {
      if (!info.lastSeen || (now - info.lastSeen > CONNECTION_CONFIG.CONNECTION_TIMEOUT)) {
        disconnectedDevices.push({ ws: wsClient, info });
      }
    }
    
    // Handle disconnected devices
    disconnectedDevices.forEach(({ ws, info }) => {
      logToSystem('warning', `Device connection timeout: ${info.name} (${info.role})`, {
        lastSeen: info.lastSeen,
        timeout: now - info.lastSeen
      });
      
      // Remove from devices map
      devices.delete(ws);
      
      // Notify admins
      broadcastToAdmins({
        type: 'device_timeout',
        name: info.name,
        role: info.role,
        timestamp: new Date().toISOString()
      });
    });
    
    // Update network status
    updateNetworkStatus();
    
  }, CONNECTION_CONFIG.DEVICE_DISCOVERY_INTERVAL);
}

function updateNetworkStatus() {
  const now = Date.now();
  const onlineDevices = Array.from(devices.values()).filter(d => 
    d.lastSeen && (now - d.lastSeen < CONNECTION_CONFIG.CONNECTION_TIMEOUT)
  );
  
  const previousStatus = networkStatus.isOnline;
  networkStatus.isOnline = onlineDevices.length > 0;
  networkStatus.lastCheck = now;
  networkStatus.devicesFound = new Set(onlineDevices.map(d => d.name));
  
  // Notify if network status changed (with debouncing to reduce spam)
  if (previousStatus !== networkStatus.isOnline) {
    // Only log significant status changes, not temporary fluctuations
    const statusChangeThreshold = 5000; // 5 seconds
    const timeSinceLastChange = now - (networkStatus.lastStatusChange || 0);
    
    if (timeSinceLastChange > statusChangeThreshold) {
      logToSystem(networkStatus.isOnline ? 'success' : 'warning', 
        `Network status changed: ${networkStatus.isOnline ? 'Online' : 'Offline'}`, {
          onlineDevices: onlineDevices.length,
          totalDevices: devices.size
        });
      
      broadcastToAdmins({
        type: 'network_status_change',
        isOnline: networkStatus.isOnline,
        onlineDevices: onlineDevices.length,
        timestamp: new Date().toISOString()
      });
      
      networkStatus.lastStatusChange = now;
    }
  }
}

// Enhanced device discovery and reconnection assistance
function broadcastDeviceDiscovery() {
  const discoveryMessage = {
    type: 'device_discovery',
    serverInfo: {
      host: 'localhost',
      httpPort: HTTP_PORT,
      httpsPort: HTTPS_PORT,
      wsPort: WS_PORT,
      wssPort: WSS_PORT,
      timestamp: new Date().toISOString()
    },
    connectedDevices: Array.from(devices.values()).map(info => ({
      name: info.name,
      role: info.role,
      lastSeen: info.lastSeen
    }))
  };
  
  // Broadcast to all connected devices
  for (const [wsClient, info] of devices.entries()) {
    if (wsClient.readyState === WebSocket.OPEN) {
      try {
        wsClient.send(JSON.stringify(discoveryMessage));
      } catch (error) {
        console.error(`Failed to send discovery to ${info.name}:`, error);
      }
    }
  }
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

function broadcastToDataCollectionManager(message) {
  for (const [wsClient, info] of devices.entries()) {
    if (info.role === 'data_collection_manager' && wsClient.readyState === WebSocket.OPEN) {
      try {
        wsClient.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send to data collection manager:', error);
      }
    }
  }
}

// Broadcast updated statistics to all admin dashboards
async function broadcastUpdatedStats() {
  const uptime = Date.now() - serverStartTime;
  const now = Date.now();
  const onlineDevices = Array.from(devices.values()).filter(d => d.lastSeen && (now - d.lastSeen < 30000));
  const activeScanners = onlineDevices.filter(d => d.role === 'first_scan' || d.role === 'last_scan').length;
  const today = new Date().toISOString().split('T')[0];
  
  // Count today's registrations from MySQL database
  let todayRegistrations = 0;
  try {
    const registrations = await Database.getEntryRegistrationsByDate(today);
    todayRegistrations = registrations.length;
  } catch (error) {
    logToSystem('error', `Failed to count today's registrations from database: ${error.message}`);
    // Fallback to file-based counting
    try {
      const logsDir = path.join(__dirname, '..', '..', 'Logs');
      const file = path.join(logsDir, `registrations-${today}.json`);
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        todayRegistrations = data.filter(record => record.record && record.record.student_id).length;
      }
    } catch (fileError) {
      console.error('Error counting today registrations from file:', fileError);
    }
  }
  
  // Count system errors from logs
  const systemErrors = systemLogs.filter(log => log.level === 'error').length;
  
  // Count total students from MySQL database
  let totalStudents = 0;
  try {
    const allStudents = await Database.getAllStudents();
    totalStudents = allStudents.length;
  } catch (error) {
    logToSystem('error', `Failed to count total students from database: ${error.message}`);
    totalStudents = Object.keys(studentCache).length;
  }
  
  // Count total registrations from MySQL database
  let totalRegistrations = 0;
  try {
    const allRegistrations = await Database.getAllEntryRegistrations();
    totalRegistrations = allRegistrations.length;
  } catch (error) {
    logToSystem('error', `Failed to count total registrations from database: ${error.message}`);
  }
  
  // Count total validations from MySQL database
  let totalValidations = 0;
  try {
    const allValidations = await Database.getAllExitValidations();
    totalValidations = allValidations.length;
  } catch (error) {
    logToSystem('error', `Failed to count total validations from database: ${error.message}`);
  }
  
  const stats = {
    totalStudents: totalStudents,
    activeScanners: activeScanners,
    todayRegistrations: todayRegistrations,
    systemErrors: systemErrors,
    totalDevices: devices.size,
    onlineDevices: onlineDevices.length,
    totalRegistrations: totalRegistrations,
    totalValidations: totalValidations,
    serverUptime: uptime,
    systemLogsCount: systemLogs.length
  };
  
  broadcastToAdmins({
    type: 'server_stats',
    stats,
    timestamp: new Date().toISOString()
  });
}

async function loadStudentData() {
  try {
    // Load students from MySQL database
    const students = await Database.getAllStudents();
    
    if (students.length === 0) {
      logToSystem('warning', 'No students found in database');
      logToSystem('info', 'Creating sample data for testing');
      
      // Create sample students in database
      await Database.createStudent({
        id: "557",
        name: "lian mohamed mahmoud sohail",
        center: "Alakbal",
        subject: "Math",
        grade: "Senior 1",
        fees: "50",
        phone: "1228802000",
        parent_phone: "1002674000",
        fees_1: "50",
        session_sequence: "",
        guest_info: ""
      });
      
      await Database.createStudent({
        id: "123",
        name: "Test Student",
        center: "Test Center",
        subject: "Science",
        grade: "Grade 10",
        fees: "40",
        phone: "1234567890",
        parent_phone: "0987654321",
        fees_1: "40",
        session_sequence: "",
        guest_info: ""
      });
      
      // Reload after creating sample data
      const newStudents = await Database.getAllStudents();
      studentCache = {};
      newStudents.forEach(student => {
        studentCache[student.id] = student;
      });
    } else {
      // Convert array to object for compatibility
      studentCache = {};
      students.forEach(student => {
        studentCache[student.id] = student;
      });
    }
    
    logToSystem('success', `Loaded ${Object.keys(studentCache).length} students from MySQL database`);
  } catch (e) {
    logToSystem('error', `Failed to load from database: ${e.message}`);
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

// Refresh student data from database periodically
function setupDataRefresh() {
  logToSystem('info', 'Setting up periodic data refresh from MySQL database');
  
  // Refresh student data every 5 minutes
  setInterval(async () => {
    try {
      const oldCount = Object.keys(studentCache).length;
      const students = await Database.getAllStudents();
      studentCache = {};
      students.forEach(student => {
        studentCache[student.id] = student;
      });
      const newCount = Object.keys(studentCache).length;
      
      if (newCount !== oldCount) {
        logToSystem('success', `Student database refreshed: ${oldCount} → ${newCount} students`, {
          oldCount,
          newCount,
          difference: newCount - oldCount
        });
        
        // AUTO-PUSH updated data to all connected Entry Scanners
        broadcastStudentCacheUpdate();
      }
    } catch (error) {
      logToSystem('error', `Failed to refresh student data: ${error.message}`);
    }
  }, 5 * 60 * 1000); // 5 minutes
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
app.get('/api/student-cache', async (req, res) => {
  try {
    // Get fresh data from MySQL database
    const students = await Database.getAllStudents();
    const freshCache = {};
    
    students.forEach(student => {
      freshCache[student.id] = {
        id: student.id,
        name: student.name,
        class: student.class,
        section: student.section,
        roll_number: student.roll_number,
        phone: student.phone,
        parent_phone: student.parent_phone,
        address: student.address,
        created_at: student.created_at
      };
    });
    
    // Update in-memory cache
    Object.assign(studentCache, freshCache);
    
    res.json(freshCache);
  } catch (error) {
    logToSystem('error', `Failed to fetch students from database: ${error.message}`);
    // Fallback to in-memory cache
    res.json(studentCache);
  }
});

// Device list endpoint
app.get('/api/devices', (req, res) => {
  const list = [];
  const now = Date.now();
  
  for (const [wsClient, info] of devices.entries()) {
    const isOnline = info.lastSeen && (now - info.lastSeen < 30000); // 30 seconds timeout
    list.push({ 
      role: info.role, 
      name: info.name, 
      lastSeen: info.lastSeen || null,
      isOnline: isOnline,
      connectionTime: info.connectionTime || null,
      status: isOnline ? 'online' : 'offline'
    });
  }
  res.json(list);
});

// Live device status endpoint
app.get('/api/live-devices', (req, res) => {
  const now = Date.now();
  const liveDevices = [];
  
  for (const [wsClient, info] of devices.entries()) {
    const isOnline = info.lastSeen && (now - info.lastSeen < 30000);
    const uptime = info.connectionTime ? now - info.connectionTime : 0;
    
    liveDevices.push({
      id: `${info.name}-${info.role}`,
      name: info.name,
      role: info.role,
      status: isOnline ? 'online' : 'offline',
      lastSeen: info.lastSeen,
      uptime: uptime,
      connectionTime: info.connectionTime
    });
  }
  
  res.json({
    devices: liveDevices,
    totalDevices: devices.size,
    onlineDevices: liveDevices.filter(d => d.status === 'online').length,
    timestamp: now
  });
});

// Data Collection Manager API endpoints
app.get('/api/data-collection/devices', (req, res) => {
  const now = Date.now();
  const deviceList = {};
  
  for (const [wsClient, info] of devices.entries()) {
    const isOnline = info.lastSeen && (now - info.lastSeen < 30000);
    deviceList[info.name] = {
      role: info.role,
      name: info.name,
      status: isOnline ? 'online' : 'offline',
      last_seen: info.lastSeen || null,
      connection_time: info.connectionTime || null,
      uptime: info.connectionTime ? now - info.connectionTime : 0
    };
  }
  
  res.json({ devices: deviceList });
});

app.post('/api/data-collection/request-data', (req, res) => {
  const { device_name } = req.body;
  
  if (!device_name) {
    return res.status(400).json({ error: 'Device name is required' });
  }
  
  // Find the device WebSocket connection
  let targetDevice = null;
  for (const [wsClient, info] of devices.entries()) {
    if (info.name === device_name) {
      targetDevice = wsClient;
      break;
    }
  }
  
  if (!targetDevice) {
    return res.status(404).json({ error: 'Device not found' });
  }
  
  // Send data request to the device
  targetDevice.send(JSON.stringify({
    type: 'request_data_collection',
    timestamp: Date.now(),
    requested_by: 'data_collection_manager'
  }));
  
  res.json({ 
    success: true, 
    message: `Data request sent to ${device_name}`,
    device_name: device_name
  });
});

app.get('/api/data-collection/device-data/:deviceName', async (req, res) => {
  const { deviceName } = req.params;
  
  try {
    // Try to get data from database first
    let deviceData = {};
    
    if (deviceName.toLowerCase().includes('entry') || deviceName.toLowerCase().includes('scanner')) {
      // Get Entry Scanner data
      const students = await Database.getAllStudents();
      const registrations = await Database.getAllEntryRegistrations();
      
      deviceData = {
        students: students.reduce((acc, student) => {
          acc[student.id || `student_${student.name}`] = student;
          return acc;
        }, {}),
        registrations: registrations,
        device_type: 'entry-scanner',
        collected_at: new Date().toISOString(),
        source: 'database'
      };
      
    } else if (deviceName.toLowerCase().includes('exit') || deviceName.toLowerCase().includes('validator')) {
      // Get Exit Validator data
      const validations = await Database.getAllExitValidations();
      
      deviceData = {
        validations: validations,
        device_type: 'exit-validator',
        collected_at: new Date().toISOString(),
        source: 'database'
      };
    }
    
    res.json({
      success: true,
      device_name: deviceName,
      data: deviceData
    });
    
  } catch (error) {
    console.error('Error collecting device data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to collect device data',
      message: error.message
    });
  }
});

// Exit Validator data endpoint (today's data)
app.get('/api/exit-validator-data', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's registrations from MySQL database
    let students = [];
    try {
      const registrations = await Database.getEntryRegistrationsByDate(today);
      
      // Process registration data and combine with student database
      const processedStudents = new Map(); // Use Map to avoid duplicates
      
      registrations.forEach(record => {
        if (record.student_id) {
          const studentId = record.student_id;
          const studentData = studentCache[studentId] || {};
          
          // Create comprehensive student record
          const studentRecord = {
            timestamp: record.timestamp || new Date().toISOString(),
            student_id: studentId,
            student_name: studentData.name || record.student_name || 'Unknown',
            center: studentData.center || record.center || 'Unknown',
            subject: studentData.subject || record.subject || 'Unknown',
            grade: studentData.grade || record.grade || 'Unknown',
            fees: studentData.fees || record.fees || '0',
            phone: studentData.phone || record.phone || '',
            parent_phone: studentData.parent_phone || record.parent_phone || '',
            payment_amount: record.payment_amount || 0,
            homework_score: record.homework_score || studentData.homework_score || '',
            exam_score: record.exam_score || studentData.exam_score || '',
            entry_method: record.entry_method || 'QR Scan',
            device_name: record.device_name || 'Unknown Device',
            comment: record.comment || '',
            error_detail: record.error_detail || ''
          };
          
          // Use student_id as key to avoid duplicates, keep the latest record
          processedStudents.set(studentId, studentRecord);
        }
      });
      
      // Convert Map to Array
      students = Array.from(processedStudents.values());
    } catch (dbError) {
      logToSystem('error', `Failed to fetch registrations from database: ${dbError.message}`);
      
      // Fallback to file-based approach
      const logsDir = path.join(__dirname, '..', '..', 'Logs');
      const file = path.join(logsDir, `registrations-${today}.json`);
      
      if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        
        // Process registration data and combine with student database
        const processedStudents = new Map(); // Use Map to avoid duplicates
        
        data.forEach(record => {
          if (record.record && record.record.student_id) {
            const studentId = record.record.student_id;
            const studentData = studentCache[studentId] || {};
            
            // Create comprehensive student record
            const studentRecord = {
              timestamp: record.timestamp || new Date().toISOString(),
              student_id: studentId,
              student_name: studentData.name || record.record.student_name || 'Unknown',
              center: studentData.center || record.record.center || 'Unknown',
              subject: studentData.subject || record.record.subject || 'Unknown',
              grade: studentData.grade || record.record.grade || 'Unknown',
              fees: studentData.fees || record.record.fees || '0',
              phone: studentData.phone || record.record.phone || '',
              parent_phone: studentData.parent_phone || record.record.parent_phone || '',
              payment_amount: record.record.payment_amount || 0,
              homework_score: record.record.homework_score || studentData.homework_score || '',
              exam_score: record.record.exam_score || studentData.exam_score || '',
              entry_method: record.record.entry_method || 'QR Scan',
              device_name: record.record.device_name || 'Unknown Device',
              comment: record.record.comment || '',
              error_detail: record.record.error_detail || ''
            };
            
            // Use student_id as key to avoid duplicates, keep the latest record
            processedStudents.set(studentId, studentRecord);
          }
        });
        
        // Convert Map to Array
        students = Array.from(processedStudents.values());
      }
    }
    
    res.json({
      students: students,
      totalStudents: students.length,
      date: today,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching exit validator data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch exit validator data',
      students: [],
      totalStudents: 0
    });
  }
});

// All Exit Validator data endpoint (for Admin Dashboard export)
app.get('/api/exit-validator-all-data', async (req, res) => {
  try {
    // Get all registrations from MySQL database
    let students = [];
    try {
      const registrations = await Database.getAllEntryRegistrations();
      
      // Process registration data and combine with student database
      const processedStudents = new Map(); // Use Map to avoid duplicates
      
      registrations.forEach(record => {
        if (record.student_id) {
          const studentId = record.student_id;
          const studentData = studentCache[studentId] || {};
          
          // Create comprehensive student record
          const studentRecord = {
            timestamp: record.timestamp || new Date().toISOString(),
            student_id: studentId,
            student_name: studentData.name || record.student_name || 'Unknown',
            center: studentData.center || record.center || 'Unknown',
            subject: studentData.subject || record.subject || 'Unknown',
            grade: studentData.grade || record.grade || 'Unknown',
            fees: studentData.fees || record.fees || '0',
            phone: studentData.phone || record.phone || '',
            parent_phone: studentData.parent_phone || record.parent_phone || '',
            payment_amount: record.payment_amount || 0,
            homework_score: record.homework_score || studentData.homework_score || '',
            exam_score: record.exam_score || studentData.exam_score || '',
            entry_method: record.entry_method || 'QR Scan',
            device_name: record.device_name || 'Unknown Device',
            comment: record.comment || '',
            error_detail: record.error_detail || ''
          };
          
          // Use student_id as key to avoid duplicates, keep the latest record
          processedStudents.set(studentId, studentRecord);
        }
      });
      
      // Convert Map to Array
      students = Array.from(processedStudents.values());
    } catch (dbError) {
      logToSystem('error', `Failed to fetch all registrations from database: ${dbError.message}`);
      students = [];
    }
    
    res.json({
      students: students,
      totalStudents: students.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching all exit validator data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch all exit validator data',
      students: [],
      totalStudents: 0
    });
  }
});

// Validation log endpoint
app.post('/api/validation-log', async (req, res) => {
  try {
    const validationData = req.body;
    
    // Save to MySQL database
    try {
      await Database.createExitValidation(validationData);
      logToSystem('info', `Exit validation: ${validationData.status} for student ${validationData.student_id} (${validationData.student_name})`);
    } catch (error) {
      logToSystem('error', `Failed to save validation to database: ${error.message}`);
    }
    
    // Save to daily log file (backup)
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
    } catch (fileError) {
      logToSystem('error', `Failed to save validation log file: ${fileError.message}`);
    }
    
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
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Error logging validation:', error);
    res.status(500).json({ error: 'Failed to log validation' });
  }
});

// ===== HYBRID SYSTEM: MYSQL SYNC APIs =====

// Main sync endpoint for hybrid system
app.post('/api/sync', async (req, res) => {
  try {
    const { operation, data, deviceName, timestamp } = req.body;
    
    logToSystem('info', `Sync request from ${deviceName}: ${operation}`, {
      operation,
      deviceName,
      timestamp,
      dataSize: JSON.stringify(data).length
    });
    
    let result = null;
    
    switch (operation) {
      case 'create_student':
        result = await Database.createStudent(data);
        logToSystem('success', `Student synced to MySQL: ${data.name} (ID: ${data.id}) from ${deviceName}`);
        break;
        
      case 'update_student':
        result = await Database.createStudent(data); // createStudent handles upsert
        logToSystem('success', `Student updated in MySQL: ${data.name} (ID: ${data.id}) from ${deviceName}`);
        break;
        
      case 'create_registration':
        result = await Database.createEntryRegistration(data);
        logToSystem('success', `Registration synced to MySQL: ${data.student_name} (ID: ${data.student_id}) from ${deviceName}`);
        break;
        
      case 'create_validation':
        result = await Database.createExitValidation(data);
        logToSystem('success', `Validation synced to MySQL: ${data.student_name} (ID: ${data.student_id}) from ${deviceName}`);
        break;
        
      default:
        throw new Error(`Unknown sync operation: ${operation}`);
    }
    
    res.json({ 
      success: true, 
      operation,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logToSystem('error', `Sync operation failed: ${error.message}`, {
      operation: req.body.operation,
      deviceName: req.body.deviceName,
      error: error.message
    });
    
    res.status(500).json({ 
      success: false,
      error: error.message,
      operation: req.body.operation
    });
  }
});

// Sync status endpoint
app.get('/api/sync/status', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get sync statistics
    const [students, registrations, validations] = await Promise.all([
      Database.getAllStudents(),
      Database.getEntryRegistrationsByDate(today),
      Database.getExitValidationsByDate(today)
    ]);
    
    const syncStatus = {
      database: {
        totalStudents: students.length,
        todayRegistrations: registrations.length,
        todayValidations: validations.length,
        lastUpdate: new Date().toISOString()
      },
      server: {
        uptime: Date.now() - serverStartTime,
        connectedDevices: devices.size,
        onlineDevices: Array.from(devices.values()).filter(d => 
          d.lastSeen && (Date.now() - d.lastSeen < 30000)
        ).length
      },
      system: {
        totalRegistrations,
        totalValidations,
        systemLogsCount: systemLogs.length
      }
    };
    
    res.json(syncStatus);
    
  } catch (error) {
    logToSystem('error', `Failed to get sync status: ${error.message}`);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Bulk sync endpoint for processing multiple items
app.post('/api/sync/bulk', async (req, res) => {
  try {
    const { items, deviceName } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided for bulk sync' });
    }
    
    logToSystem('info', `Bulk sync request from ${deviceName}: ${items.length} items`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const item of items) {
      try {
        let result = null;
        
        switch (item.operation) {
          case 'create_student':
            result = await Database.createStudent(item.data);
            break;
          case 'create_registration':
            result = await Database.createEntryRegistration(item.data);
            break;
          case 'create_validation':
            result = await Database.createExitValidation(item.data);
            break;
          default:
            throw new Error(`Unknown operation: ${item.operation}`);
        }
        
        results.push({ success: true, operation: item.operation, result });
        successCount++;
        
      } catch (error) {
        results.push({ 
          success: false, 
          operation: item.operation, 
          error: error.message 
        });
        errorCount++;
      }
    }
    
    logToSystem('success', `Bulk sync completed: ${successCount} success, ${errorCount} errors from ${deviceName}`);
    
    res.json({
      success: true,
      totalItems: items.length,
      successCount,
      errorCount,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logToSystem('error', `Bulk sync failed: ${error.message}`);
    res.status(500).json({ error: 'Bulk sync failed' });
  }
});

// Conflict resolution endpoint
app.post('/api/sync/resolve-conflicts', async (req, res) => {
  try {
    const { conflicts, resolution, deviceName } = req.body;
    
    logToSystem('info', `Conflict resolution request from ${deviceName}: ${conflicts.length} conflicts`, {
      resolution,
      deviceName
    });
    
    const results = [];
    
    for (const conflict of conflicts) {
      try {
        let result = null;
        
        // Apply resolution strategy
        if (resolution === 'local') {
          // Local data takes priority
          result = await Database.createStudent(conflict.localData);
        } else if (resolution === 'server') {
          // Server data takes priority (no action needed)
          result = { resolved: 'server', data: conflict.serverData };
        } else if (resolution === 'merge') {
          // Merge data (local takes priority for non-null fields)
          const mergedData = { ...conflict.serverData, ...conflict.localData };
          result = await Database.createStudent(mergedData);
        }
        
        results.push({ success: true, conflictId: conflict.id, result });
        
      } catch (error) {
        results.push({ 
          success: false, 
          conflictId: conflict.id, 
          error: error.message 
        });
      }
    }
    
    logToSystem('success', `Conflict resolution completed for ${deviceName}: ${results.length} conflicts processed`);
    
    res.json({
      success: true,
      resolution,
      conflictsProcessed: results.length,
      results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logToSystem('error', `Conflict resolution failed: ${error.message}`);
    res.status(500).json({ error: 'Conflict resolution failed' });
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

// Data Collection Manager route
app.get('/data-collection-manager', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web-interface', 'pages', 'Data-Collection-Manager.html'));
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
      cert: fs.readFileSync(certPath),
      // Add security headers for HTTPS
      secureProtocol: 'TLSv1_2_method',
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384'
      ].join(':'),
      honorCipherOrder: true
    };

    const httpsServer = https.createServer(httpsOptions, app);
    
    // Add security headers middleware for HTTPS
    httpsServer.on('request', (req, res) => {
      // Add security headers for HTTPS
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
    });
    
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
      logToSystem('success', `HTTPS server listening on https://${REAL_IP}:${HTTPS_PORT}`);
      console.log(`🔒 HTTPS server listening on https://${REAL_IP}:${HTTPS_PORT}`);
      console.log(`🔒 WSS (WebSocket Secure) available on wss://${REAL_IP}:${HTTPS_PORT}`);
    });

    return httpsServer;
  } catch (error) {
    logToSystem('warning', `Failed to start HTTPS server: ${error.message}`);
    return null;
  }
}

// Start HTTP server
const httpServer = app.listen(HTTP_PORT, '0.0.0.0', async () => {
  console.log('\n🛡️ ZERO DATA LOSS SYSTEM ENABLED');
  console.log('📱 OFFLINE-FIRST MODE: No internet required after setup');
  console.log('📶 HOTSPOT-ONLY MODE: Works with local network only');
  console.log('💾 MULTIPLE BACKUP LAYERS: Data protected at all times');
  
  // Initialize database first
  const dbInitialized = await initializeDatabase();
  if (!dbInitialized) {
    logToSystem('error', 'Failed to initialize database. Server may not function properly.');
  }
  
  // Load student data from MySQL
  await loadStudentData();
  setupDataRefresh(); // Enable periodic refresh from MySQL database
  
        // Initialize auto Excel import system
        setupAutoExcelImport();
        
        // Start connection monitoring and device discovery
        startConnectionMonitoring();
        
        // Start periodic device discovery broadcasts
        setInterval(broadcastDeviceDiscovery, CONNECTION_CONFIG.NETWORK_SCAN_INTERVAL);
        
        // Start periodic stats broadcasts to admin dashboards
        setInterval(broadcastUpdatedStats, 15000); // Every 15 seconds (reduced from 5)
  
  // Use new logging system
  logToSystem('success', 'Student Lab System started successfully');
  logToSystem('info', `HTTP server listening on http://${REAL_IP}:${HTTP_PORT}`);
  logToSystem('info', 'System URLs available:');
  logToSystem('info', `  Entry Scanner: http://${REAL_IP}:${HTTP_PORT}/entry-scanner`);
  logToSystem('info', `  Exit Validator: http://${REAL_IP}:${HTTP_PORT}/exit-validator`);
  logToSystem('info', `  Admin Dashboard: http://${REAL_IP}:${HTTP_PORT}/admin-dashboard`);
  logToSystem('info', `  Embedded Scanner: http://${REAL_IP}:${HTTP_PORT}/entry-scanner-embedded`);
  logToSystem('info', 'Auto-reconnection and device discovery enabled');
  logToSystem('info', 'Auto Excel import from Student-Data folder enabled');
  
  // Also keep console output for direct server monitoring
  console.log('🎉 Student Lab System - Clean Organization');
  console.log(`🌐 HTTP server listening on http://${REAL_IP}:${HTTP_PORT}`);
  console.log('🔄 Auto-reconnection and device discovery enabled');
  console.log('📁 Auto Excel import from Student-Data folder enabled');
});

// Start HTTPS server for phone camera access
const httpsServer = createHTTPSServer();
if (httpsServer) {
  // Display URLs at the end after both servers are started
  setTimeout(() => {
    console.log('');
    console.log('========================================');
    console.log(`📱 ACCESS URLs - Your IP: ${REAL_IP}`);
    console.log('========================================');
    console.log('');
    console.log('🔒 HTTPS URLs (Recommended for phones):');
    console.log(`   Entry Scanner:  https://${REAL_IP}:${HTTPS_PORT}/entry-scanner`);
    console.log(`   Exit Validator: https://${REAL_IP}:${HTTPS_PORT}/exit-validator`);
    console.log(`   Admin Dashboard: https://${REAL_IP}:${HTTPS_PORT}/admin-dashboard`);
    console.log('');
    console.log('🌐 HTTP URLs (For local computers):');
    console.log(`   Entry Scanner:  http://${REAL_IP}:${HTTP_PORT}/entry-scanner`);
    console.log(`   Exit Validator: http://${REAL_IP}:${HTTP_PORT}/exit-validator`);
    console.log(`   Admin Dashboard: http://${REAL_IP}:${HTTP_PORT}/admin-dashboard`);
    console.log(`   Embedded Scanner: http://${REAL_IP}:${HTTP_PORT}/entry-scanner-embedded`);
    console.log('');
    console.log('📱 For phone camera access, use HTTPS URLs above');
    console.log('========================================');
  }, 1000); // Wait 1 second to ensure both servers are started
} else {
  // Display URLs at the end even when HTTPS is not available
  setTimeout(() => {
    console.log('');
    console.log('========================================');
    console.log(`🌐 ACCESS URLs - Your IP: ${REAL_IP}`);
    console.log('========================================');
    console.log('');
    console.log('🌐 HTTP URLs (Only option without SSL):');
    console.log(`   Entry Scanner:  http://${REAL_IP}:${HTTP_PORT}/entry-scanner`);
    console.log(`   Exit Validator: http://${REAL_IP}:${HTTP_PORT}/exit-validator`);
    console.log(`   Admin Dashboard: http://${REAL_IP}:${HTTP_PORT}/admin-dashboard`);
    console.log(`   Embedded Scanner: http://${REAL_IP}:${HTTP_PORT}/entry-scanner-embedded`);
    console.log('');
    console.log('⚠️  Note: Phone cameras require HTTPS. Run generate-ssl-cert.bat first.');
    console.log('========================================');
  }, 1000);
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
  
  ws.on('message', async msg => {
    try {
      const data = JSON.parse(msg);
      
      if (data.type === 'register_device') {
        // Check if this is a reconnection of an existing device
        const existingDevice = Array.from(devices.values()).find(d => d.name === data.name && d.role === data.role);
        const isReconnection = existingDevice !== undefined;
        
        devices.set(ws, { 
          role: data.role, 
          name: data.name, 
          lastSeen: Date.now(),
          connectionTime: isReconnection ? existingDevice.connectionTime : Date.now(),
          initialDataPushed: isReconnection ? existingDevice.initialDataPushed : false,
          reconnectCount: isReconnection ? (existingDevice.reconnectCount || 0) + 1 : 0
        });
        
        if (isReconnection) {
          logToSystem('info', `Device reconnected: ${data.name} (${data.role}) - Reconnect #${devices.get(ws).reconnectCount}`);
        } else {
          logToSystem('success', `Device registered: ${data.name} (${data.role})`);
        }
        
        // AUTO-PUSH: Send student cache to Entry Scanner devices only once upon initial connection
        const deviceInfo = devices.get(ws);
        if (data.role === 'first_scan' && deviceInfo && !deviceInfo.initialDataPushed) {
          const studentCount = Object.keys(studentCache).length;
          
          // Send the complete student database to the newly connected Entry Scanner
          ws.send(JSON.stringify({
            type: 'student_cache_update',
            cache: studentCache,
            timestamp: new Date().toISOString(),
            totalStudents: studentCount
          }));
          
          // Mark that the initial data has been pushed
          deviceInfo.initialDataPushed = true;
          
          logToSystem('success', `Auto-pushed ${studentCount} students to Entry Scanner: ${data.name}`, {
            deviceName: data.name,
            studentCount: studentCount,
            cacheSize: JSON.stringify(studentCache).length,
            isReconnection: isReconnection
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
        
        // Broadcast updated stats (active scanners count changed)
        await broadcastUpdatedStats();
        
        return;
      }
      
      if (data.type === 'heartbeat') {
        const info = devices.get(ws) || {};
        info.lastSeen = Date.now();
        devices.set(ws, info);
        
        // Send heartbeat response with server status
        ws.send(JSON.stringify({
          type: 'heartbeat_response',
          timestamp: new Date().toISOString(),
          serverStatus: 'online',
          connectedDevices: devices.size
        }));
        return;
      }
      
      if (data.type === 'reconnection_request') {
        // Handle device reconnection
        const deviceInfo = devices.get(ws);
        if (deviceInfo) {
          deviceInfo.lastSeen = Date.now();
          deviceInfo.reconnectionCount = (deviceInfo.reconnectionCount || 0) + 1;
          devices.set(ws, deviceInfo);
          
          logToSystem('success', `Device reconnected: ${deviceInfo.name} (${deviceInfo.role})`, {
            reconnectionCount: deviceInfo.reconnectionCount,
            previousLastSeen: deviceInfo.lastSeen
          });
          
          // Send reconnection confirmation
          ws.send(JSON.stringify({
            type: 'reconnection_confirmed',
            timestamp: new Date().toISOString(),
            deviceInfo: {
              name: deviceInfo.name,
              role: deviceInfo.role,
              reconnectionCount: deviceInfo.reconnectionCount
            }
          }));
          
          // Notify admins
          broadcastToAdmins({
            type: 'device_reconnected',
            name: deviceInfo.name,
            role: deviceInfo.role,
            reconnectionCount: deviceInfo.reconnectionCount,
            timestamp: new Date().toISOString()
          });
        }
        return;
      }
      
      if (data.type === 'network_scan_request') {
        // Handle network scan request from devices
        const scanResponse = {
          type: 'network_scan_response',
          timestamp: new Date().toISOString(),
          serverInfo: {
            host: 'localhost',
            httpPort: HTTP_PORT,
            httpsPort: HTTPS_PORT,
            wsPort: WS_PORT,
            wssPort: WSS_PORT
          },
          networkStatus: {
            isOnline: networkStatus.isOnline,
            onlineDevices: Array.from(devices.values()).filter(d => 
              d.lastSeen && (Date.now() - d.lastSeen < CONNECTION_CONFIG.CONNECTION_TIMEOUT)
            ).length,
            totalDevices: devices.size
          }
        };
        
        ws.send(JSON.stringify(scanResponse));
        return;
      }
      
      if (data.type === 'student_registered') {
        totalRegistrations++;
        const record = data.record;
        
        // Save to MySQL database
        try {
          await Database.createEntryRegistration(record);
          logToSystem('success', `Student registered: ${record.student_name} (ID: ${record.student_id}) by ${record.device_name}`, {
            studentId: record.student_id,
            studentName: record.student_name,
            deviceName: record.device_name,
            homeworkScore: record.homework_score,
            examScore: record.exam_score
          });
        } catch (error) {
          logToSystem('error', `Failed to save registration to database: ${error.message}`);
        }
        
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
        
        // Broadcast updated stats to all admin dashboards
        await broadcastUpdatedStats();
        
        return;
      }
      
      if (data.type === 'new_student') {
        const student = data.student;
        
        // Save to MySQL database
        try {
          await Database.createStudent(student);
          logToSystem('info', `New student added: ${student.name} (ID: ${student.id})`, {
            studentId: student.id,
            studentName: student.name
          });
        } catch (error) {
          logToSystem('error', `Failed to save new student to database: ${error.message}`);
        }
        
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
        const now = Date.now();
        const onlineDevices = Array.from(devices.values()).filter(d => d.lastSeen && (now - d.lastSeen < 30000));
        const activeScanners = onlineDevices.filter(d => d.role === 'first_scan' || d.role === 'last_scan').length;
        const today = new Date().toISOString().split('T')[0];
        
        // Count today's registrations from MySQL database
        let todayRegistrations = 0;
        try {
          const registrations = await Database.getEntryRegistrationsByDate(today);
          todayRegistrations = registrations.length;
        } catch (error) {
          logToSystem('error', `Failed to count today's registrations from database: ${error.message}`);
          // Fallback to file-based counting
          try {
            const logsDir = path.join(__dirname, '..', '..', 'Logs');
            const file = path.join(logsDir, `registrations-${today}.json`);
            if (fs.existsSync(file)) {
              const data = JSON.parse(fs.readFileSync(file, 'utf8'));
              todayRegistrations = data.filter(record => record.record && record.record.student_id).length;
            }
          } catch (fileError) {
            console.error('Error counting today registrations from file:', fileError);
          }
        }
        
        // Count system errors from logs
        const systemErrors = systemLogs.filter(log => log.level === 'error').length;
        
        const stats = {
          totalStudents: Object.keys(studentCache).length,
          activeScanners: activeScanners,
          todayRegistrations: todayRegistrations,
          systemErrors: systemErrors,
          totalDevices: devices.size,
          onlineDevices: onlineDevices.length,
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
      
      // Data Collection Manager message handling
      if (data.type === 'request_data_collection') {
        const deviceInfo = devices.get(ws);
        if (deviceInfo) {
          logToSystem('info', `Data collection requested from ${deviceInfo.name} (${deviceInfo.role})`);
          
          // Send data collection response
          ws.send(JSON.stringify({
            type: 'data_collection_response',
            device_name: deviceInfo.name,
            device_type: deviceInfo.role,
            success: true,
            timestamp: Date.now()
          }));
        }
        return;
      }
      
      if (data.type === 'device_data_response') {
        // Handle device data response from devices
        logToSystem('info', `Received device data from ${data.device_name}`);
        
        // Broadcast to Data Collection Manager if connected
        broadcastToDataCollectionManager({
          type: 'device_data',
          device_name: data.device_name,
          device_type: data.device_type,
          data: data.data,
          timestamp: Date.now()
        });
        return;
      }
      
      if (data.type === 'request_device_list') {
        // Handle device list request from Data Collection Manager
        const deviceList = {};
        const now = Date.now();
        
        for (const [wsClient, info] of devices.entries()) {
          const isOnline = info.lastSeen && (now - info.lastSeen < 30000);
          deviceList[info.name] = {
            role: info.role,
            name: info.name,
            status: isOnline ? 'online' : 'offline',
            last_seen: info.lastSeen || null,
            connection_time: info.connectionTime || null,
            uptime: info.connectionTime ? now - info.connectionTime : 0
          };
        }
        
        ws.send(JSON.stringify({
          type: 'device_list',
          devices: deviceList,
          timestamp: now
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
  
  ws.on('close', async () => {
    const deviceInfo = devices.get(ws);
    if (deviceInfo) {
      // Only log disconnection if it's not a frequent reconnector
      const reconnectCount = deviceInfo.reconnectCount || 0;
      if (reconnectCount < 3) {
        logToSystem('warning', `Device disconnected: ${deviceInfo.name} (${deviceInfo.role})`);
      } else {
        logToSystem('info', `Device disconnected: ${deviceInfo.name} (${deviceInfo.role}) - Frequent reconnector`);
      }
      
      // Notify admins about device disconnection (but not for frequent reconnectors)
      if (reconnectCount < 5) {
        broadcastToAdmins({
          type: 'device_disconnected',
          name: deviceInfo.name,
          role: deviceInfo.role,
          timestamp: new Date().toISOString()
        });
      }
      
      devices.delete(ws);
      
      // Broadcast updated stats (active scanners count changed) - but less frequently
      if (reconnectCount < 3) {
        await broadcastUpdatedStats();
      }
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

// Smart Excel Import API Endpoints
app.post('/api/upload-excel', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No Excel file uploaded' 
      });
    }

    logToSystem('info', `Excel file uploaded: ${req.file.originalname}`);
    
    // Analyze the Excel file
    const analysis = analyzeExcelFile(req.file.path);
    
    if (!analysis.success) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: analysis.error
      });
    }

    // Return analysis results for preview
    res.json({
      success: true,
      fileName: req.file.originalname,
      filePath: req.file.path,
      analysis: {
        headers: analysis.headers,
        mappings: analysis.mappings,
        detectedFields: analysis.detectedFields,
        totalRows: analysis.totalRows,
        studentsCount: analysis.students.length,
        preview: analysis.students.slice(0, 5) // First 5 students as preview
      }
    });

  } catch (error) {
    logToSystem('error', `Excel upload failed: ${error.message}`);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process Excel file' 
    });
  }
});

app.post('/api/import-students', async (req, res) => {
  try {
    const { filePath, mappings, importMode = 'add' } = req.body;
    
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        error: 'File not found'
      });
    }

    // Re-analyze file with custom mappings if provided
    let analysis;
    if (mappings) {
      // Use custom mappings
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const students = parseStudentData(worksheet, mappings);
      analysis = { students };
    } else {
      // Use auto-detected mappings
      analysis = analyzeExcelFile(filePath);
    }

    if (!analysis.success) {
      return res.status(400).json({
        success: false,
        error: analysis.error
      });
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Import students to database
    for (const student of analysis.students) {
      try {
        if (importMode === 'replace') {
          // Delete existing student if exists
          await Database.deleteStudent(student.id);
        }

        // Create/update student
        const result = await Database.createStudent(student);
        
        if (result.affectedRows > 0) {
          if (result.changedRows > 0) {
            updatedCount++;
          } else {
            importedCount++;
          }
        } else {
          skippedCount++;
        }

      } catch (error) {
        errors.push({
          student: student.name || student.id,
          error: error.message
        });
        skippedCount++;
      }
    }

    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      logToSystem('warning', `Failed to cleanup file: ${cleanupError.message}`);
    }

    // Update student cache
    await loadStudentData();

    // Broadcast updated student cache to all devices
    broadcastStudentCacheUpdate();

    logToSystem('success', `Excel import completed: ${importedCount} imported, ${updatedCount} updated, ${skippedCount} skipped`);

    res.json({
      success: true,
      summary: {
        imported: importedCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: analysis.students.length,
        errors: errors.length
      },
      errors: errors
    });

  } catch (error) {
    logToSystem('error', `Student import failed: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to import students'
    });
  }
});

app.get('/api/excel-templates', (req, res) => {
  try {
    const templates = [
      {
        name: 'Basic Template',
        description: 'Simple student list with essential fields',
        headers: ['ID', 'Name', 'Center', 'Subject', 'Grade', 'Fees'],
        sample: [
          ['STU001', 'Ahmed Ali', 'Main Center', 'Math', 'Grade 10', '500'],
          ['STU002', 'Sara Mohamed', 'Branch A', 'Science', 'Grade 9', '450']
        ]
      },
      {
        name: 'Complete Template',
        description: 'Full student information template',
        headers: ['Student ID', 'Full Name', 'Center', 'Subject', 'Grade', 'Fees', 'Phone', 'Parent Phone', 'Email', 'Address'],
        sample: [
          ['STU001', 'Ahmed Ali', 'Main Center', 'Math', 'Grade 10', '500', '01234567890', '01234567891', 'ahmed@email.com', 'Cairo, Egypt'],
          ['STU002', 'Sara Mohamed', 'Branch A', 'Science', 'Grade 9', '450', '01234567892', '01234567893', 'sara@email.com', 'Alexandria, Egypt']
        ]
      },
      {
        name: 'Arabic Template',
        description: 'Template with Arabic column names',
        headers: ['رقم الطالب', 'اسم الطالب', 'المركز', 'المادة', 'الصف', 'الرسوم', 'الهاتف', 'هاتف الوالد'],
        sample: [
          ['STU001', 'أحمد علي', 'المركز الرئيسي', 'الرياضيات', 'الصف العاشر', '500', '01234567890', '01234567891'],
          ['STU002', 'سارة محمد', 'الفرع أ', 'العلوم', 'الصف التاسع', '450', '01234567892', '01234567893']
        ]
      }
    ];

    res.json({
      success: true,
      templates: templates
    });

  } catch (error) {
    logToSystem('error', `Failed to get templates: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
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
