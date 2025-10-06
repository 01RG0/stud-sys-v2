#!/usr/bin/env node

/**
 * Script to analyze the Excel file and show what columns are available
 */

const XLSX = require('xlsx');
const path = require('path');

function analyzeExcelFile() {
  try {
    const filePath = path.join(__dirname, '..', '..', 'Student-Data', 'students-database.xlsx');
    console.log('📊 Analyzing Excel file:', filePath);
    console.log('=' .repeat(60));
    
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
    
    console.log('\n📋 Headers found in Excel file:');
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
      const cell = worksheet[cellAddress];
      const header = cell ? cell.v : `Column ${col + 1}`;
      headers.push(header);
      console.log(`   Column ${col + 1}: "${header}"`);
    }
    
    console.log('\n📊 Data rows found:', range.e.r - range.s.r);
    console.log('\n🔍 Sample data (first 3 rows):');
    
    // Show sample data
    for (let row = range.s.r + 1; row <= Math.min(range.s.r + 4, range.e.r); row++) {
      console.log(`\n   Row ${row}:`);
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        const value = cell ? cell.v : '';
        const header = headers[col - range.s.c];
        console.log(`     ${header}: "${value}"`);
      }
    }
    
    // Test column mapping detection
    console.log('\n🎯 Column Mapping Detection:');
    const mappings = detectColumnMappings(headers);
    
    Object.entries(mappings).forEach(([field, colIndex]) => {
      if (colIndex !== null) {
        console.log(`   ✅ ${field}: Column ${colIndex + 1} ("${headers[colIndex]}")`);
      } else {
        console.log(`   ❌ ${field}: Not detected`);
      }
    });
    
    console.log('\n📈 Summary:');
    const detectedFields = Object.keys(mappings).filter(field => mappings[field] !== null);
    console.log(`   Total columns: ${headers.length}`);
    console.log(`   Detected fields: ${detectedFields.length}`);
    console.log(`   Detected fields: ${detectedFields.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error analyzing Excel file:', error.message);
  }
}

// Simplified column mapping detection (from the main server)
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
    id: ['id', 'ID', 'student_id', 'student id', 'student number', 'roll number', 'registration number'],
    name: ['name', 'NAME', 'student_name', 'student name', 'full_name', 'full name'],
    center: ['center', 'CENTER', 'centre', 'branch', 'location', 'institution'],
    subject: ['subject', 'SUBJECT', 'course', 'material', 'discipline'],
    grade: ['grade', 'GRADE', 'level', 'class', 'year', 'academic_year'],
    fees: ['fees', 'FEES', 'fee', 'amount', 'price', 'cost', 'tuition'],
    phone: ['phone', 'PHONE', 'mobile', 'tel', 'telephone', 'contact'],
    parent_phone: ['parent_phone', 'parent phone', 'guardian_phone', 'emergency_contact'],
    email: ['email', 'EMAIL', 'email_address', 'e_mail'],
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

// Run the analysis
analyzeExcelFile();
