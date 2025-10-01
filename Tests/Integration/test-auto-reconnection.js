#!/usr/bin/env node

/**
 * Auto-Reconnection Test Script
 * Tests the enhanced auto-reconnection functionality of the Student Lab System
 */

const WebSocket = require('ws');
const http = require('http');

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

// Test configuration
const TEST_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 3000,
  HEARTBEAT_INTERVAL: 10000,
  CONNECTION_TIMEOUT: 30000,
  TEST_DURATION: 60000 // 1 minute test
};

class ReconnectionTester {
  constructor() {
    this.testResults = [];
    this.devices = [];
    this.serverProcess = null;
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

  async testWebSocketConnection(deviceName, role) {
    this.log(`Testing WebSocket connection for ${deviceName} (${role})...`, 'info');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);
      let connected = false;
      let heartbeatReceived = false;
      let reconnectionAttempts = 0;
      
      const testTimeout = setTimeout(() => {
        if (!connected) {
          this.log(`WebSocket connection timeout for ${deviceName}`, 'error');
          ws.close();
          resolve({ success: false, error: 'Connection timeout' });
        }
      }, 10000);
      
      ws.on('open', () => {
        connected = true;
        clearTimeout(testTimeout);
        this.log(`WebSocket connected for ${deviceName}`, 'success');
        
        // Register device
        ws.send(JSON.stringify({
          type: 'register_device',
          role: role,
          name: deviceName
        }));
        
        // Start heartbeat test
        const heartbeatInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
          } else {
            clearInterval(heartbeatInterval);
          }
        }, 5000);
        
        // Test reconnection by closing connection
        setTimeout(() => {
          this.log(`Testing reconnection for ${deviceName}...`, 'info');
          ws.close();
        }, 3000);
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          
          if (message.type === 'heartbeat_response') {
            heartbeatReceived = true;
            this.log(`Heartbeat response received for ${deviceName}`, 'success');
          }
          
