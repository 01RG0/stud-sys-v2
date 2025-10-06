// Load environment variables
require('dotenv').config();

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

// Manual operation tracking to prevent Excel file interference
let manualOperationInProgress = false;

// Function to get real IP address (Enhanced)
function getRealIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  console.log('🔍 Detecting system IP address...');
  
  // Try to find the best IP address
  let bestIP = null;
  let fallbackIP = null;
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) addresses and IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        console.log(`📡 Found network interface: ${name} - ${ip}`);
        
        // Prefer common local network ranges
        if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
          if (!bestIP) {
            bestIP = ip;
            console.log(`✅ Selected best IP: ${ip} (from ${name})`);
          }
        } else if (!fallbackIP) {
          fallbackIP = ip;
          console.log(`🔄 Fallback IP: ${ip} (from ${name})`);
        }
      }
    }
  }
  
  const finalIP = bestIP || fallbackIP || 'localhost';
  console.log(`🌐 Final IP address: ${finalIP}`);
  
  return finalIP;
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
  
  // Enhanced field variations with comprehensive case variations
  const fieldVariations = {
    id: [
      // English variations - all case combinations
      'id', 'ID', 'Id', 'iD',
      'student_id', 'STUDENT_ID', 'Student_ID', 'student_ID', 'STUDENT_id',
      'studentid', 'STUDENTID', 'StudentID', 'studentID', 'STUDENTid',
      'student id', 'STUDENT ID', 'Student ID', 'student ID', 'STUDENT id',
      'student number', 'STUDENT NUMBER', 'Student Number', 'student NUMBER', 'STUDENT number',
      'student no', 'STUDENT NO', 'Student No', 'student NO', 'STUDENT no',
      'student #', 'STUDENT #', 'Student #', 'student #', 'STUDENT #',
      'roll number', 'ROLL NUMBER', 'Roll Number', 'roll NUMBER', 'ROLL number',
      'roll no', 'ROLL NO', 'Roll No', 'roll NO', 'ROLL no',
      'roll#', 'ROLL#', 'Roll#', 'roll#', 'ROLL#',
      'registration number', 'REGISTRATION NUMBER', 'Registration Number', 'registration NUMBER', 'REGISTRATION number',
      'reg no', 'REG NO', 'Reg No', 'reg NO', 'REG no',
      'reg#', 'REG#', 'Reg#', 'reg#', 'REG#',
      'serial number', 'SERIAL NUMBER', 'Serial Number', 'serial NUMBER', 'SERIAL number',
      'serial no', 'SERIAL NO', 'Serial No', 'serial NO', 'SERIAL no',
      'serial#', 'SERIAL#', 'Serial#', 'serial#', 'SERIAL#',
      'number', 'NUMBER', 'Number', 'number', 'NUMBER',
      'no', 'NO', 'No', 'no', 'NO',
      '#', 'num', 'NUM', 'Num', 'num', 'NUM',
      // Arabic variations
      'رقم الطالب', 'رقم الطالب', 'رقم', 'الرقم', 'رقم التسجيل', 'رقم القيد',
      // Other languages
      'numero', 'número', 'numéro', 'номер', '番号', '번호'
    ],
    name: [
      // English variations - all case combinations
      'name', 'NAME', 'Name', 'nAmE',
      'student_name', 'STUDENT_NAME', 'Student_Name', 'student_NAME', 'STUDENT_name',
      'studentname', 'STUDENTNAME', 'StudentName', 'studentNAME', 'STUDENTname',
      'student name', 'STUDENT NAME', 'Student Name', 'student NAME', 'STUDENT name',
      'full_name', 'FULL_NAME', 'Full_Name', 'full_NAME', 'FULL_name',
      'fullname', 'FULLNAME', 'FullName', 'fullNAME', 'FULLname',
      'first_name', 'FIRST_NAME', 'First_Name', 'first_NAME', 'FIRST_name',
      'last_name', 'LAST_NAME', 'Last_Name', 'last_NAME', 'LAST_name',
      'firstname', 'FIRSTNAME', 'FirstName', 'firstNAME', 'FIRSTname',
      'lastname', 'LASTNAME', 'LastName', 'lastNAME', 'LASTname',
      'given_name', 'GIVEN_NAME', 'Given_Name', 'given_NAME', 'GIVEN_name',
      'family_name', 'FAMILY_NAME', 'Family_Name', 'family_NAME', 'FAMILY_name',
      'complete name', 'COMPLETE NAME', 'Complete Name', 'complete NAME', 'COMPLETE name',
      'full name', 'FULL NAME', 'Full Name', 'full NAME', 'FULL name',
      'student full name', 'STUDENT FULL NAME', 'Student Full Name', 'student FULL NAME', 'STUDENT full name',
      'student complete name', 'STUDENT COMPLETE NAME', 'Student Complete Name', 'student COMPLETE NAME', 'STUDENT complete name',
      // Arabic variations
      'الاسم', 'اسم الطالب', 'الاسم الكامل', 'الاسم الأول', 'الاسم الأخير',
      'اسم العائلة', 'الاسم الثلاثي', 'الاسم الرباعي',
      // Other languages
      'nombre', 'nom', 'имя', '名前', '이름'
    ],
    center: [
      // English variations - all case combinations
      'center', 'CENTER', 'Center', 'cEnTeR',
      'centre', 'CENTRE', 'Centre', 'cEnTrE',
      'branch', 'BRANCH', 'Branch', 'bRaNcH',
      'location', 'LOCATION', 'Location', 'lOcAtIoN',
      'branch_name', 'BRANCH_NAME', 'Branch_Name', 'branch_NAME', 'BRANCH_name',
      'center_name', 'CENTER_NAME', 'Center_Name', 'center_NAME', 'CENTER_name',
      'institution', 'INSTITUTION', 'Institution', 'iNsTiTuTiOn',
      'school', 'SCHOOL', 'School', 'sChOoL',
      'college', 'COLLEGE', 'College', 'cOlLeGe',
      'university', 'UNIVERSITY', 'University', 'uNiVeRsItY',
      'academy', 'ACADEMY', 'Academy', 'aCaDeMy',
      'institute', 'INSTITUTE', 'Institute', 'iNsTiTuTe',
      'campus', 'CAMPUS', 'Campus', 'cAmPuS',
      'site', 'SITE', 'Site', 'sItE',
      'office', 'OFFICE', 'Office', 'oFfIcE',
      'department', 'DEPARTMENT', 'Department', 'dEpArTmEnT',
      'division', 'DIVISION', 'Division', 'dIvIsIoN',
      'section', 'SECTION', 'Section', 'sEcTiOn',
      // Arabic variations
      'المركز', 'الفرع', 'المكان', 'المؤسسة', 'المدرسة', 'الكلية', 'الجامعة',
      'الأكاديمية', 'المعهد', 'الحرم', 'الموقع', 'المكتب', 'القسم', 'الشعبة',
      // Other languages
      'centro', 'CENTRO', 'Centro', 'cEnTrO',
      'centre', 'CENTRE', 'Centre', 'cEnTrE',
      'центр', 'ЦЕНТР', 'Центр', 'цЕнТр',
      'センター', 'センダー', '센터', '센터'
    ],
    subject: [
      // English variations - all case combinations
      'subject', 'SUBJECT', 'Subject', 'sUbJeCt',
      'course', 'COURSE', 'Course', 'cOuRsE',
      'material', 'MATERIAL', 'Material', 'mAtErIaL',
      'course_name', 'COURSE_NAME', 'Course_Name', 'course_NAME', 'COURSE_name',
      'subject_name', 'SUBJECT_NAME', 'Subject_Name', 'subject_NAME', 'SUBJECT_name',
      'discipline', 'DISCIPLINE', 'Discipline', 'dIsCiPlInE',
      'field', 'FIELD', 'Field', 'fIeLd',
      'major', 'MAJOR', 'Major', 'mAjOr',
      'specialization', 'SPECIALIZATION', 'Specialization', 'sPeCiAlIzAtIoN',
      'program', 'PROGRAM', 'Program', 'pRoGrAm',
      'curriculum', 'CURRICULUM', 'Curriculum', 'cUrRiCuLuM',
      'syllabus', 'SYLLABUS', 'Syllabus', 'sYlLaBuS',
      'topic', 'TOPIC', 'Topic', 'tOpIc',
      'theme', 'THEME', 'Theme', 'tHeMe',
      'area', 'AREA', 'Area', 'aReA',
      'domain', 'DOMAIN', 'Domain', 'dOmAiN',
      'branch of study', 'BRANCH OF STUDY', 'Branch Of Study', 'branch OF STUDY', 'BRANCH of study',
      // Arabic variations
      'المادة', 'المقرر', 'الدرس', 'التخصص', 'المجال', 'الفرع', 'البرنامج',
      'المنهج', 'الموضوع', 'الموضوع الدراسي', 'الفرع الدراسي',
      // Other languages
      'materia', 'MATERIA', 'Materia', 'mAtErIa',
      'matière', 'MATIÈRE', 'Matière', 'mAtIèRe',
      'предмет', 'ПРЕДМЕТ', 'Предмет', 'пРеДмЕт',
      '科目', '과목', '과목'
    ],
    grade: [
      // English variations - all case combinations
      'grade', 'GRADE', 'Grade', 'gRaDe',
      'level', 'LEVEL', 'Level', 'lEvEl',
      'class', 'CLASS', 'Class', 'cLaSs',
      'class_name', 'CLASS_NAME', 'Class_Name', 'class_NAME', 'CLASS_name',
      'year', 'YEAR', 'Year', 'yEaR',
      'academic_year', 'ACADEMIC_YEAR', 'Academic_Year', 'academic_YEAR', 'ACADEMIC_year',
      'semester', 'SEMESTER', 'Semester', 'sEmEsTeR',
      'term', 'TERM', 'Term', 'tErM',
      'stage', 'STAGE', 'Stage', 'sTaGe',
      'phase', 'PHASE', 'Phase', 'pHaSe',
      'step', 'STEP', 'Step', 'sTeP',
      'degree', 'DEGREE', 'Degree', 'dEgReE',
      'standard', 'STANDARD', 'Standard', 'sTaNdArD',
      'form', 'FORM', 'Form', 'fOrM',
      'grade level', 'GRADE LEVEL', 'Grade Level', 'grade LEVEL', 'GRADE level',
      'class level', 'CLASS LEVEL', 'Class Level', 'class LEVEL', 'CLASS level',
      'academic level', 'ACADEMIC LEVEL', 'Academic Level', 'academic LEVEL', 'ACADEMIC level',
      'education level', 'EDUCATION LEVEL', 'Education Level', 'education LEVEL', 'EDUCATION level',
      // Arabic variations
      'الصف', 'المستوى', 'الدرجة', 'السنة', 'السنة الأكاديمية', 'الفصل',
      'المرحلة', 'المرحلة الدراسية', 'الدرجة الدراسية', 'المستوى الدراسي',
      // Other languages
      'grado', 'GRADO', 'Grado', 'gRaDo',
      'niveau', 'NIVEAU', 'Niveau', 'nIvEaU',
      'класс', 'КЛАСС', 'Класс', 'кЛаСс',
      '学年', '학년', '학년'
    ],
    fees: [
      // English variations - all case combinations
      'fees', 'FEES', 'Fees', 'fEeS',
      'fee', 'FEE', 'Fee', 'fEe',
      'amount', 'AMOUNT', 'Amount', 'aMoUnT',
      'price', 'PRICE', 'Price', 'pRiCe',
      'cost', 'COST', 'Cost', 'cOsT',
      'payment', 'PAYMENT', 'Payment', 'pAyMeNt',
      'tuition', 'TUITION', 'Tuition', 'tUiTiOn',
      'tuition_fee', 'TUITION_FEE', 'Tuition_Fee', 'tuition_FEE', 'TUITION_fee',
      'total_fee', 'TOTAL_FEE', 'Total_Fee', 'total_FEE', 'TOTAL_fee',
      'total_fees', 'TOTAL_FEES', 'Total_Fees', 'total_FEES', 'TOTAL_fees',
      'total_amount', 'TOTAL_AMOUNT', 'Total_Amount', 'total_AMOUNT', 'TOTAL_amount',
      'total_cost', 'TOTAL_COST', 'Total_Cost', 'total_COST', 'TOTAL_cost',
      'total_price', 'TOTAL_PRICE', 'Total_Price', 'total_PRICE', 'TOTAL_price',
      'registration_fee', 'REGISTRATION_FEE', 'Registration_Fee', 'registration_FEE', 'REGISTRATION_fee',
      'enrollment_fee', 'ENROLLMENT_FEE', 'Enrollment_Fee', 'enrollment_FEE', 'ENROLLMENT_fee',
      'admission_fee', 'ADMISSION_FEE', 'Admission_Fee', 'admission_FEE', 'ADMISSION_fee',
      'course_fee', 'COURSE_FEE', 'Course_Fee', 'course_FEE', 'COURSE_fee',
      'monthly_fee', 'MONTHLY_FEE', 'Monthly_Fee', 'monthly_FEE', 'MONTHLY_fee',
      'annual_fee', 'ANNUAL_FEE', 'Annual_Fee', 'annual_FEE', 'ANNUAL_fee',
      'semester_fee', 'SEMESTER_FEE', 'Semester_Fee', 'semester_FEE', 'SEMESTER_fee',
      'term_fee', 'TERM_FEE', 'Term_Fee', 'term_FEE', 'TERM_fee',
      // Arabic variations
      'الرسوم', 'المبلغ', 'التكلفة', 'السعر', 'الدفع', 'رسوم الدراسة',
      'الرسوم الإجمالية', 'المبلغ الإجمالي', 'التكلفة الإجمالية',
      'رسوم التسجيل', 'رسوم القبول', 'رسوم المقرر', 'الرسوم الشهرية',
      // Other languages
      'tarifa', 'TARIFA', 'Tarifa', 'tArIfA',
      'frais', 'FRAIS', 'Frais', 'fRaIs',
      'плата', 'ПЛАТА', 'Плата', 'пЛаТа',
      '料金', '수수료', '수수료'
    ],
    phone: [
      // English variations - all case combinations
      'phone', 'PHONE', 'Phone', 'pHoNe',
      'mobile', 'MOBILE', 'Mobile', 'mObIlE',
      'tel', 'TEL', 'Tel', 'tEl',
      'telephone', 'TELEPHONE', 'Telephone', 'tElEpHoNe',
      'phone_number', 'PHONE_NUMBER', 'Phone_Number', 'phone_NUMBER', 'PHONE_number',
      'mobile_number', 'MOBILE_NUMBER', 'Mobile_Number', 'mobile_NUMBER', 'MOBILE_number',
      'contact_number', 'CONTACT_NUMBER', 'Contact_Number', 'contact_NUMBER', 'CONTACT_number',
      'contact_phone', 'CONTACT_PHONE', 'Contact_Phone', 'contact_PHONE', 'CONTACT_phone',
      'personal_phone', 'PERSONAL_PHONE', 'Personal_Phone', 'personal_PHONE', 'PERSONAL_phone',
      'student_phone', 'STUDENT_PHONE', 'Student_Phone', 'student_PHONE', 'STUDENT_phone',
      'cell', 'CELL', 'Cell', 'cElL',
      'cellphone', 'CELLPHONE', 'Cellphone', 'cElLpHoNe',
      'cell_phone', 'CELL_PHONE', 'Cell_Phone', 'cell_PHONE', 'CELL_phone',
      'mobile_phone', 'MOBILE_PHONE', 'Mobile_Phone', 'mobile_PHONE', 'MOBILE_phone',
      'handphone', 'HANDPHONE', 'Handphone', 'hAnDpHoNe',
      'whatsapp', 'WHATSAPP', 'Whatsapp', 'wHaTsApP',
      'whatsapp_number', 'WHATSAPP_NUMBER', 'Whatsapp_Number', 'whatsapp_NUMBER', 'WHATSAPP_number',
      'telegram', 'TELEGRAM', 'Telegram', 'tElEgRaM',
      'telegram_number', 'TELEGRAM_NUMBER', 'Telegram_Number', 'telegram_NUMBER', 'TELEGRAM_number',
      // Arabic variations
      'الهاتف', 'الجوال', 'رقم الهاتف', 'رقم الجوال', 'رقم الاتصال',
      'هاتف الطالب', 'هاتف شخصي', 'رقم الواتساب', 'رقم التليجرام',
      // Other languages
      'teléfono', 'TELÉFONO', 'Teléfono', 'tElÉfOnO',
      'téléphone', 'TÉLÉPHONE', 'Téléphone', 'tÉlÉpHoNe',
      'телефон', 'ТЕЛЕФОН', 'Телефон', 'тЕлЕфОн',
      '電話', '전화', '전화'
    ],
    parent_phone: [
      // English variations - all case combinations
      'parent_phone', 'PARENT_PHONE', 'Parent_Phone', 'parent_PHONE', 'PARENT_phone',
      'parentphone', 'PARENTPHONE', 'Parentphone', 'parentPHONE', 'PARENTphone',
      'parent phone', 'PARENT PHONE', 'Parent Phone', 'parent PHONE', 'PARENT phone',
      'guardian_phone', 'GUARDIAN_PHONE', 'Guardian_Phone', 'guardian_PHONE', 'GUARDIAN_phone',
      'guardianphone', 'GUARDIANPHONE', 'Guardianphone', 'guardianPHONE', 'GUARDIANphone',
      'guardian phone', 'GUARDIAN PHONE', 'Guardian Phone', 'guardian PHONE', 'GUARDIAN phone',
      'father_phone', 'FATHER_PHONE', 'Father_Phone', 'father_PHONE', 'FATHER_phone',
      'mother_phone', 'MOTHER_PHONE', 'Mother_Phone', 'mother_PHONE', 'MOTHER_phone',
      'father phone', 'FATHER PHONE', 'Father Phone', 'father PHONE', 'FATHER phone',
      'mother phone', 'MOTHER PHONE', 'Mother Phone', 'mother PHONE', 'MOTHER phone',
      'parent_contact', 'PARENT_CONTACT', 'Parent_Contact', 'parent_CONTACT', 'PARENT_contact',
      'guardian_contact', 'GUARDIAN_CONTACT', 'Guardian_Contact', 'guardian_CONTACT', 'GUARDIAN_contact',
      'emergency_contact', 'EMERGENCY_CONTACT', 'Emergency_Contact', 'emergency_CONTACT', 'EMERGENCY_contact',
      'emergency_phone', 'EMERGENCY_PHONE', 'Emergency_Phone', 'emergency_PHONE', 'EMERGENCY_phone',
      'family_phone', 'FAMILY_PHONE', 'Family_Phone', 'family_PHONE', 'FAMILY_phone',
      'home_phone', 'HOME_PHONE', 'Home_Phone', 'home_PHONE', 'HOME_phone',
      'parent_mobile', 'PARENT_MOBILE', 'Parent_Mobile', 'parent_MOBILE', 'PARENT_mobile',
      'guardian_mobile', 'GUARDIAN_MOBILE', 'Guardian_Mobile', 'guardian_MOBILE', 'GUARDIAN_mobile',
      // Arabic variations
      'هاتف الوالد', 'هاتف الوالدة', 'رقم ولي الأمر', 'هاتف ولي الأمر',
      'هاتف الأب', 'هاتف الأم', 'رقم الأب', 'رقم الأم', 'هاتف العائلة',
      'هاتف الطوارئ', 'رقم الطوارئ', 'هاتف المنزل',
      // Other languages
      'teléfono del padre', 'TELÉFONO DEL PADRE', 'Teléfono Del Padre', 'teléfono DEL PADRE', 'TELÉFONO del padre',
      'téléphone parent', 'TÉLÉPHONE PARENT', 'Téléphone Parent', 'téléphone PARENT', 'TÉLÉPHONE parent',
      'телефон родителя', 'ТЕЛЕФОН РОДИТЕЛЯ', 'Телефон Родителя', 'телефон РОДИТЕЛЯ', 'ТЕЛЕФОН родителя',
      '親の電話', '부모 전화', '부모 전화'
    ],
    email: [
      // English variations - all case combinations
      'email', 'EMAIL', 'Email', 'eMaIl',
      'e_mail', 'E_MAIL', 'E_Mail', 'e_MAIL', 'E_mail',
      'email_address', 'EMAIL_ADDRESS', 'Email_Address', 'email_ADDRESS', 'EMAIL_address',
      'mail', 'MAIL', 'Mail', 'mAiL',
      'electronic_mail', 'ELECTRONIC_MAIL', 'Electronic_Mail', 'electronic_MAIL', 'ELECTRONIC_mail',
      'e-mail', 'E-MAIL', 'E-Mail', 'e-MAIL', 'E-mail',
      'student_email', 'STUDENT_EMAIL', 'Student_Email', 'student_EMAIL', 'STUDENT_email',
      'personal_email', 'PERSONAL_EMAIL', 'Personal_Email', 'personal_EMAIL', 'PERSONAL_email',
      'contact_email', 'CONTACT_EMAIL', 'Contact_Email', 'contact_EMAIL', 'CONTACT_email',
      'primary_email', 'PRIMARY_EMAIL', 'Primary_Email', 'primary_EMAIL', 'PRIMARY_email',
      // Arabic variations
      'البريد الإلكتروني', 'الإيميل', 'البريد', 'البريد الإلكتروني للطالب',
      'البريد الشخصي', 'البريد الأساسي',
      // Other languages
      'correo', 'CORREO', 'Correo', 'cOrReO',
      'courriel', 'COURRIEL', 'Courriel', 'cOuRrIeL',
      'электронная почта', 'ЭЛЕКТРОННАЯ ПОЧТА', 'Электронная Почта', 'электронная ПОЧТА', 'ЭЛЕКТРОННАЯ почта',
      'メール', '이메일', '이메일'
    ],
    address: [
      // English variations - all case combinations
      'address', 'ADDRESS', 'Address', 'aDdReSs',
      'location', 'LOCATION', 'Location', 'lOcAtIoN',
      'home_address', 'HOME_ADDRESS', 'Home_Address', 'home_ADDRESS', 'HOME_address',
      'residence', 'RESIDENCE', 'Residence', 'rEsIdEnCe',
      'residential_address', 'RESIDENTIAL_ADDRESS', 'Residential_Address', 'residential_ADDRESS', 'RESIDENTIAL_address',
      'permanent_address', 'PERMANENT_ADDRESS', 'Permanent_Address', 'permanent_ADDRESS', 'PERMANENT_address',
      'current_address', 'CURRENT_ADDRESS', 'Current_Address', 'current_ADDRESS', 'CURRENT_address',
      'mailing_address', 'MAILING_ADDRESS', 'Mailing_Address', 'mailing_ADDRESS', 'MAILING_address',
      'contact_address', 'CONTACT_ADDRESS', 'Contact_Address', 'contact_ADDRESS', 'CONTACT_address',
      'street_address', 'STREET_ADDRESS', 'Street_Address', 'street_ADDRESS', 'STREET_address',
      'full_address', 'FULL_ADDRESS', 'Full_Address', 'full_ADDRESS', 'FULL_address',
      'complete_address', 'COMPLETE_ADDRESS', 'Complete_Address', 'complete_ADDRESS', 'COMPLETE_address',
      'detailed_address', 'DETAILED_ADDRESS', 'Detailed_Address', 'detailed_ADDRESS', 'DETAILED_address',
      // Arabic variations
      'العنوان', 'المكان', 'الموقع', 'عنوان المنزل', 'عنوان السكن',
      'العنوان الدائم', 'العنوان الحالي', 'عنوان المراسلة', 'عنوان الاتصال',
      'عنوان الشارع', 'العنوان الكامل', 'العنوان التفصيلي',
      // Other languages
      'dirección', 'DIRECCIÓN', 'Dirección', 'dIrEcCiÓn',
      'adresse', 'ADRESSE', 'Adresse', 'aDrEsSe',
      'адрес', 'АДРЕС', 'Адрес', 'аДрЕс',
      '住所', '주소', '주소'
    ]
  };
  
  // Enhanced matching algorithm
  const lowerHeaders = headers.map(h => h ? h.toString().toLowerCase().trim() : '');
  
  // Find matches for each field with improved scoring
  for (const [field, variations] of Object.entries(fieldVariations)) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (let i = 0; i < lowerHeaders.length; i++) {
      const header = lowerHeaders[i];
      if (!header) continue;
      
      // Calculate match score
      let score = 0;
      
      for (const variation of variations) {
        const lowerVariation = variation.toLowerCase();
        
        // Exact match gets highest score
        if (header === lowerVariation) {
          score = 100;
          break;
        }
        
        // Contains match gets medium score
        if (header.includes(lowerVariation) || lowerVariation.includes(header)) {
          score = Math.max(score, 80);
        }
        
        // Word boundary match gets good score
        const words = header.split(/[\s\-_\.]+/);
        const variationWords = lowerVariation.split(/[\s\-_\.]+/);
        
        for (const word of words) {
          for (const vWord of variationWords) {
            if (word === vWord) {
              score = Math.max(score, 60);
            } else if (word.includes(vWord) || vWord.includes(word)) {
              score = Math.max(score, 40);
            }
          }
        }
        
        // Fuzzy match for similar words
        if (calculateSimilarity(header, lowerVariation) > 0.7) {
          score = Math.max(score, 30);
        }
      }
      
      if (score > bestScore && score >= 30) {
        bestScore = score;
        bestMatch = i;
      }
    }
    
    if (bestMatch !== null) {
      mappings[field] = bestMatch;
    }
  }
  
  return mappings;
}

