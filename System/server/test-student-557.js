#!/usr/bin/env node

/**
 * Test script to verify student ID 557 data retrieval and enhancement
 * This script tests the enhanced student data system
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3000';

async function testStudentData() {
  console.log('🧪 Testing Enhanced Student Data System for ID 557');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Get student data directly
    console.log('\n📋 Test 1: Getting student data for ID 557');
    const studentData = await makeRequest(`/api/student/557`);
    console.log('✅ Student Data Retrieved:', JSON.stringify(studentData, null, 2));
    
    // Test 2: Validate student data
    console.log('\n🔍 Test 2: Validating student data completeness');
    const validation = await makeRequest(`/api/validate-student-data`, 'POST', {
      studentId: '557'
    });
    console.log('✅ Validation Result:', JSON.stringify(validation, null, 2));
    
    // Test 3: Refresh student data
    console.log('\n🔄 Test 3: Refreshing student data');
    const refresh = await makeRequest(`/api/refresh-student-data`, 'POST', {
      studentId: '557'
    });
    console.log('✅ Refresh Result:', JSON.stringify(refresh, null, 2));
    
    // Test 4: Check data flow monitoring
    console.log('\n📊 Test 4: Checking data flow monitoring');
    const flowMonitor = await makeRequest(`/api/data-flow-monitor`);
    console.log('✅ Flow Monitor:', JSON.stringify(flowMonitor, null, 2));
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`   - Student ID: ${studentData.studentData?.id || 'N/A'}`);
    console.log(`   - Name: ${studentData.studentData?.name || 'N/A'}`);
    console.log(`   - Center: ${studentData.studentData?.center || 'N/A'}`);
    console.log(`   - Subject: ${studentData.studentData?.subject || 'N/A'}`);
    console.log(`   - Grade: ${studentData.studentData?.grade || 'N/A'}`);
    console.log(`   - Complete Data: ${studentData.hasCompleteData ? '✅ Yes' : '❌ No'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.success === false) {
            reject(new Error(parsed.error || 'Request failed'));
          } else {
            resolve(parsed);
          }
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Run the test
if (require.main === module) {
  testStudentData().catch(console.error);
}

module.exports = { testStudentData };
