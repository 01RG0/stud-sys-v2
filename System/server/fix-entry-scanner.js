#!/usr/bin/env node

/**
 * Fix script for entry scanner - manually import Excel data
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

// Import database functions
const { Database } = require('./database.js');

async function fixEntryScanner() {
  try {
    console.log('🔧 Fixing Entry Scanner Data Issue');
    console.log('=' .repeat(50));
    
    // Step 1: Check if Excel file exists
    const filePath = path.join(__dirname, '..', '..', 'Student-Data', 'students-database.xlsx');
    console.log('📁 Checking Excel file:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Excel file not found');
      return;
    }
    
    console.log('✅ Excel file found');
    
    // Step 2: Read and analyze Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    if (!worksheet || !worksheet['!ref']) {
      console.log('❌ No data found in Excel file');
      return;
    }
    
    // Get headers
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headers = [];
    
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
      const cell = worksheet[cellAddress];
      headers.push(cell ? cell.v : `Column ${col + 1}`);
    }
    
    console.log('📋 Headers found:', headers.length);
    
    // Step 3: Detect column mappings
    const mappings = {
      id: null,
      name: null,
      center: null,
      subject: null,
      grade: null,
      fees: null,
      phone: null,
      parent_phone: null
    };
    
    // Simple mapping detection
    headers.forEach((header, index) => {
      if (!header) return;
      const normalizedHeader = header.toString().trim().toLowerCase();
      
      if (normalizedHeader.includes('id')) mappings.id = index;
      else if (normalizedHeader.includes('name')) mappings.name = index;
      else if (normalizedHeader.includes('center')) mappings.center = index;
      else if (normalizedHeader.includes('subject')) mappings.subject = index;
      else if (normalizedHeader.includes('grade')) mappings.grade = index;
      else if (normalizedHeader.includes('fees')) mappings.fees = index;
      else if (normalizedHeader.includes('phone') && !normalizedHeader.includes('parent')) mappings.phone = index;
      else if (normalizedHeader.includes('parent phone')) mappings.parent_phone = index;
    });
    
    console.log('🎯 Column Mappings:');
    Object.entries(mappings).forEach(([field, colIndex]) => {
      if (colIndex !== null) {
        console.log(`   ✅ ${field}: Column ${colIndex + 1} ("${headers[colIndex]}")`);
      } else {
        console.log(`   ❌ ${field}: Not detected`);
      }
    });
    
    // Step 4: Parse student data
    const students = [];
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const student = {};
      
      Object.entries(mappings).forEach(([field, colIndex]) => {
        if (colIndex !== null) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIndex });
          const cell = worksheet[cellAddress];
          student[field] = cell ? cell.v : null;
        }
      });
      
      if (student.id) {
        students.push(student);
      }
    }
    
    console.log(`📊 Found ${students.length} students in Excel file`);
    
    // Step 5: Check student 557 specifically
    const student557 = students.find(s => s.id == 557);
    if (student557) {
      console.log('\n🔍 Student 557 Data from Excel:');
      console.log('   ID:', student557.id);
      console.log('   Name:', student557.name);
      console.log('   Center:', student557.center);
      console.log('   Subject:', student557.subject);
      console.log('   Grade:', student557.grade);
      console.log('   Fees:', student557.fees);
      console.log('   Phone:', student557.phone);
      console.log('   Parent Phone:', student557.parent_phone);
      
      const hasCompleteData = !!(student557.center && student557.subject && student557.grade);
      console.log(`\n✅ Complete Data in Excel: ${hasCompleteData ? 'YES' : 'NO'}`);
      
      if (hasCompleteData) {
        console.log('\n🔄 Importing student data to database...');
        
        // Step 6: Import to database
        let importedCount = 0;
        let updatedCount = 0;
        
        for (const student of students) {
          try {
            // Convert data types to ensure compatibility
            const studentData = {
              id: student.id ? student.id.toString() : null,
              name: student.name ? student.name.toString() : null,
              center: student.center ? student.center.toString() : null,
              subject: student.subject ? student.subject.toString() : null,
              grade: student.grade ? student.grade.toString() : null,
              fees: student.fees ? student.fees.toString() : null,
              phone: student.phone ? student.phone.toString() : null,
              parent_phone: student.parent_phone ? student.parent_phone.toString() : null
            };
            
            const result = await Database.createStudent(studentData);
            
            if (result.affectedRows > 0) {
              if (result.changedRows > 0) {
                updatedCount++;
              } else {
                importedCount++;
              }
            }
          } catch (error) {
            console.log(`   ⚠️  Error importing student ${student.id}: ${error.message}`);
          }
        }
        
        console.log(`\n📈 Import Results:`);
        console.log(`   ✅ Imported: ${importedCount} students`);
        console.log(`   🔄 Updated: ${updatedCount} students`);
        
        // Step 7: Test student 557 lookup
        console.log('\n🧪 Testing student 557 lookup...');
        try {
          const dbStudent = await Database.getStudentById(557);
          if (dbStudent) {
            console.log('✅ Student 557 found in database:');
            console.log('   ID:', dbStudent.id);
            console.log('   Name:', dbStudent.name);
            console.log('   Center:', dbStudent.center);
            console.log('   Subject:', dbStudent.subject);
            console.log('   Grade:', dbStudent.grade);
            
            const hasCompleteData = !!(dbStudent.center && dbStudent.subject && dbStudent.grade);
            console.log(`\n🎉 SUCCESS: Student 557 has complete data in database: ${hasCompleteData ? 'YES' : 'NO'}`);
            
            if (hasCompleteData) {
              console.log('\n✅ Entry scanner should now work correctly!');
              console.log('   The student data is now in the database and should be');
              console.log('   retrieved properly when scanning QR codes.');
            }
          } else {
            console.log('❌ Student 557 not found in database after import');
          }
        } catch (error) {
          console.log('❌ Error testing student lookup:', error.message);
        }
        
      } else {
        console.log('\n❌ Student 557 data is incomplete in Excel file');
        console.log('   Please check the Excel file and ensure all required fields are present');
      }
    } else {
      console.log('\n❌ Student 557 not found in Excel file');
    }
    
  } catch (error) {
    console.error('❌ Error fixing entry scanner:', error.message);
  }
}

// Run the fix
fixEntryScanner();
