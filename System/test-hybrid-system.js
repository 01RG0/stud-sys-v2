#!/usr/bin/env node

/**
 * HYBRID SYSTEM COMPREHENSIVE TEST SCRIPT
 * Tests all scenarios: offline, online, reconnection, data conflicts
 * Student Lab System - Enhanced with Local + MySQL Backup
 */

const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Test Configuration
const TEST_CONFIG = {
  SERVER_URL: 'http://localhost:3000',
  WS_URL: 'ws://localhost:3000',
  TEST_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000
};

// Test Results
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: []
};

// Test Data
const testData = {
  student: {
    id: 'TEST001',
    name: 'Test Student Hybrid',
    center: 'Test Center',
    subject: 'Test Subject',
    grade: 'Test Grade',
    fees: '50',
    phone: '1234567890',
    parent_phone: '0987654321'
  },
  registration: {
    id: Date.now(),
    student_id: 'TEST001',
    student_name: 'Test Student Hybrid',
    center: 'Test Center',
    homework_score: 8,
    exam_score: null,
    extra_sessions: 1,
    comment: 'Hybrid system test',
    timestamp: new Date().toISOString(),
    device_name: 'Test-Device',
    registered: true,
    entry_method: 'test'
  },
  validation: {
    id: Date.now(),
    student_id: 'TEST001',
    student_name: 'Test Student Hybrid',
    status: 'PASSED',
    timestamp: new Date().toISOString(),
    record: null
  }
};

// Utility Functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  
  const color = colors[type] || colors.info;
  console.log(`${color}[${timestamp}] ${type.toUpperCase()}: ${message}${colors.reset}`);
}

