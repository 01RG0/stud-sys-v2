(function(){
  // Data Collection Manager - Collects data from any device regardless of connection status
  const WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  let ws = null;
  let devices = {};
  let collectedData = {};
  let isOnline = false;
  let connectionAttempts = 0;
  let maxReconnectAttempts = 5;
  let reconnectDelay = 3000;

  // Initialize the Data Collection Manager
  function init() {
    console.log('🔄 Initializing Data Collection Manager...');
    
    // Setup WebSocket connection
    setupWebSocket();
    
    // Load cached device data
    loadCachedDeviceData();
    
    // Start periodic data collection
    startPeriodicCollection();
    
    // Setup UI event listeners
    setupEventListeners();
    
    console.log('✅ Data Collection Manager initialized');
  }

  // Setup WebSocket connection
  function setupWebSocket() {
    try {
      ws = new WebSocket(WS_URL);
      
      ws.addEventListener('open', () => {
        console.log('📡 Data Collection Manager connected to server');
        isOnline = true;
        connectionAttempts = 0;
        updateConnectionStatus(true);
        
        // Register as data collection manager
        ws.send(JSON.stringify({
          type: 'register_device',
          role: 'data_collection_manager',
          device_name: 'Data Collection Manager',
          capabilities: ['collect_data', 'export_excel', 'offline_access']
        }));
        
        // Request current device list
        requestDeviceList();
      });
      
      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });
      
      ws.addEventListener('close', () => {
        console.log('📡 Data Collection Manager disconnected');
        isOnline = false;
        updateConnectionStatus(false);
        
        // Attempt reconnection
        if (connectionAttempts < maxReconnectAttempts) {
          connectionAttempts++;
          console.log(`🔄 Attempting reconnection ${connectionAttempts}/${maxReconnectAttempts}...`);
          setTimeout(setupWebSocket, reconnectDelay);
        }
      });
      
      ws.addEventListener('error', (error) => {
        console.error('❌ WebSocket error:', error);
        isOnline = false;
        updateConnectionStatus(false);
      });
      
    } catch (error) {
      console.error('❌ Failed to setup WebSocket:', error);
      isOnline = false;
      updateConnectionStatus(false);
    }
  }

  // Handle WebSocket messages
  function handleWebSocketMessage(data) {
    switch (data.type) {
      case 'device_list':
        updateDeviceList(data.devices);
        break;
      case 'device_data':
        handleDeviceData(data);
        break;
      case 'device_status':
        updateDeviceStatus(data);
        break;
      case 'data_collection_response':
        handleDataCollectionResponse(data);
        break;
      case 'system_stats':
        updateSystemStats(data);
        break;
      default:
        console.log('📨 Received message:', data.type);
    }
  }

  // Request device list from server
  function requestDeviceList() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'request_device_list',
        timestamp: Date.now()
      }));
    }
  }

  // Update device list
  function updateDeviceList(deviceList) {
    console.log('📱 Updating device list:', deviceList);
    devices = deviceList;
    renderDeviceGrid();
  }

  // Update device status
  function updateDeviceStatus(data) {
    if (devices[data.device_name]) {
      devices[data.device_name].status = data.status;
      devices[data.device_name].last_seen = data.timestamp;
      renderDeviceGrid();
    }
  }

  // Handle device data response
  function handleDeviceData(data) {
    console.log('📊 Received device data:', data);
    
    if (data.device_name && data.data) {
      collectedData[data.device_name] = {
        ...data.data,
        collected_at: new Date().toISOString(),
        device_type: data.device_type || 'unknown'
      };
      
      // Save to localStorage for offline access
      saveCollectedData();
      
      // Update UI
      updateDeviceCard(data.device_name);
      
      showNotification(`✅ Data collected from ${data.device_name}`, 'success');
    }
  }

  // Handle data collection response
  function handleDataCollectionResponse(data) {
    hideLoading();
    
    if (data.success) {
      showNotification(`✅ Data collection completed for ${data.device_name}`, 'success');
    } else {
      showNotification(`❌ Failed to collect data from ${data.device_name}: ${data.error}`, 'error');
    }
  }

  // Update system stats
  function updateSystemStats(data) {
    // Update system-wide statistics
    console.log('📈 System stats updated:', data);
  }

  // Render device grid
  function renderDeviceGrid() {
    const grid = document.getElementById('device-grid');
    if (!grid) return;
    
    if (Object.keys(devices).length === 0) {
      grid.innerHTML = `
        <div class="no-data">
          <i class="fas fa-search"></i>
          <h3>No Devices Found</h3>
          <p>No devices are currently connected or have been discovered.</p>
          <button class="action-btn btn-collect" onclick="refreshDevices()">
            <i class="fas fa-sync-alt"></i> Refresh Devices
          </button>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = Object.entries(devices).map(([deviceName, device]) => {
      const deviceType = getDeviceType(deviceName);
      const status = device.status || 'unknown';
      const lastSeen = device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never';
      const collectedData = getCollectedData(deviceName);
      
      return `
        <div class="device-card" data-device="${deviceName}">
          <div class="device-header">
            <div class="device-icon ${deviceType}-icon">
              <i class="fas ${getDeviceIcon(deviceType)}"></i>
            </div>
            <div class="device-info">
              <h3>${deviceName}</h3>
              <div class="device-status status-${status}">
                <i class="fas ${getStatusIcon(status)}"></i>
                ${status.toUpperCase()} - Last seen: ${lastSeen}
              </div>
            </div>
          </div>
          
          <div class="device-stats">
            <div class="stat-item">
              <div class="stat-number">${collectedData.students || 0}</div>
              <div class="stat-label">Students</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${collectedData.registrations || 0}</div>
              <div class="stat-label">Registrations</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${collectedData.validations || 0}</div>
              <div class="stat-label">Validations</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${collectedData.last_collected ? 'Yes' : 'No'}</div>
              <div class="stat-label">Data Collected</div>
            </div>
          </div>
          
          <div class="device-actions">
            <button class="action-btn btn-collect" onclick="collectDeviceData('${deviceName}')">
              <i class="fas fa-download"></i> Collect Data
            </button>
            <button class="action-btn btn-export" onclick="exportDeviceData('${deviceName}')" ${collectedData.students ? '' : 'disabled'}>
              <i class="fas fa-file-excel"></i> Export Excel
            </button>
            <button class="action-btn btn-view" onclick="viewDeviceData('${deviceName}')" ${collectedData.students ? '' : 'disabled'}>
              <i class="fas fa-eye"></i> View Data
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Get device type from device name
  function getDeviceType(deviceName) {
    if (deviceName.toLowerCase().includes('entry') || deviceName.toLowerCase().includes('scanner')) {
      return 'entry-scanner';
    } else if (deviceName.toLowerCase().includes('exit') || deviceName.toLowerCase().includes('validator')) {
      return 'exit-validator';
    } else if (deviceName.toLowerCase().includes('admin') || deviceName.toLowerCase().includes('dashboard')) {
      return 'admin-dashboard';
    }
    return 'unknown';
  }

  // Get device icon
  function getDeviceIcon(deviceType) {
    switch (deviceType) {
      case 'entry-scanner': return 'fa-qrcode';
      case 'exit-validator': return 'fa-check-circle';
      case 'admin-dashboard': return 'fa-tachometer-alt';
      default: return 'fa-desktop';
    }
  }

  // Get status icon
  function getStatusIcon(status) {
    switch (status) {
      case 'online': return 'fa-circle';
      case 'offline': return 'fa-circle';
      case 'unknown': return 'fa-question-circle';
      default: return 'fa-circle';
    }
  }

  // Get collected data for device
  function getCollectedData(deviceName) {
    const data = collectedData[deviceName];
    if (!data) {
      return { students: 0, registrations: 0, validations: 0, last_collected: null };
    }
    
    return {
      students: data.students ? Object.keys(data.students).length : 0,
      registrations: data.registrations ? data.registrations.length : 0,
      validations: data.validations ? data.validations.length : 0,
      last_collected: data.collected_at
    };
  }

  // Update device card
  function updateDeviceCard(deviceName) {
    const card = document.querySelector(`[data-device="${deviceName}"]`);
    if (card) {
      // Re-render the specific card
      renderDeviceGrid();
    }
  }

  // Collect data from specific device
  function collectDeviceData(deviceName) {
    console.log(`📊 Collecting data from ${deviceName}...`);
    
    showLoading('Collecting Data...', `Gathering data from ${deviceName}`);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Request data from server
      ws.send(JSON.stringify({
        type: 'request_device_data',
        device_name: deviceName,
        timestamp: Date.now()
      }));
    } else {
      // Try to collect from localStorage if offline
      collectFromLocalStorage(deviceName);
    }
  }

  // Collect data from localStorage (offline mode)
  function collectFromLocalStorage(deviceName) {
    console.log(`📱 Collecting data from localStorage for ${deviceName}...`);
    
    try {
      // Try to collect from various localStorage keys
      const deviceType = getDeviceType(deviceName);
      let collectedData = {};
      
      if (deviceType === 'entry-scanner') {
        // Collect Entry Scanner data
        const studentCache = localStorage.getItem('studentCache');
        const localStudentDatabase = localStorage.getItem('localStudentDatabase');
        const offlineRegistrations = localStorage.getItem('offlineRegistrations');
        const localRegistrationDatabase = localStorage.getItem('localRegistrationDatabase');
        
        collectedData = {
          students: studentCache ? JSON.parse(studentCache) : (localStudentDatabase ? JSON.parse(localStudentDatabase) : {}),
          registrations: offlineRegistrations ? JSON.parse(offlineRegistrations) : (localRegistrationDatabase ? JSON.parse(localRegistrationDatabase) : []),
          device_type: 'entry-scanner',
          collected_at: new Date().toISOString(),
          source: 'localStorage'
        };
        
      } else if (deviceType === 'exit-validator') {
        // Collect Exit Validator data
        const localValidationDatabase = localStorage.getItem('localValidationDatabase');
        const offlineValidations = localStorage.getItem('offlineValidations');
        const backupValidationDatabase = localStorage.getItem('backupValidationDatabase');
        
        collectedData = {
          validations: localValidationDatabase ? JSON.parse(localValidationDatabase) : 
                      (offlineValidations ? JSON.parse(offlineValidations) : 
                      (backupValidationDatabase ? JSON.parse(backupValidationDatabase) : [])),
          device_type: 'exit-validator',
          collected_at: new Date().toISOString(),
          source: 'localStorage'
        };
      }
      
      // Store collected data
      this.collectedData[deviceName] = collectedData;
      saveCollectedData();
      
      hideLoading();
      showNotification(`✅ Data collected from ${deviceName} (offline mode)`, 'success');
      updateDeviceCard(deviceName);
      
    } catch (error) {
      console.error('❌ Error collecting from localStorage:', error);
      hideLoading();
      showNotification(`❌ Failed to collect data from ${deviceName}: ${error.message}`, 'error');
    }
  }

  // Export device data to Excel
  function exportDeviceData(deviceName) {
    const data = collectedData[deviceName];
    if (!data) {
      showNotification(`❌ No data available for ${deviceName}`, 'error');
      return;
    }
    
    console.log(`📊 Exporting data for ${deviceName}...`);
    
    try {
      const deviceType = getDeviceType(deviceName);
      let workbook = XLSX.utils.book_new();
      
      if (deviceType === 'entry-scanner' && data.students) {
        // Export students data
        const studentsArray = Object.entries(data.students).map(([id, student]) => ({
          'Student ID': id,
          'Name': student.name || '',
          'Center': student.center || '',
          'Grade': student.grade || '',
          'Subject': student.subject || '',
          'Phone': student.phone || '',
          'Parent Phone': student.parent_phone || '',
          'Fees': student.fees || '0',
          'Email': student.email || '',
          'Address': student.address || '',
          'Registration Method': student.registrationMethod || '',
          'Timestamp': student.timestamp || ''
        }));
        
        const studentsSheet = XLSX.utils.json_to_sheet(studentsArray);
        XLSX.utils.book_append_sheet(workbook, studentsSheet, 'Students');
        
        // Export registrations data
        if (data.registrations && data.registrations.length > 0) {
          const registrationsSheet = XLSX.utils.json_to_sheet(data.registrations);
          XLSX.utils.book_append_sheet(workbook, registrationsSheet, 'Registrations');
        }
        
      } else if (deviceType === 'exit-validator' && data.validations) {
        // Export validations data
        const validationsSheet = XLSX.utils.json_to_sheet(data.validations);
        XLSX.utils.book_append_sheet(workbook, validationsSheet, 'Validations');
      }
      
      // Add metadata sheet
      const metadata = [
        { 'Property': 'Device Name', 'Value': deviceName },
        { 'Property': 'Device Type', 'Value': deviceType },
        { 'Property': 'Data Collected At', 'Value': data.collected_at },
        { 'Property': 'Data Source', 'Value': data.source || 'server' },
        { 'Property': 'Total Students', 'Value': data.students ? Object.keys(data.students).length : 0 },
        { 'Property': 'Total Registrations', 'Value': data.registrations ? data.registrations.length : 0 },
        { 'Property': 'Total Validations', 'Value': data.validations ? data.validations.length : 0 }
      ];
      
      const metadataSheet = XLSX.utils.json_to_sheet(metadata);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${deviceName}_data_${timestamp}.xlsx`;
      
      // Download file
      XLSX.writeFile(workbook, filename);
      
      showNotification(`✅ Data exported to ${filename}`, 'success');
      
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      showNotification(`❌ Failed to export data: ${error.message}`, 'error');
    }
  }

  // View device data
  function viewDeviceData(deviceName) {
    const data = collectedData[deviceName];
    if (!data) {
      showNotification(`❌ No data available for ${deviceName}`, 'error');
      return;
    }
    
    console.log(`👁️ Viewing data for ${deviceName}...`);
    
    const preview = document.getElementById('data-preview');
    const title = document.getElementById('preview-title');
    const content = document.getElementById('preview-content');
    
    title.textContent = `Data from ${deviceName}`;
    
    const deviceType = getDeviceType(deviceName);
    let html = '';
    
    if (deviceType === 'entry-scanner' && data.students) {
      // Show students data
      const studentsArray = Object.entries(data.students).map(([id, student]) => ({
        'Student ID': id,
        'Name': student.name || '',
        'Center': student.center || '',
        'Grade': student.grade || '',
        'Subject': student.subject || '',
        'Phone': student.phone || '',
        'Parent Phone': student.parent_phone || '',
        'Fees': student.fees || '0',
        'Registration Method': student.registrationMethod || '',
        'Timestamp': student.timestamp || ''
      }));
      
      html = createDataTable('Students', studentsArray);
      
      if (data.registrations && data.registrations.length > 0) {
        html += createDataTable('Registrations', data.registrations);
      }
      
    } else if (deviceType === 'exit-validator' && data.validations) {
      // Show validations data
      html = createDataTable('Validations', data.validations);
    }
    
    content.innerHTML = html;
    preview.classList.add('show');
  }

  // Create data table HTML
  function createDataTable(title, data) {
    if (!data || data.length === 0) {
      return `<h4>${title}</h4><p>No data available</p>`;
    }
    
    const headers = Object.keys(data[0]);
    const rows = data.slice(0, 100); // Limit to 100 rows for performance
    
    let html = `
      <h4>${title} (${data.length} records, showing first ${rows.length})</h4>
      <table class="data-table">
        <thead>
          <tr>
            ${headers.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    if (data.length > 100) {
      html += `<p><em>Showing first 100 of ${data.length} records. Export to Excel to see all data.</em></p>`;
    }
    
    return html;
  }

  // Close data preview
  function closePreview() {
    const preview = document.getElementById('data-preview');
    preview.classList.remove('show');
  }

  // Export current data
  function exportCurrentData() {
    const preview = document.getElementById('data-preview');
    const title = document.getElementById('preview-title');
    const deviceName = title.textContent.replace('Data from ', '');
    exportDeviceData(deviceName);
  }

  // Collect all devices data
  function collectAllDevices() {
    console.log('📊 Collecting data from all devices...');
    
    showLoading('Collecting All Data...', 'Gathering data from all connected devices');
    
    const deviceNames = Object.keys(devices);
    let completed = 0;
    
    deviceNames.forEach(deviceName => {
      setTimeout(() => {
        collectDeviceData(deviceName);
        completed++;
        
        if (completed === deviceNames.length) {
          setTimeout(() => {
            hideLoading();
            showNotification(`✅ Data collected from ${deviceNames.length} devices`, 'success');
          }, 1000);
        }
      }, completed * 500); // Stagger requests
    });
  }

  // Export all data
  function exportAllData() {
    console.log('📊 Exporting all collected data...');
    
    try {
      const workbook = XLSX.utils.book_new();
      
      Object.entries(collectedData).forEach(([deviceName, data]) => {
        const deviceType = getDeviceType(deviceName);
        
        if (deviceType === 'entry-scanner' && data.students) {
          const studentsArray = Object.entries(data.students).map(([id, student]) => ({
            'Device': deviceName,
            'Student ID': id,
            'Name': student.name || '',
            'Center': student.center || '',
            'Grade': student.grade || '',
            'Subject': student.subject || '',
            'Phone': student.phone || '',
            'Parent Phone': student.parent_phone || '',
            'Fees': student.fees || '0',
            'Registration Method': student.registrationMethod || '',
            'Timestamp': student.timestamp || ''
          }));
          
          const studentsSheet = XLSX.utils.json_to_sheet(studentsArray);
          XLSX.utils.book_append_sheet(workbook, studentsSheet, `${deviceName}_Students`);
        }
        
        if (data.validations && data.validations.length > 0) {
          const validationsWithDevice = data.validations.map(validation => ({
            'Device': deviceName,
            ...validation
          }));
          
          const validationsSheet = XLSX.utils.json_to_sheet(validationsWithDevice);
          XLSX.utils.book_append_sheet(workbook, validationsSheet, `${deviceName}_Validations`);
        }
      });
      
      // Add summary sheet
      const summary = Object.entries(collectedData).map(([deviceName, data]) => ({
        'Device Name': deviceName,
        'Device Type': getDeviceType(deviceName),
        'Students': data.students ? Object.keys(data.students).length : 0,
        'Registrations': data.registrations ? data.registrations.length : 0,
        'Validations': data.validations ? data.validations.length : 0,
        'Collected At': data.collected_at,
        'Data Source': data.source || 'server'
      }));
      
      const summarySheet = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `all_devices_data_${timestamp}.xlsx`;
      
      // Download file
      XLSX.writeFile(workbook, filename);
      
      showNotification(`✅ All data exported to ${filename}`, 'success');
      
    } catch (error) {
      console.error('❌ Error exporting all data:', error);
      showNotification(`❌ Failed to export all data: ${error.message}`, 'error');
    }
  }

  // Clear cache
  function clearCache() {
    if (confirm('Are you sure you want to clear all cached data? This action cannot be undone.')) {
      collectedData = {};
      localStorage.removeItem('collectedData');
      renderDeviceGrid();
      showNotification('✅ Cache cleared successfully', 'success');
    }
  }

  // Refresh devices
  function refreshDevices() {
    console.log('🔄 Refreshing devices...');
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      requestDeviceList();
    } else {
      // Load from localStorage if offline
      loadCachedDeviceData();
    }
    
    showNotification('🔄 Devices refreshed', 'info');
  }

  // Load cached device data
  function loadCachedDeviceData() {
    try {
      const cached = localStorage.getItem('collectedData');
      if (cached) {
        collectedData = JSON.parse(cached);
        console.log('📱 Loaded cached device data:', Object.keys(collectedData).length, 'devices');
      }
    } catch (error) {
      console.error('❌ Error loading cached data:', error);
    }
  }

  // Save collected data
  function saveCollectedData() {
    try {
      localStorage.setItem('collectedData', JSON.stringify(collectedData));
    } catch (error) {
      console.error('❌ Error saving collected data:', error);
    }
  }

  // Start periodic data collection
  function startPeriodicCollection() {
    // Collect data every 5 minutes
    setInterval(() => {
      if (Object.keys(devices).length > 0) {
        console.log('🔄 Periodic data collection...');
        collectAllDevices();
      }
    }, 5 * 60 * 1000);
  }

  // Setup event listeners
  function setupEventListeners() {
    // Handle page visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ws && ws.readyState === WebSocket.OPEN) {
        requestDeviceList();
      }
    });
    
    // Handle window focus
    window.addEventListener('focus', () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        requestDeviceList();
      }
    });
  }

  // Update connection status
  function updateConnectionStatus(connected) {
    const statusElement = document.querySelector('.device-status');
    if (statusElement) {
      statusElement.textContent = connected ? 'ONLINE' : 'OFFLINE';
      statusElement.className = `device-status status-${connected ? 'online' : 'offline'}`;
    }
  }

  // Show loading overlay
  function showLoading(text, subtext) {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const loadingSubtext = document.getElementById('loading-subtext');
    
    loadingText.textContent = text;
    loadingSubtext.textContent = subtext;
    overlay.classList.add('show');
  }

  // Hide loading overlay
  function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('show');
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  // Go back to dashboard
  function goBack() {
    window.location.href = '/admin-dashboard';
  }

  // Make functions globally available
  window.collectDeviceData = collectDeviceData;
  window.exportDeviceData = exportDeviceData;
  window.viewDeviceData = viewDeviceData;
  window.collectAllDevices = collectAllDevices;
  window.exportAllData = exportAllData;
  window.clearCache = clearCache;
  window.refreshDevices = refreshDevices;
  window.closePreview = closePreview;
  window.exportCurrentData = exportCurrentData;
  window.goBack = goBack;

  // Initialize when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
