const Database = require('./System/server/database.js');

async function testNullIdOverwrite() {
  console.log('🧪 Testing NULL ID Overwrite Issue...\n');
  
  try {
    // Test 1: Create two students with null IDs
    console.log('📝 Test 1: Creating two students with null IDs...');
    
    const student1 = {
      id: null,
      name: 'Test Student 1',
      center: 'Test Center',
      grade: 'Grade 10',
      phone: '1234567890',
      parent_phone: '0987654321',
      subject: 'Math',
      fees: 50
    };
    
    const student2 = {
      id: null,
      name: 'Test Student 2', 
      center: 'Test Center',
      grade: 'Grade 11',
      phone: '9876543210',
      parent_phone: '1234567890',
      subject: 'Science',
      fees: 60
    };
    
    console.log('Creating Student 1...');
    const result1 = await Database.createStudent(student1);
    console.log('✅ Student 1 created:', result1);
    
    console.log('Creating Student 2...');
    const result2 = await Database.createStudent(student2);
    console.log('✅ Student 2 created:', result2);
    
    // Test 2: Check if both students exist in database
    console.log('\n📊 Test 2: Checking if both students exist...');
    const allStudents = await Database.getAllStudents();
    
    const testStudents = allStudents.filter(s => 
      s.name === 'Test Student 1' || s.name === 'Test Student 2'
    );
    
    console.log(`Found ${testStudents.length} test students:`);
    testStudents.forEach((student, index) => {
      console.log(`  ${index + 1}. ID: ${student.id}, Name: ${student.name}, Center: ${student.center}`);
    });
    
    // Test 3: Create entry registrations for both students
    console.log('\n📝 Test 3: Creating entry registrations...');
    
    const registration1 = {
      student_id: null,
      student_name: 'Test Student 1',
      center: 'Test Center',
      grade: 'Grade 10',
      phone: '1234567890',
      parent_phone: '0987654321',
      subject: 'Math',
      fees: 50,
      payment_amount: 50,
      device_name: 'test_device',
      entry_method: 'manual'
    };
    
    const registration2 = {
      student_id: null,
      student_name: 'Test Student 2',
      center: 'Test Center', 
      grade: 'Grade 11',
      phone: '9876543210',
      parent_phone: '1234567890',
      subject: 'Science',
      fees: 60,
      payment_amount: 60,
      device_name: 'test_device',
      entry_method: 'manual'
    };
    
    console.log('Creating Registration 1...');
    const regResult1 = await Database.createEntryRegistration(registration1);
    console.log('✅ Registration 1 created:', regResult1);
    
    console.log('Creating Registration 2...');
    const regResult2 = await Database.createEntryRegistration(registration2);
    console.log('✅ Registration 2 created:', regResult2);
    
    // Test 4: Verify both registrations exist
    console.log('\n📊 Test 4: Checking registrations...');
    const allRegistrations = await Database.getAllEntryRegistrations();
    const testRegistrations = allRegistrations.filter(r => 
      r.student_name === 'Test Student 1' || r.student_name === 'Test Student 2'
    );
    
    console.log(`Found ${testRegistrations.length} test registrations:`);
    testRegistrations.forEach((reg, index) => {
      console.log(`  ${index + 1}. ID: ${reg.student_id}, Name: ${reg.student_name}, Center: ${reg.center}`);
    });
    
    // Results
    console.log('\n🎯 TEST RESULTS:');
    if (testStudents.length === 2) {
      console.log('✅ SUCCESS: Both students created with unique IDs');
    } else {
      console.log('❌ FAILED: Students overwrote each other');
    }
    
    if (testRegistrations.length === 2) {
      console.log('✅ SUCCESS: Both registrations created with unique IDs');
    } else {
      console.log('❌ FAILED: Registrations overwrote each other');
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    for (const student of testStudents) {
      try {
        await Database.deleteStudent(student.id);
        console.log(`Deleted student: ${student.name}`);
      } catch (error) {
        console.log(`Could not delete student ${student.name}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testNullIdOverwrite().then(() => {
  console.log('\n🏁 Test script finished');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test script crashed:', error);
  process.exit(1);
});
