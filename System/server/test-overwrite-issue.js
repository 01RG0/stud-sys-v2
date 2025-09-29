const { Database } = require('./database.js');

async function testOverwriteIssue() {
  console.log('🧪 Testing Overwrite Issue with Empty String IDs...\n');
  
  try {
    // Test: Create two students with empty string IDs
    console.log('📝 Creating two students with empty string IDs...');
    
    const student1 = {
      id: '',  // Empty string
      name: 'Ahmed',
      center: 'Test Center',
      grade: 'Grade 10',
      phone: '1234567890',
      parent_phone: '0987654321',
      subject: 'Math',
      fees: 50
    };
    
    const student2 = {
      id: '',  // Empty string (same as student1)
      name: 'Mohamed',
      center: 'Test Center',
      grade: 'Grade 11',
      phone: '9876543210',
      parent_phone: '1234567890',
      subject: 'Science',
      fees: 60
    };
    
    console.log('Creating Student 1 (Ahmed)...');
    const result1 = await Database.createStudent(student1);
    console.log('✅ Student 1 created:', result1);
    
    console.log('Creating Student 2 (Mohamed)...');
    const result2 = await Database.createStudent(student2);
    console.log('✅ Student 2 created:', result2);
    
    // Check what's in the database
    console.log('\n📊 Checking database contents...');
    const allStudents = await Database.getAllStudents();
    
    const testStudents = allStudents.filter(s => 
      s.name === 'Ahmed' || s.name === 'Mohamed'
    );
    
    console.log(`Found ${testStudents.length} test students:`);
    testStudents.forEach((student, index) => {
      console.log(`  ${index + 1}. ID: "${student.id}" (length: ${student.id.length}), Name: ${student.name}, Center: ${student.center}`);
    });
    
    // Results
    console.log('\n🎯 TEST RESULTS:');
    if (testStudents.length === 2) {
      console.log('✅ SUCCESS: Both students exist separately');
    } else if (testStudents.length === 1) {
      console.log('❌ FAILED: One student overwrote the other');
      console.log(`Only found: ${testStudents[0].name}`);
    } else {
      console.log('❌ FAILED: No students found');
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
testOverwriteIssue().then(() => {
  console.log('\n🏁 Test script finished');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test script crashed:', error);
  process.exit(1);
});
