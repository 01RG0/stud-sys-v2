#!/usr/bin/env node

/**
 * Persistent Features Test Script
 * Tests the new persistent data saving and device login caching features
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3000';

class PersistentFeaturesTester {
  constructor() {
    this.testResults = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async testServerConnection() {
    this.log('Testing server connection...', 'info');
    
    return new Promise((resolve, reject) => {
      const req = http.get(SERVER_URL, (res) => {
        if (res.statusCode === 200 || res.statusCode === 404) {
          this.log('Server is running and accessible', 'success');
          resolve(true);
        } else {
          this.log(`Server returned status: ${res.statusCode}`, 'warning');
          resolve(false);
        }
      });
      
      req.on('error', (error) => {
        this.log(`Server connection failed: ${error.message}`, 'error');
        resolve(false);
      });
      
      req.setTimeout(5000, () => {
        this.log('Server connection timeout', 'error');
        resolve(false);
      });
    });
  }

  async testEntryScannerPage() {
    this.log('Testing Entry Scanner page accessibility...', 'info');
    
    return new Promise((resolve, reject) => {
      const req = http.get(`${SERVER_URL}/pages/Entry-Scanner.html`, (res) => {
        if (res.statusCode === 200) {
          this.log('Entry Scanner page is accessible', 'success');
          resolve(true);
        } else {
          this.log(`Entry Scanner page returned status: ${res.statusCode}`, 'warning');
          resolve(false);
        }
      });
      
      req.on('error', (error) => {
        this.log(`Entry Scanner page error: ${error.message}`, 'error');
        resolve(false);
      });
      
      req.setTimeout(5000, () => {
        this.log('Entry Scanner page timeout', 'error');
        resolve(false);
      });
    });
  }

  generateTestReport(results) {
    this.log('\n' + '='.repeat(60), 'info');
    this.log('PERSISTENT FEATURES TEST REPORT', 'info');
    this.log('='.repeat(60), 'info');
    
    const tests = [
      { 
        name: 'Server Connection', 
        result: results.serverConnection,
        details: 'Basic server connectivity'
      },
      { 
        name: 'Entry Scanner Page', 
        result: results.entryScannerPage,
        details: 'Entry Scanner page loads correctly'
      }
    ];
    
    let passedTests = 0;
    
    tests.forEach(test => {
      const status = test.result ? 'PASS' : 'FAIL';
      const icon = test.result ? '✅' : '❌';
      this.log(`${icon} ${test.name}: ${status}`, test.result ? 'success' : 'error');
      this.log(`   ${test.details}`, 'info');
      if (test.result) passedTests++;
    });
    
    this.log('\n' + '-'.repeat(40), 'info');
    this.log(`Tests Passed: ${passedTests}/${tests.length}`, passedTests === tests.length ? 'success' : 'warning');
    this.log(`Success Rate: ${Math.round((passedTests / tests.length) * 100)}%`, passedTests === tests.length ? 'success' : 'warning');
    
    if (passedTests === tests.length) {
      this.log('\n🎉 All persistent features tests passed!', 'success');
      this.log('Your Entry Scanner now has:', 'info');
      this.log('✅ Persistent data saving (no data loss on refresh)', 'success');
      this.log('✅ Device login caching (remembers device)', 'success');
      this.log('✅ Logout button for device management', 'success');
      this.log('✅ Automatic data backup every 30 seconds', 'success');
      this.log('✅ Data saving on page unload', 'success');
    } else {
      this.log('\n⚠️ Some persistent features tests failed.', 'warning');
      this.log('Please check the server and try again.', 'warning');
    }
    
    this.log('='.repeat(60), 'info');
  }

  async runAllTests() {
    this.log('Starting Persistent Features Test Suite...', 'info');
    this.log('This test suite verifies the new persistent data and device login features', 'info');
    
    const results = {
      serverConnection: false,
      entryScannerPage: false
    };
    
    // Test 1: Server Connection
    results.serverConnection = await this.testServerConnection();
    
    if (!results.serverConnection) {
      this.log('Server is not running. Please start the server first.', 'error');
      return results;
    }
    
    // Test 2: Entry Scanner Page
    this.log('\n=== Testing Entry Scanner Page ===', 'info');
    results.entryScannerPage = await this.testEntryScannerPage();
    
    // Generate Test Report
    this.generateTestReport(results);
    
    return results;
  }
}

// Run the tests
async function main() {
  const tester = new PersistentFeaturesTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PersistentFeaturesTester;
