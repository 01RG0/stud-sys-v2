const { initializeDatabase, Database } = require('./server/database');

async function testMySQLIntegration() {
  console.log('🧪 Testing MySQL Integration...\n');
  
  let testsPassed = 0;
  let totalTests = 0;
  
  // Test 1: Database initialization
  totalTests++;
  try {
    console.log('1. Testing database initialization...');
    const initialized = await initializeDatabase();
    if (initialized) {
      console.log('   ✅ Database initialized successfully');
      testsPassed++;
    } else {
      console.log('   ❌ Database initialization failed');
    }
  } catch (error) {
    console.log(`   ❌ Database initialization error: ${error.message}`);
  }
  
  // Test 2: Create a test student
  totalTests++;
  try {
    console.log('2. Testing student creation...');
    const testStudent = {
      id: 'TEST001',
      name: 'Test Student',
      class: '10',
      section: 'A',
      roll_number: '001',
      phone: '1234567890',
      parent_phone: '0987654321',
      address: 'Test Address'
    };
    
    await Database.createStudent(testStudent);
    console.log('   ✅ Student created successfully');
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ Student creation error: ${error.message}`);
  }
  
  // Test 3: Get all students
  totalTests++;
  try {
    console.log('3. Testing get all students...');
    const students = await Database.getAllStudents();
    console.log(`   ✅ Retrieved ${students.length} students`);
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ Get students error: ${error.message}`);
  }
  
  // Test 4: Create a test registration
  totalTests++;
  try {
    console.log('4. Testing registration creation...');
    const testRegistration = {
      student_id: 'TEST001',
      student_name: 'Test Student',
      class: '10',
      section: 'A',
      roll_number: '001',
      device_name: 'Test Device',
      homework_score: 85,
      exam_score: 90,
      timestamp: new Date().toISOString()
    };
    
    await Database.createEntryRegistration(testRegistration);
    console.log('   ✅ Registration created successfully');
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ Registration creation error: ${error.message}`);
  }
  
  // Test 5: Get today's registrations
  totalTests++;
  try {
    console.log('5. Testing get today\'s registrations...');
    const today = new Date().toISOString().split('T')[0];
    const registrations = await Database.getEntryRegistrationsByDate(today);
    console.log(`   ✅ Retrieved ${registrations.length} registrations for today`);
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ Get registrations error: ${error.message}`);
  }
  
  // Test 6: Create a test validation
  totalTests++;
  try {
    console.log('6. Testing validation creation...');
    const testValidation = {
      student_id: 'TEST001',
      student_name: 'Test Student',
      status: 'validated',
      timestamp: new Date().toISOString()
    };
    
    await Database.createExitValidation(testValidation);
    console.log('   ✅ Validation created successfully');
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ Validation creation error: ${error.message}`);
  }
  
  // Test 7: Get today's validations
  totalTests++;
  try {
    console.log('7. Testing get today\'s validations...');
    const today = new Date().toISOString().split('T')[0];
    const validations = await Database.getExitValidationsByDate(today);
    console.log(`   ✅ Retrieved ${validations.length} validations for today`);
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ Get validations error: ${error.message}`);
  }
  
  // Clean up test data
  try {
    console.log('\n🧹 Cleaning up test data...');
    await Database.deleteStudent('TEST001');
    console.log('   ✅ Test data cleaned up');
  } catch (error) {
    console.log(`   ⚠️ Cleanup warning: ${error.message}`);
  }
  
  // Test Results
  console.log('\n📊 Test Results:');
  console.log(`   Tests Passed: ${testsPassed}/${totalTests}`);
  console.log(`   Success Rate: ${((testsPassed / totalTests) * 100).toFixed(1)}%`);
  
  if (testsPassed === totalTests) {
    console.log('\n🎉 All MySQL integration tests passed!');
    console.log('   The system is ready to use MySQL database.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check your MySQL configuration.');
    console.log('   Make sure MySQL is running and the database is properly configured.');
  }
  
  process.exit(testsPassed === totalTests ? 0 : 1);
}

// Run the tests
testMySQLIntegration().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