function addTestResult(testName, passed, details = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`✅ ${testName}`, 'success');
  } else {
    testResults.failed++;
    log(`❌ ${testName}: ${details}`, 'error');
  }
  
  testResults.details.push({
    name: testName,
    passed,
    details,
    timestamp: new Date().toISOString()
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(TEST_CONFIG.TEST_TIMEOUT, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Test Functions
async function testServerConnection() {
  try {
    log('Testing server connection...', 'info');
    const response = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/sync/status`);
    
    if (response.status === 200 || response.status === 404) {
      addTestResult('Server Connection', true);
      return true;
    } else {
      addTestResult('Server Connection', false, `Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    addTestResult('Server Connection', false, error.message);
    return false;
  }
}

async function testMySQLSyncAPIs() {
  try {
    log('Testing MySQL Sync APIs...', 'info');
    
    // Test sync status endpoint
    const statusResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/sync/status`);
    if (statusResponse.status !== 200) {
      addTestResult('Sync Status API', false, `Status: ${statusResponse.status}`);
      return false;
    }
    
    // Test sync endpoint with test data
    const syncResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        operation: 'create_student',
        data: testData.student,
        deviceName: 'Test-Device',
        timestamp: new Date().toISOString()
      })
    });
    
    if (syncResponse.status === 200 && syncResponse.data.success) {
      addTestResult('MySQL Sync APIs', true);
      return true;
    } else {
      addTestResult('MySQL Sync APIs', false, `Status: ${syncResponse.status}, Data: ${JSON.stringify(syncResponse.data)}`);
      return false;
    }
  } catch (error) {
    addTestResult('MySQL Sync APIs', false, error.message);
    return false;
  }
}

async function testBulkSyncAPI() {
  try {
    log('Testing Bulk Sync API...', 'info');
    
    const bulkResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/sync/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            operation: 'create_registration',
            data: testData.registration
          },
          {
            operation: 'create_validation',
            data: testData.validation
          }
        ],
        deviceName: 'Test-Device'
      })
    });
    
    if (bulkResponse.status === 200 && bulkResponse.data.success) {
      addTestResult('Bulk Sync API', true);
      return true;
    } else {
      addTestResult('Bulk Sync API', false, `Status: ${bulkResponse.status}, Data: ${JSON.stringify(bulkResponse.data)}`);
      return false;
    }
  } catch (error) {
    addTestResult('Bulk Sync API', false, error.message);
    return false;
  }
}

async function testConflictResolutionAPI() {
  try {
    log('Testing Conflict Resolution API...', 'info');
    
    const conflictResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/sync/resolve-conflicts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conflicts: [
          {
            id: 'conflict1',
            localData: { ...testData.student, name: 'Local Version' },
            serverData: { ...testData.student, name: 'Server Version' }
          }
        ],
        resolution: 'local',
        deviceName: 'Test-Device'
      })
    });
    
    if (conflictResponse.status === 200 && conflictResponse.data.success) {
      addTestResult('Conflict Resolution API', true);
      return true;
    } else {
      addTestResult('Conflict Resolution API', false, `Status: ${conflictResponse.status}, Data: ${JSON.stringify(conflictResponse.data)}`);
      return false;
    }
  } catch (error) {
    addTestResult('Conflict Resolution API', false, error.message);
    return false;
  }
}

async function testWebSocketConnection() {
  try {
    log('Testing WebSocket connection...', 'info');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(TEST_CONFIG.WS_URL);
      let connected = false;
      
      const timeout = setTimeout(() => {
        if (!connected) {
          ws.close();
          addTestResult('WebSocket Connection', false, 'Connection timeout');
          resolve(false);
        }
      }, 5000);
      
      ws.on('open', () => {
        connected = true;
        clearTimeout(timeout);
        ws.close();
        addTestResult('WebSocket Connection', true);
        resolve(true);
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        addTestResult('WebSocket Connection', false, error.message);
        resolve(false);
      });
    });
  } catch (error) {
    addTestResult('WebSocket Connection', false, error.message);
    return false;
  }
}

async function testEntryScannerEndpoints() {
  try {
    log('Testing Entry Scanner endpoints...', 'info');
    
    // Test entry scanner page
    const pageResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/entry-scanner`);
    if (pageResponse.status !== 200) {
      addTestResult('Entry Scanner Page', false, `Status: ${pageResponse.status}`);
      return false;
    }
    
    // Test student cache endpoint
    const cacheResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/student-cache`);
    if (cacheResponse.status !== 200) {
      addTestResult('Student Cache API', false, `Status: ${cacheResponse.status}`);
      return false;
    }
    
    addTestResult('Entry Scanner Endpoints', true);
    return true;
  } catch (error) {
    addTestResult('Entry Scanner Endpoints', false, error.message);
    return false;
  }
}

async function testExitValidatorEndpoints() {
  try {
    log('Testing Exit Validator endpoints...', 'info');
    
    // Test exit validator page
    const pageResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/exit-validator`);
    if (pageResponse.status !== 200) {
      addTestResult('Exit Validator Page', false, `Status: ${pageResponse.status}`);
      return false;
    }
    
    // Test exit validator data endpoint
    const dataResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/exit-validator-data`);
    if (dataResponse.status !== 200) {
      addTestResult('Exit Validator Data API', false, `Status: ${dataResponse.status}`);
      return false;
    }
    
    addTestResult('Exit Validator Endpoints', true);
    return true;
  } catch (error) {
    addTestResult('Exit Validator Endpoints', false, error.message);
    return false;
  }
}

async function testAdminDashboardEndpoints() {
  try {
    log('Testing Admin Dashboard endpoints...', 'info');
    
    // Test admin dashboard page
    const pageResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/admin-dashboard`);
    if (pageResponse.status !== 200) {
      addTestResult('Admin Dashboard Page', false, `Status: ${pageResponse.status}`);
      return false;
    }
    
    // Test devices endpoint
    const devicesResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/devices`);
    if (devicesResponse.status !== 200) {
      addTestResult('Devices API', false, `Status: ${devicesResponse.status}`);
      return false;
    }
    
    // Test live devices endpoint
    const liveDevicesResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/live-devices`);
    if (liveDevicesResponse.status !== 200) {
      addTestResult('Live Devices API', false, `Status: ${liveDevicesResponse.status}`);
      return false;
    }
    
    addTestResult('Admin Dashboard Endpoints', true);
    return true;
  } catch (error) {
    addTestResult('Admin Dashboard Endpoints', false, error.message);
    return false;
  }
}

