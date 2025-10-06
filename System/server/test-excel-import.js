#!/usr/bin/env node

/**
 * Test script to verify Excel import functionality
 */

const path = require('path');

// Import the functions from main-server.js
const fs = require('fs');

// Read the main-server.js file and extract the functions we need
const mainServerPath = path.join(__dirname, 'main-server.js');
const mainServerContent = fs.readFileSync(mainServerPath, 'utf8');

// Create a simple test environment
const XLSX = require('xlsx');

// Copy the detectColumnMappings function
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
      'id', 'ID', 'student_id', 'student id', 'student number', 'roll number', 'registration number'
    ],
    name: [
      'name', 'NAME', 'student_name', 'student name', 'full_name', 'full name'
    ],
    center: [
      'center', 'CENTER', 'centre', 'branch', 'location', 'institution'
    ],
    subject: [
      'subject', 'SUBJECT', 'course', 'material', 'discipline'
    ],
    grade: [
      'grade', 'GRADE', 'level', 'class', 'year', 'academic_year'
    ],
    fees: [
      'fees', 'FEES', 'fee', 'amount', 'price', 'cost', 'tuition'
    ],
    phone: [
      'phone', 'PHONE', 'mobile', 'tel', 'telephone', 'contact'
    ],
    parent_phone: [
      'parent_phone', 'PARENT_PHONE', 'Parent_Phone', 'parent_PHONE', 'PARENT_phone',
      'parent phone', 'PARENT PHONE', 'Parent Phone', 'parent PHONE', 'PARENT phone',
      'parentphone', 'PARENTPHONE', 'ParentPhone', 'parentPHONE', 'PARENTphone',
      'guardian_phone', 'GUARDIAN_PHONE', 'Guardian_Phone', 'guardian_PHONE', 'GUARDIAN_phone',
      'guardian phone', 'GUARDIAN PHONE', 'Guardian Phone', 'guardian PHONE', 'GUARDIAN phone'
    ],
    email: [
      'email', 'EMAIL', 'email_address', 'e_mail'
    ],
    address: [
      'address', 'ADDRESS', 'location', 'residence'
    ]
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

function testExcelImport() {
  try {
    const filePath = path.join(__dirname, '..', '..', 'Student-Data', 'students-database.xlsx');
    console.log('🧪 Testing Excel Import Functionality');
    console.log('=' .repeat(50));
    
    // Read the Excel file
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
    
    console.log('\n📋 Headers:', headers);
    
    // Test column mapping detection
    const mappings = detectColumnMappings(headers);
    console.log('\n🎯 Column Mappings:');
    Object.entries(mappings).forEach(([field, colIndex]) => {
      if (colIndex !== null) {
        console.log(`   ✅ ${field}: Column ${colIndex + 1} ("${headers[colIndex]}")`);
      } else {
        console.log(`   ❌ ${field}: Not detected`);
      }
    });
    
    // Test data extraction for student 557
    console.log('\n🔍 Testing data extraction for student 557:');
    
    // Find student 557 in the data
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const idCellAddress = XLSX.utils.encode_cell({ r: row, c: mappings.id });
      const idCell = worksheet[idCellAddress];
      
      if (idCell && idCell.v && idCell.v.toString() === '557') {
        console.log(`   Found student 557 in row ${row + 1}`);
        
        // Extract all data for this student
        const studentData = {};
        Object.entries(mappings).forEach(([field, colIndex]) => {
          if (colIndex !== null) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
            const cell = worksheet[cellAddress];
            studentData[field] = cell ? cell.v : null;
            console.log(`     ${field}: "${studentData[field]}"`);
          }
        });
        
        console.log('\n📊 Extracted Student Data:');
        console.log(JSON.stringify(studentData, null, 2));
        
        // Check if we have complete data
        const hasCompleteData = !!(studentData.center && studentData.subject && studentData.grade);
        console.log(`\n✅ Complete Data: ${hasCompleteData ? 'YES' : 'NO'}`);
        
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing Excel import:', error.message);
  }
}

// Run the test
testExcelImport();
