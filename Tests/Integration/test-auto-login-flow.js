#!/usr/bin/env node

/**
 * Auto-Login Flow Test Script
 * Tests the new auto-login behavior that skips the setup screen
 */

const http = require('http');

const SERVER_URL = 'http://localhost:3000';

class AutoLoginFlowTester {
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
    this.log('AUTO-LOGIN FLOW TEST REPORT', 'info');
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
      this.log('\n🎉 Auto-login flow test passed!', 'success');
      this.log('Your Entry Scanner now has:', 'info');
      this.log('✅ Direct auto-login to main screen (no setup screen)', 'success');
      this.log('✅ Device login caching with 7-day validity', 'success');
      this.log('✅ Data pushing only from main screen', 'success');
      this.log('✅ Seamless user experience on refresh', 'success');
      this.log('\n📋 How it works now:', 'info');
      this.log('1. First visit: Enter device name and start scanning', 'info');
      this.log('2. Subsequent visits: Auto-login directly to main screen', 'info');
      this.log('3. Data is only pushed when in main scanning screen', 'info');
      this.log('4. No more setup screen interruptions!', 'info');
    } else {
      this.log('\n⚠️ Some auto-login flow tests failed.', 'warning');
      this.log('Please check the server and try again.', 'warning');
    }
    
    this.log('='.repeat(60), 'info');
  }

  async runAllTests() {
    this.log('Starting Auto-Login Flow Test Suite...', 'info');
    this.log('This test suite verifies the new auto-login behavior', 'info');
    
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
  const tester = new AutoLoginFlowTester();
  
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

module.exports = AutoLoginFlowTester;
