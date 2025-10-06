#!/usr/bin/env node

/**
 * Direct fix for student 557 using SQL UPDATE
 */

const { Database, pool } = require('./database.js');

async function fixStudent557Direct() {
  try {
    console.log('🔧 Direct Fix for Student 557');
    console.log('=' .repeat(50));
    
    // Direct SQL update for student 557
    const updateQuery = `
      UPDATE students 
      SET 
        center = 'Alakbal',
        subject = 'Math', 
        grade = 'Senior 1',
        phone = '1228801764',
        parent_phone = '1002674423',
        fees = 50
      WHERE id = '557'
    `;
    
    console.log('🔄 Executing direct SQL update...');
    const [result] = await pool.execute(updateQuery);
    
    console.log(`✅ Update result: affectedRows=${result.affectedRows}, changedRows=${result.changedRows}`);
    
    if (result.affectedRows > 0) {
      console.log('🎉 Student 557 updated successfully!');
      
      // Verify the update
      console.log('\n🔍 Verifying update...');
      const [rows] = await pool.execute('SELECT * FROM students WHERE id = ?', ['557']);
      
      if (rows.length > 0) {
        const student = rows[0];
        console.log('✅ Student 557 data after update:');
        console.log(`   ID: "${student.id}"`);
        console.log(`   Name: "${student.name}"`);
        console.log(`   Center: "${student.center}"`);
        console.log(`   Subject: "${student.subject}"`);
        console.log(`   Grade: "${student.grade}"`);
        console.log(`   Phone: "${student.phone}"`);
        console.log(`   Parent Phone: "${student.parent_phone}"`);
        console.log(`   Fees: "${student.fees}"`);
        
        const hasCompleteData = !!(student.center && student.subject && student.grade);
        console.log(`\n🎉 SUCCESS: Student 557 has complete data: ${hasCompleteData ? 'YES' : 'NO'}`);
        
        if (hasCompleteData) {
          console.log('\n✅ Entry scanner should now work correctly!');
          console.log('   Student 557 will now show:');
          console.log('   - Center: Alakbal');
          console.log('   - Subject: Math');
          console.log('   - Grade: Senior 1');
        }
      } else {
        console.log('❌ Student 557 not found after update');
      }
    } else {
      console.log('❌ No rows were affected by the update');
      console.log('   Student 557 might not exist in the database');
      
      // Try to insert if it doesn't exist
      console.log('\n🔄 Attempting to insert student 557...');
      const insertQuery = `
        INSERT INTO students (id, name, center, subject, grade, phone, parent_phone, fees)
        VALUES ('557', 'lian mohamed mahmoud sohail', 'Alakbal', 'Math', 'Senior 1', '1228801764', '1002674423', 50)
      `;
      
      const [insertResult] = await pool.execute(insertQuery);
      console.log(`✅ Insert result: affectedRows=${insertResult.affectedRows}`);
      
      if (insertResult.affectedRows > 0) {
        console.log('🎉 Student 557 inserted successfully!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing student 557:', error.message);
  }
}

// Run the fix
fixStudent557Direct();