// Helper function to calculate string similarity
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

// Helper function to calculate Levenshtein distance
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
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
          let value = cell.v;
          
          // Enhanced data processing based on field type
          switch (field) {
            case 'id':
              // Clean and format ID
              value = cleanAndFormatId(value);
              break;
            case 'name':
              // Clean and format name
              value = cleanAndFormatName(value);
              break;
            case 'phone':
            case 'parent_phone':
              // Clean and format phone numbers
              value = cleanAndFormatPhone(value);
              break;
            case 'email':
              // Clean and format email
              value = cleanAndFormatEmail(value);
              break;
            case 'fees':
              // Clean and format fees
              value = cleanAndFormatFees(value);
              break;
            case 'center':
            case 'subject':
            case 'grade':
            case 'address':
              // Clean and format text fields
              value = cleanAndFormatText(value);
              break;
            default:
              value = value.toString().trim();
          }
          
          if (value && value !== '') {
            student[field] = value;
            hasData = true;
          } else {
            student[field] = null;
          }
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
      
      students.push(student);
    }
  }
  
  return students;
}

// Enhanced data cleaning and formatting functions
function cleanAndFormatId(value) {
  if (!value) return '';
  
  let id = value.toString().trim();
  
  // Remove common prefixes/suffixes
  id = id.replace(/^(id|student|no|number|#|رقم|الرقم)[\s\-_\.:]*/i, '');
  id = id.replace(/[\s\-_\.:]*$/i, '');
  
  // Remove extra spaces and normalize
  id = id.replace(/\s+/g, ' ').trim();
  
  return id;
}

function cleanAndFormatName(value) {
  if (!value) return '';
  
  let name = value.toString().trim();
  
  // Remove extra spaces and normalize
  name = name.replace(/\s+/g, ' ').trim();
  
  // Capitalize first letter of each word (for English names)
  if (/^[a-zA-Z\s]+$/.test(name)) {
    name = name.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
  
  return name;
}

function cleanAndFormatPhone(value) {
  if (!value) return '';
  
  let phone = value.toString().trim();
  
  // Remove all non-digit characters except + at the beginning
  phone = phone.replace(/[^\d+]/g, '');
  
  // Remove leading zeros and normalize
  if (phone.startsWith('+')) {
    phone = '+' + phone.substring(1).replace(/^0+/, '');
  } else {
    phone = phone.replace(/^0+/, '');
  }
  
  // Add country code if missing (assuming local format)
  if (phone.length > 0 && !phone.startsWith('+')) {
    // This is a simple heuristic - you might want to customize based on your region
    if (phone.length === 10) {
      phone = '+1' + phone; // Assuming US format
    } else if (phone.length === 11 && phone.startsWith('1')) {
      phone = '+' + phone;
    }
  }
  
  return phone;
}

function cleanAndFormatEmail(value) {
  if (!value) return '';
  
  let email = value.toString().trim().toLowerCase();
  
  // Basic email validation and cleaning
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(email)) {
    return email;
  }
  
  return '';
}

function cleanAndFormatFees(value) {
  if (!value) return '';
  
  let fees = value.toString().trim();
  
  // Remove currency symbols and text
  fees = fees.replace(/[$£€¥₹₽₩₪₦₨₴₸₼₾₿\s,]/g, '');
  fees = fees.replace(/[^\d\.]/g, '');
  
  // Convert to number
  const numFees = parseFloat(fees);
  if (!isNaN(numFees) && numFees >= 0) {
    return numFees.toString();
  }
  
  return '';
}

function cleanAndFormatText(value) {
  if (!value) return '';
  
  let text = value.toString().trim();
  
  // Remove extra spaces and normalize
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
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
    
    // Detect column mappings with enhanced feedback
    const mappingQuality = assessMappingQuality(mappings, headers);
    
    // Analyze data quality
    const dataQuality = analyzeDataQuality(students);
    
    return {
      success: true,
      headers: headers,
      mappings: mappings,
      students: students,
      totalRows: range.e.r - range.s.r,
      dataRows: students.length,
      sheetName,
      mappingQuality,
      dataQuality,
      recommendations: generateRecommendations(mappings, dataQuality),
      detectedFields: Object.keys(mappings).filter(field => mappings[field] !== null)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Assess the quality of column mappings
function assessMappingQuality(mappings, headers) {
  const quality = {
    score: 0,
    mappedFields: 0,
    totalFields: Object.keys(mappings).length,
    missingFields: [],
    mappedColumns: []
  };
  
  for (const [field, colIndex] of Object.entries(mappings)) {
    if (colIndex !== null) {
      quality.mappedFields++;
      quality.mappedColumns.push({
        field,
        column: headers[colIndex],
        index: colIndex
      });
    } else {
      quality.missingFields.push(field);
    }
  }
  
  quality.score = Math.round((quality.mappedFields / quality.totalFields) * 100);
  
  return quality;
}

// Analyze the quality of parsed student data
function analyzeDataQuality(students) {
  const quality = {
    totalStudents: students.length,
    validStudents: 0,
    studentsWithId: 0,
    studentsWithPhone: 0,
    studentsWithEmail: 0,
    studentsWithFees: 0,
    issues: []
  };
  
  students.forEach((student, index) => {
    let isValid = true;
    
    // Check required fields
    if (!student.name || student.name.trim() === '') {
      quality.issues.push(`Row ${index + 2}: Missing student name`);
      isValid = false;
    }
    
    // Count optional fields
    if (student.id && student.id.trim() !== '') {
      quality.studentsWithId++;
    }
    
    if (student.phone && student.phone.trim() !== '') {
      quality.studentsWithPhone++;
    }
    
    if (student.email && student.email.trim() !== '') {
      quality.studentsWithEmail++;
    }
    
    if (student.fees && student.fees.trim() !== '') {
      quality.studentsWithFees++;
    }
    
    if (isValid) {
      quality.validStudents++;
    }
  });
  
  return quality;
}

// Generate recommendations for improving the import
function generateRecommendations(mappings, dataQuality) {
  const recommendations = [];
  
  // Check for missing critical mappings
  if (!mappings.name) {
    recommendations.push({
      type: 'critical',
      message: 'Student name column not detected. Please ensure your Excel file has a column with student names (e.g., "Name", "Student Name", "Full Name").'
    });
  }
  
  if (!mappings.id) {
    recommendations.push({
      type: 'warning',
      message: 'Student ID column not detected. Consider adding a column with student IDs for better tracking.'
    });
  }
  
  // Check data quality issues
  if (dataQuality.issues.length > 0) {
    recommendations.push({
      type: 'warning',
      message: `${dataQuality.issues.length} data quality issues found. Please review and fix these issues for better import results.`
    });
  }
  
  // Check for low completion rates
  const completionRate = dataQuality.validStudents / dataQuality.totalStudents;
  if (completionRate < 0.8) {
    recommendations.push({
      type: 'info',
      message: `Only ${Math.round(completionRate * 100)}% of rows have valid student data. Consider reviewing your data format.`
    });
  }
  
  // Suggest improvements
  if (dataQuality.studentsWithPhone / dataQuality.totalStudents < 0.5) {
    recommendations.push({
      type: 'suggestion',
      message: 'Consider adding phone numbers for better student contact information.'
    });
  }
  
  if (dataQuality.studentsWithEmail / dataQuality.totalStudents < 0.3) {
    recommendations.push({
      type: 'suggestion',
      message: 'Consider adding email addresses for digital communication.'
    });
  }
  
  return recommendations;
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

  // Auto-import Excel files on startup only (not continuously)
  autoImportExcelFiles();

  // Set up periodic scanning (every 5 minutes) - but skip manager files
  setInterval(() => {
    autoImportExcelFiles();
  }, 300000); // 5 minutes

  logToSystem('success', 'Auto Excel import system initialized');
}

async function autoImportExcelFiles() {
  // Skip auto-import if manual operations are in progress
  if (manualOperationInProgress) {
    logToSystem('info', 'Skipping auto-import: manual operation in progress');
    return;
  }
  
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
      
      // Skip if file is being processed or is a backup
      if (file.includes('_processed_') || file.includes('_backup_') || file.includes('_imported_')) {
        logToSystem('info', `Skipping processed/backup/imported file: ${file}`);
        continue;
      }
      
      // IMPORTANT: Skip the main manager Excel file to prevent editing it
      // This is the file that the Data Collection Manager uses
      if (file.toLowerCase().includes('students-database') || 
          file.toLowerCase().includes('main') || 
          file.toLowerCase().includes('manager') ||
          file.toLowerCase().includes('primary')) {
        logToSystem('info', `Skipping main manager Excel file: ${file} (protected from auto-import)`);
        continue;
      }
      
      // Check if this file has already been imported by looking for a backup copy
      const backupPath = path.join(__dirname, '..', '..', 'Student-Data', 'processed');
      if (fs.existsSync(backupPath)) {
        const backupFiles = fs.readdirSync(backupPath);
        const hasBeenImported = backupFiles.some(backupFile => 
          backupFile.includes(file.replace(/\.[^/.]+$/, "")) && backupFile.includes('_imported_')
        );
        
        if (hasBeenImported) {
          logToSystem('info', `Skipping already imported file: ${file}`);
          continue;
        }
      }
      
      // Check if file was recently modified (within last 10 minutes)
      try {
        const stats = fs.statSync(filePath);
        const now = Date.now();
        const fileAge = now - stats.mtime.getTime();
        
        // Skip files that were modified recently (might be in use or being edited)
        if (fileAge < 600000) { // 10 minutes
          logToSystem('info', `Skipping recently modified file: ${file} (modified ${Math.round(fileAge/60000)} minutes ago)`);
          continue;
        }
        
        // Additional check: skip if file is currently being accessed
        fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
        
      } catch (error) {
        logToSystem('info', `Skipping file in use or inaccessible: ${file}`);
        continue;
      }
      
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

    // DO NOT move the original Excel file - keep it for reference
    // Only create a backup copy, don't move the original
    await createBackupCopy(filePath, fileName);

  } catch (error) {
    logToSystem('error', `Auto-import failed for ${fileName}: ${error.message}`);
  }
}

async function createBackupCopy(filePath, fileName) {
  try {
    // IMPORTANT: Don't create backup for main manager files
    if (fileName.toLowerCase().includes('students-database') || 
        fileName.toLowerCase().includes('main') || 
        fileName.toLowerCase().includes('manager') ||
        fileName.toLowerCase().includes('primary')) {
      logToSystem('info', `Skipping backup creation for main manager file: ${fileName} (protected)`);
      return;
    }
    
    const backupPath = path.join(__dirname, '..', '..', 'Student-Data', 'processed');
    
    // Create backup folder if it doesn't exist
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(fileName);
    const name = path.basename(fileName, ext);
    const backupFileName = `${name}_imported_${timestamp}${ext}`;
    const backupFilePath = path.join(backupPath, backupFileName);

    // COPY file to backup folder (don't move the original)
    fs.copyFileSync(filePath, backupFilePath);
    
    logToSystem('info', `Created backup copy: ${backupFileName} (original file preserved)`);

  } catch (error) {
    logToSystem('warning', `Failed to create backup copy of ${fileName}: ${error.message}`);
  }
}

// Keep the old function for backward compatibility but mark it as deprecated
async function moveProcessedFile(filePath, fileName) {
  logToSystem('warning', `DEPRECATED: moveProcessedFile called for ${fileName} - using createBackupCopy instead`);
  await createBackupCopy(filePath, fileName);
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
      host: REAL_IP,
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

// Broadcast to all exit validators
async function broadcastToAllExitValidators(record) {
  let exitValidatorsFound = 0;
  let sentCount = 0;
  
  for (const [client, info] of devices.entries()) {
    if (info.role === 'last_scan') {
      exitValidatorsFound++;
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({ 
            type: 'receive_student_record', 
            record: record 
          }));
          sentCount++;
          logToSystem('info', `Offline sync: Student record sent to exit validator: ${info.name} (${record.student_name})`);
        } catch (error) {
          logToSystem('error', `Failed to send offline sync to exit validator ${info.name}: ${error.message}`);
        }
      } else {
        logToSystem('warning', `Exit validator ${info.name} WebSocket not open during offline sync (state: ${client.readyState})`);
      }
    }
  }
  
  if (exitValidatorsFound === 0) {
    logToSystem('warning', 'No exit validators connected during offline sync');
  } else {
    logToSystem('info', `Offline sync: Found ${exitValidatorsFound} exit validator(s), sent to ${sentCount} device(s)`);
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
        // Set manual operation flag to prevent Excel file interference
        manualOperationInProgress = true;
        try {
          result = await Database.createStudent(data);
          logToSystem('success', `Student synced to MySQL: ${data.name} (ID: ${data.id}) from ${deviceName}`);
        } finally {
          // Clear flag after operation completes
          setTimeout(() => {
            manualOperationInProgress = false;
          }, 5000); // 5 second delay to ensure operation is complete
        }
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
        
        // If this is an exit validator, send all today's students immediately
        if (data.role === 'last_scan') {
          setTimeout(async () => {
            try {
              const today = new Date().toISOString().split('T')[0];
              const registrations = await Database.getEntryRegistrationsByDate(today);
              
              logToSystem('info', `Sending ${registrations.length} today's students to newly connected exit validator: ${data.name}`);
              
              for (const record of registrations) {
                if (ws.readyState === WebSocket.OPEN) {
                  try {
                    ws.send(JSON.stringify({
                      type: 'receive_student_record',
                      record: record
                    }));
                  } catch (error) {
                    logToSystem('error', `Failed to send student record to exit validator: ${error.message}`);
                    break;
                  }
                } else {
                  logToSystem('warning', `Exit validator disconnected while sending student records`);
                  break;
                }
              }
              
              logToSystem('info', `Completed sending today's students to exit validator: ${data.name}`);
            } catch (error) {
              logToSystem('error', `Failed to send today's students to exit validator: ${error.message}`);
            }
          }, 2000); // Wait 2 seconds after connection
        }
        
        // AUTO-PUSH: Send student cache to Entry Scanner devices only
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
      
      if (data.type === 'request_todays_students') {
        // Handle request for today's registered students (for offline scanning)
        try {
          const today = new Date().toISOString().split('T')[0];
          const registrations = await Database.getEntryRegistrationsByDate(today);
          
          // Create student cache from today's registrations
          const todaysStudents = {};
          registrations.forEach(record => {
            if (record.student_id) {
              const studentData = studentCache[record.student_id] || {};
              todaysStudents[record.student_id] = {
                id: record.student_id,
                name: studentData.name || record.student_name || 'Unknown',
                center: studentData.center || record.center || '',
                grade: studentData.grade || record.grade || '',
                phone: studentData.phone || record.phone || '',
                parent_phone: studentData.parent_phone || record.parent_phone || '',
                subject: studentData.subject || record.subject || '',
                fees: studentData.fees || record.fees || 0,
                registered_at: record.timestamp
              };
            }
          });
          
          ws.send(JSON.stringify({
            type: 'todays_students_response',
            cache: todaysStudents,
            timestamp: new Date().toISOString(),
            totalStudents: Object.keys(todaysStudents).length,
            date: today
          }));
          
          const deviceInfo = devices.get(ws);
          const deviceName = deviceInfo ? deviceInfo.name : 'Unknown';
          logToSystem('info', `Sent ${Object.keys(todaysStudents).length} today's students to ${deviceName} for offline scanning`);
          
          // If this is an exit validator, also send individual receive_student_record messages
          if (deviceInfo && deviceInfo.role === 'last_scan') {
            logToSystem('info', `Sending individual student records to exit validator: ${deviceName}`);
            let sentCount = 0;
            for (const [studentId, studentData] of Object.entries(todaysStudents)) {
              try {
                ws.send(JSON.stringify({
                  type: 'receive_student_record',
                  record: studentData
                }));
                sentCount++;
              } catch (error) {
                logToSystem('error', `Failed to send student record ${studentId} to exit validator: ${error.message}`);
              }
            }
            logToSystem('info', `Sent ${sentCount} individual student records to exit validator: ${deviceName}`);
          }
        } catch (error) {
          logToSystem('error', `Failed to get today's students: ${error.message}`);
          ws.send(JSON.stringify({
            type: 'todays_students_response',
            cache: {},
            timestamp: new Date().toISOString(),
            totalStudents: 0,
            error: error.message
          }));
        }
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
        let exitValidatorsFound = 0;
        for (const [client, info] of devices.entries()) {
          if (info.role === 'last_scan') {
            exitValidatorsFound++;
            if (client.readyState === WebSocket.OPEN) {
              try {
                client.send(JSON.stringify({ 
                  type: 'receive_student_record', 
                  record: data.record 
                }));
                logToSystem('info', `Student registration sent to exit validator: ${info.name} (${record.student_name})`);
              } catch (error) {
                logToSystem('error', `Failed to send to exit validator ${info.name}: ${error.message}`);
              }
            } else {
              logToSystem('warning', `Exit validator ${info.name} WebSocket not open (state: ${client.readyState})`);
            }
          }
        }
        
        if (exitValidatorsFound === 0) {
          logToSystem('warning', 'No exit validators connected to receive student registration');
        } else {
          logToSystem('info', `Found ${exitValidatorsFound} exit validator(s), sent to ${exitValidatorsFound} device(s)`);
        }
        
        // Notify admins
        broadcastToAdmins({
          type: 'student_registered',
          record: data.record,
          timestamp: new Date().toISOString()
        });
        
        // Broadcast updated stats to all admin dashboards
        await broadcastUpdatedStats();
        
        // If this is from offline sync, also broadcast to all connected exit validators
        // to ensure they get the student record even if they connected before the sync
        if (data.fromOfflineSync) {
          logToSystem('info', 'Offline sync detected - broadcasting to all connected exit validators');
          await broadcastToAllExitValidators(data.record);
        }
        
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
  const totalServers = (wssHttps ? 2 : 1) + 2; // WebSocket servers + HTTP servers
  
  const checkShutdown = () => {
    closedCount++;
    if (closedCount >= totalServers) {
      logToSystem('success', 'All servers closed successfully');
      console.log('✅ All servers closed');
      process.exit(0);
    }
  };
  
  // Close HTTP server
  if (httpServer) {
    httpServer.close(() => {
      logToSystem('success', 'HTTP server closed');
      checkShutdown();
    });
  }
  
  // Close HTTPS server
  if (httpsServer) {
    httpsServer.close(() => {
      logToSystem('success', 'HTTPS server closed');
      checkShutdown();
    });
  }
  
  // Close WebSocket servers
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
  
  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    console.log('⚠️  Forcing exit after timeout...');
    process.exit(1);
  }, 5000);
});

// Handle SIGTERM for Windows
process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  logToSystem('error', `Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logToSystem('error', `Unhandled Rejection: ${reason}`);
  process.exit(1);
});
