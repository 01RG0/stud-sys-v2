#!/usr/bin/env node

/**
 * Test script to verify auto-import functionality
 */

const path = require('path');
const fs = require('fs');

// Import the functions from main-server.js
const mainServerPath = path.join(__dirname, 'main-server.js');
const mainServerContent = fs.readFileSync(mainServerPath, 'utf8');

// Create a simple test environment
const XLSX = require('xlsx');

// Copy the analyzeExcelFile function
function analyzeExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet || !worksheet['!ref']) {
      return { success: false, error: 'No data found in the Excel file' };
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
      detectedFields: Object.keys(mappings).filter(key => mappings[key] !== null)
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Copy the detectColumnMappings function (simplified version)
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
  
  // Basic field variations
  const fieldVariations = {
    id: ['id', 'ID', 'student_id', 'student id', 'student number'],
    name: ['name', 'NAME', 'student_name', 'student name', 'full_name', 'full name'],
    center: ['center', 'CENTER', 'centre', 'branch', 'location'],
    subject: ['subject', 'SUBJECT', 'course', 'material'],
    grade: ['grade', 'GRADE', 'level', 'class', 'year'],
    fees: ['fees', 'FEES', 'fee', 'amount', 'price', 'cost'],
    phone: ['phone', 'PHONE', 'mobile', 'tel', 'telephone'],
    parent_phone: ['parent_phone', 'PARENT_PHONE', 'parent phone', 'Parent Phone', 'guardian_phone', 'guardian phone'],
    email: ['email', 'EMAIL', 'e_mail', 'email_address'],
    address: ['address', 'ADDRESS', 'location', 'residence']
  };
  
  // Find matching columns
  headers.forEach((header, index) => {
    if (!header) return;
    
    const normalizedHeader = header.toString().trim().toLowerCase();
    
    Object.entries(fieldVariations).forEach(([field, variations]) => {
      if (mappings[field] === null) {
        for (const variation of variations) {
          if (normalizedHeader.includes(variation.toLowerCase()) || 
              variation.toLowerCase().includes(normalizedHeader)) {
            mappings[field] = index;
            return;
          }
        }
      }
    });
  });
  
  return mappings;
}

// Copy the parseStudentData function (simplified version)
function parseStudentData(worksheet, mappings) {
  const students = [];
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  
  // Process each row (skip header row)
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const student = {};
    
    // Extract data based on mappings
    Object.entries(mappings).forEach(([field, colIndex]) => {
      if (colIndex !== null) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
        const cell = worksheet[cellAddress];
        student[field] = cell ? cell.v : null;
      }
    });
    
    // Only add if we have at least an ID
    if (student.id) {
      students.push(student);
    }
  }
  
  return students;
}

async function testAutoImport() {
  try {
    console.log('🧪 Testing Auto-Import Functionality');
    console.log('=' .repeat(50));
    
    const filePath = path.join(__dirname, '..', '..', 'Student-Data', 'students-database.xlsx');
    console.log('📁 Excel file path:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Excel file not found at:', filePath);
      return;
    }
    
    console.log('✅ Excel file found');
    
    // Analyze the Excel file
    const analysis = analyzeExcelFile(filePath);
    
    if (!analysis.success) {
      console.log('❌ Failed to analyze Excel file:', analysis.error);
      return;
    }
    
    console.log('\n📊 Analysis Results:');
    console.log('   Headers:', analysis.headers.length);
    console.log('   Total Rows:', analysis.totalRows);
    console.log('   Students Found:', analysis.students.length);
    console.log('   Detected Fields:', analysis.detectedFields.join(', '));
    
    console.log('\n🎯 Column Mappings:');
    Object.entries(analysis.mappings).forEach(([field, colIndex]) => {
      if (colIndex !== null) {
        console.log(`   ✅ ${field}: Column ${colIndex + 1} ("${analysis.headers[colIndex]}")`);
      } else {
        console.log(`   ❌ ${field}: Not detected`);
      }
    });
    
    // Test student 557 specifically
    const student557 = analysis.students.find(s => s.id == 557);
    if (student557) {
      console.log('\n🔍 Student 557 Data:');
      console.log('   ID:', student557.id);
      console.log('   Name:', student557.name);
      console.log('   Center:', student557.center);
      console.log('   Subject:', student557.subject);
      console.log('   Grade:', student557.grade);
      console.log('   Fees:', student557.fees);
      console.log('   Phone:', student557.phone);
      console.log('   Parent Phone:', student557.parent_phone);
      
      const hasCompleteData = !!(student557.center && student557.subject && student557.grade);
      console.log(`\n✅ Complete Data: ${hasCompleteData ? 'YES' : 'NO'}`);
      
      if (hasCompleteData) {
        console.log('\n🎉 SUCCESS: Student 557 has complete data in Excel file!');
        console.log('   The issue is likely that the auto-import is not running or');
        console.log('   the data is not being loaded into the database/cache.');
      } else {
        console.log('\n❌ ISSUE: Student 557 data is incomplete in Excel file');
      }
    } else {
      console.log('\n❌ Student 557 not found in Excel file');
    }
    
  } catch (error) {
    console.error('❌ Error testing auto-import:', error.message);
  }
}

// Run the test
testAutoImport();