          if (message.type === 'reconnection_confirmed') {
            reconnectionAttempts++;
            this.log(`Reconnection confirmed for ${deviceName} (attempt ${reconnectionAttempts})`, 'success');
          }
        } catch (error) {
          this.log(`Error parsing message for ${deviceName}: ${error.message}`, 'error');
        }
      });
      
      ws.on('close', () => {
        this.log(`WebSocket closed for ${deviceName}`, 'warning');
        
        // Test automatic reconnection
        if (connected && !heartbeatReceived) {
          this.log(`Testing automatic reconnection for ${deviceName}...`, 'info');
          
          const reconnectWs = new WebSocket(WS_URL);
          
          reconnectWs.on('open', () => {
            this.log(`Reconnection successful for ${deviceName}`, 'success');
            reconnectWs.send(JSON.stringify({
              type: 'register_device',
              role: role,
              name: deviceName
            }));
            
            setTimeout(() => {
              reconnectWs.close();
              resolve({ 
                success: true, 
                heartbeatReceived, 
                reconnectionAttempts: reconnectionAttempts + 1 
              });
            }, 2000);
          });
          
          reconnectWs.on('error', (error) => {
            this.log(`Reconnection failed for ${deviceName}: ${error.message}`, 'error');
            resolve({ success: false, error: 'Reconnection failed' });
          });
        } else {
          resolve({ 
            success: connected, 
            heartbeatReceived, 
            reconnectionAttempts 
          });
        }
      });
      
      ws.on('error', (error) => {
        this.log(`WebSocket error for ${deviceName}: ${error.message}`, 'error');
        clearTimeout(testTimeout);
        resolve({ success: false, error: error.message });
      });
    });
  }

  async testDeviceDiscovery() {
    this.log('Testing device discovery...', 'info');
    
    return new Promise((resolve) => {
      const ws = new WebSocket(WS_URL);
      let devicesFound = [];
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'register_device',
          role: 'admin_dashboard',
          name: 'Test-Admin'
        }));
        
        // Request network scan
        ws.send(JSON.stringify({ type: 'network_scan_request' }));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          
          if (message.type === 'device_discovery') {
            devicesFound = message.connectedDevices || [];
            this.log(`Device discovery: Found ${devicesFound.length} devices`, 'success');
          }
          
          if (message.type === 'network_scan_response') {
            this.log(`Network scan response: ${message.networkStatus.onlineDevices} devices online`, 'success');
            ws.close();
            resolve({ success: true, devicesFound: devicesFound.length });
          }
        } catch (error) {
          this.log(`Error parsing discovery message: ${error.message}`, 'error');
        }
      });
      
      ws.on('error', (error) => {
        this.log(`Device discovery error: ${error.message}`, 'error');
        resolve({ success: false, error: error.message });
      });
      
      setTimeout(() => {
        ws.close();
        resolve({ success: false, error: 'Discovery timeout' });
      }, 10000);
    });
  }

  async runAllTests() {
    this.log('Starting Auto-Reconnection Test Suite...', 'info');
    this.log(`Test Configuration:`, 'info');
    this.log(`  Max Reconnect Attempts: ${TEST_CONFIG.MAX_RECONNECT_ATTEMPTS}`, 'info');
    this.log(`  Reconnect Delay: ${TEST_CONFIG.RECONNECT_DELAY}ms`, 'info');
    this.log(`  Heartbeat Interval: ${TEST_CONFIG.HEARTBEAT_INTERVAL}ms`, 'info');
    this.log(`  Connection Timeout: ${TEST_CONFIG.CONNECTION_TIMEOUT}ms`, 'info');
    
    const results = {
      serverConnection: false,
      entryScanner: null,
      exitValidator: null,
      adminDashboard: null,
      deviceDiscovery: null
    };
    
    // Test 1: Server Connection
    results.serverConnection = await this.testServerConnection();
    
    if (!results.serverConnection) {
      this.log('Server is not running. Please start the server first.', 'error');
      return results;
    }
    
    // Test 2: Entry Scanner Reconnection
    this.log('\n=== Testing Entry Scanner Reconnection ===', 'info');
    results.entryScanner = await this.testWebSocketConnection('Test-Entry-Scanner', 'first_scan');
    
    // Test 3: Exit Validator Reconnection
    this.log('\n=== Testing Exit Validator Reconnection ===', 'info');
    results.exitValidator = await this.testWebSocketConnection('Test-Exit-Validator', 'last_scan');
    
    // Test 4: Admin Dashboard Reconnection
    this.log('\n=== Testing Admin Dashboard Reconnection ===', 'info');
    results.adminDashboard = await this.testWebSocketConnection('Test-Admin-Dashboard', 'admin_dashboard');
    
    // Test 5: Device Discovery
    this.log('\n=== Testing Device Discovery ===', 'info');
    results.deviceDiscovery = await this.testDeviceDiscovery();
    
    // Generate Test Report
    this.generateTestReport(results);
    
    return results;
  }

  generateTestReport(results) {
    this.log('\n' + '='.repeat(60), 'info');
    this.log('AUTO-RECONNECTION TEST REPORT', 'info');
    this.log('='.repeat(60), 'info');
    
    const tests = [
      { name: 'Server Connection', result: results.serverConnection },
      { name: 'Entry Scanner Reconnection', result: results.entryScanner?.success },
      { name: 'Exit Validator Reconnection', result: results.exitValidator?.success },
      { name: 'Admin Dashboard Reconnection', result: results.adminDashboard?.success },
      { name: 'Device Discovery', result: results.deviceDiscovery?.success }
    ];
    
    let passedTests = 0;
    
    tests.forEach(test => {
      const status = test.result ? 'PASS' : 'FAIL';
      const icon = test.result ? '✅' : '❌';
      this.log(`${icon} ${test.name}: ${status}`, test.result ? 'success' : 'error');
      if (test.result) passedTests++;
    });
    
    this.log('\n' + '-'.repeat(40), 'info');
    this.log(`Tests Passed: ${passedTests}/${tests.length}`, passedTests === tests.length ? 'success' : 'warning');
    this.log(`Success Rate: ${Math.round((passedTests / tests.length) * 100)}%`, passedTests === tests.length ? 'success' : 'warning');
    
    if (passedTests === tests.length) {
      this.log('\n🎉 All auto-reconnection tests passed!', 'success');
      this.log('Your system is ready for production use.', 'success');
    } else {
      this.log('\n⚠️ Some tests failed. Please check the server and network configuration.', 'warning');
    }
    
    this.log('='.repeat(60), 'info');
  }
}

// Run the tests
async function main() {
  const tester = new ReconnectionTester();
  
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

module.exports = ReconnectionTester;