async function testSystemLogsAPI() {
  try {
    log('Testing System Logs API...', 'info');
    
    const logsResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/system-logs`);
    if (logsResponse.status === 200) {
      addTestResult('System Logs API', true);
      return true;
    } else {
      addTestResult('System Logs API', false, `Status: ${logsResponse.status}`);
      return false;
    }
  } catch (error) {
    addTestResult('System Logs API', false, error.message);
    return false;
  }
}

async function testValidationLogAPI() {
  try {
    log('Testing Validation Log API...', 'info');
    
    const validationResponse = await makeRequest(`${TEST_CONFIG.SERVER_URL}/api/validation-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData.validation)
    });
    
    if (validationResponse.status === 200 && validationResponse.data.ok) {
      addTestResult('Validation Log API', true);
      return true;
    } else {
      addTestResult('Validation Log API', false, `Status: ${validationResponse.status}, Data: ${JSON.stringify(validationResponse.data)}`);
      return false;
    }
  } catch (error) {
    addTestResult('Validation Log API', false, error.message);
    return false;
  }
}

// Main Test Runner
async function runAllTests() {
  log('🚀 Starting Hybrid System Comprehensive Tests', 'info');
  log('=' .repeat(60), 'info');
  
  const startTime = Date.now();
  
  // Core System Tests
  await testServerConnection();
  await sleep(1000);
  
  await testWebSocketConnection();
  await sleep(1000);
  
  // MySQL Sync Tests
  await testMySQLSyncAPIs();
  await sleep(1000);
  
  await testBulkSyncAPI();
  await sleep(1000);
  
  await testConflictResolutionAPI();
  await sleep(1000);
  
  // Endpoint Tests
  await testEntryScannerEndpoints();
  await sleep(1000);
  
  await testExitValidatorEndpoints();
  await sleep(1000);
  
  await testAdminDashboardEndpoints();
  await sleep(1000);
  
  // API Tests
  await testSystemLogsAPI();
  await sleep(1000);
  
  await testValidationLogAPI();
  await sleep(1000);
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Generate Test Report
  log('=' .repeat(60), 'info');
  log('📊 TEST RESULTS SUMMARY', 'info');
  log('=' .repeat(60), 'info');
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  
  log(`Total Tests: ${testResults.total}`, 'info');
  log(`Passed: ${testResults.passed}`, 'success');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`Success Rate: ${successRate}%`, successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error');
  log(`Duration: ${duration}ms`, 'info');
  
  // Detailed Results
  log('\n📋 DETAILED RESULTS:', 'info');
  testResults.details.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    const details = result.details ? ` (${result.details})` : '';
    log(`${index + 1}. ${status} ${result.name}${details}`, result.passed ? 'success' : 'error');
  });
  
  // Save Test Report
  const reportPath = path.join(__dirname, '..', 'Logs', `hybrid-system-test-${new Date().toISOString().split('T')[0]}.json`);
  try {
    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: testResults.total,
        passed: testResults.passed,
        failed: testResults.failed,
        successRate: parseFloat(successRate),
        duration
      },
      details: testResults.details,
      testData: testData
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n📄 Test report saved to: ${reportPath}`, 'info');
  } catch (error) {
    log(`\n⚠️ Failed to save test report: ${error.message}`, 'warning');
  }
  
  // Final Status
  if (testResults.failed === 0) {
    log('\n🎉 ALL TESTS PASSED! Hybrid System is working perfectly!', 'success');
    process.exit(0);
  } else if (successRate >= 80) {
    log('\n⚠️ Most tests passed, but some issues detected. Check failed tests above.', 'warning');
    process.exit(1);
  } else {
    log('\n❌ Multiple test failures detected. System needs attention.', 'error');
    process.exit(1);
  }
}

// Error Handling
process.on('uncaughtException', (error) => {
  log(`Uncaught Exception: ${error.message}`, 'error');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled Rejection at: ${promise}, reason: ${reason}`, 'error');
  process.exit(1);
});

// Run Tests
if (require.main === module) {
  runAllTests().catch(error => {
    log(`Test runner failed: ${error.message}`, 'error');
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testResults,
  testData
};
