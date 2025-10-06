#!/usr/bin/env node

/**
 * Debug script to check student 557 data in detail
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { Database } = require('./database.js');

async function debugStudent557() {
  try {
    console.log('🔍 Debugging Student 557 Data');
    console.log('=' .repeat(50));
    
    // Step 1: Check Excel data in detail
    const filePath = path.join(__dirname, '..', '..', 'Student-Data', 'students-database.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // Find student 557 in Excel
    let excelStudent557 = null;
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const idCell = XLSX.utils.encode_cell({ r: row, c: 2 }); // Column 3 (ID)
      const idValue = worksheet[idCell] ? worksheet[idCell].v : null;
      
      if (idValue == 557) {
        console.log(`📊 Found student 557 in Excel at row ${row + 1}`);
        
        // Get all data for this row
        const headers = ['Date', 'Time', 'ID', 'Name', 'Center', 'Fees', 'Homework', 'Exam', 'Error', 'Timestamp', 'Extra Sessions', 'Comment', 'ErrorDetail', 'Fees.1', 'Subject', 'Grade', 'Session Sequence', 'GuestInfo', 'Phone', 'Parent Phone'];
        
        excelStudent557 = {};
        for (let col = 0; col < headers.length; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          const cell = worksheet[cellAddress];
          const value = cell ? cell.v : null;
          excelStudent557[headers[col]] = value;
          
          console.log(`   ${headers[col]}: "${value}" (type: ${typeof value})`);
        }
        break;
      }
    }
    
    if (!excelStudent557) {
      console.log('❌ Student 557 not found in Excel file');
      return;
    }
    
    console.log('\n🔍 Excel Data Analysis:');
    console.log(`   Center: "${excelStudent557.Center}" (type: ${typeof excelStudent557.Center})`);
    console.log(`   Subject: "${excelStudent557.Subject}" (type: ${typeof excelStudent557.Subject})`);
    console.log(`   Grade: "${excelStudent557.Grade}" (type: ${typeof excelStudent557.Grade})`);
    
    // Check if values are truthy
    console.log('\n🧪 Truthiness Check:');
    console.log(`   Center truthy: ${!!excelStudent557.Center}`);
    console.log(`   Subject truthy: ${!!excelStudent557.Subject}`);
    console.log(`   Grade truthy: ${!!excelStudent557.Grade}`);
    
    // Step 2: Check database data
    console.log('\n🗄️ Database Data:');
    try {
      const dbStudent = await Database.getStudentById('557');
      if (dbStudent) {
        console.log('✅ Student 557 found in database:');
        console.log(`   ID: "${dbStudent.id}" (type: ${typeof dbStudent.id})`);
        console.log(`   Name: "${dbStudent.name}" (type: ${typeof dbStudent.name})`);
        console.log(`   Center: "${dbStudent.center}" (type: ${typeof dbStudent.center})`);
        console.log(`   Subject: "${dbStudent.subject}" (type: ${typeof dbStudent.subject})`);
        console.log(`   Grade: "${dbStudent.grade}" (type: ${typeof dbStudent.grade})`);
        console.log(`   Phone: "${dbStudent.phone}" (type: ${typeof dbStudent.phone})`);
        console.log(`   Parent Phone: "${dbStudent.parent_phone}" (type: ${typeof dbStudent.parent_phone})`);
      } else {
        console.log('❌ Student 557 not found in database');
      }
    } catch (error) {
      console.log('❌ Error querying database:', error.message);
    }
    
    // Step 3: Try to update student 557 with correct data
    console.log('\n🔄 Attempting to update student 557 with correct data...');
    try {
      const updateData = {
        id: '557',
        name: excelStudent557.Name,
        center: excelStudent557.Center,
        subject: excelStudent557.Subject,
        grade: excelStudent557.Grade,
        phone: excelStudent557.Phone,
        parent_phone: excelStudent557['Parent Phone'],
        fees: excelStudent557['Fees.1'] || 0
      };
      
      console.log('📝 Update data:');
      Object.entries(updateData).forEach(([key, value]) => {
        console.log(`   ${key}: "${value}" (type: ${typeof value})`);
      });
      
      const result = await Database.createStudent(updateData);
      console.log(`✅ Update result: affectedRows=${result.affectedRows}, changedRows=${result.changedRows}`);
      
      // Check database again
      const updatedStudent = await Database.getStudentById('557');
      if (updatedStudent) {
        console.log('\n🎉 Updated student 557 data:');
        console.log(`   Center: "${updatedStudent.center}"`);
        console.log(`   Subject: "${updatedStudent.subject}"`);
        console.log(`   Grade: "${updatedStudent.grade}"`);
        
        const hasCompleteData = !!(updatedStudent.center && updatedStudent.subject && updatedStudent.grade);
        console.log(`\n✅ Complete Data: ${hasCompleteData ? 'YES' : 'NO'}`);
        
        if (hasCompleteData) {
          console.log('\n🎉 SUCCESS! Student 557 now has complete data in database!');
          console.log('   The entry scanner should now work correctly.');
        }
      }
      
    } catch (error) {
      console.log('❌ Error updating student:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error debugging student 557:', error.message);
  }
}

// Run the debug
debugStudent557();
