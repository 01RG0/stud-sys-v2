#!/usr/bin/env node

/**
 * Quick test script to verify student 557 data is working
 */

const http = require('http');

async function testStudent(studentId = '557') {
  console.log(`🧪 Testing Student ${studentId} Data Fix`);
  console.log('=' .repeat(40));
  
  try {
    // Test the new endpoint
    console.log(`\n📋 Testing /api/test-student/${studentId} endpoint...`);
    const response = await makeRequest(`/api/test-student/${studentId}`);
    
    console.log('✅ Response:', JSON.stringify(response, null, 2));
    
    if (response.success && response.studentData) {
      const data = response.studentData;
      console.log(`\n🎯 Student ${studentId} Data:`);
      console.log(`   ID: ${data.id}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Center: ${data.center}`);
      console.log(`   Subject: ${data.subject}`);
      console.log(`   Grade: ${data.grade}`);
      console.log(`   Complete: ${response.hasCompleteData ? '✅' : '❌'}`);
      
      if (data.center && data.subject && data.grade) {
        console.log(`\n🎉 SUCCESS! Student ${studentId} data is working correctly!`);
      } else {
        console.log(`\n❌ FAILED! Student ${studentId} data is still incomplete.`);
      }
    } else {
      console.log('\n❌ FAILED! No student data returned.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
    
    req.end();
  });
}

// Run the test
testStudent557().catch(console.error);
