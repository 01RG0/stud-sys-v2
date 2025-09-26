# Student Lab System v2

A comprehensive student management system with QR code scanning, offline functionality, and MySQL integration.

## 🚀 Quick Start

### Main Launchers
- **`START_SYSTEM.bat`** - Full menu with all options
- **`QUICK_START.bat`** - Quick access to common operations

### Most Common Operations
1. **Start System**: `QUICK_START.bat` → Option 1
2. **Close Servers**: `QUICK_START.bat` → Option 2
3. **Test Connection**: `QUICK_START.bat` → Option 3

## 📁 File Organization

### Batch Files (`Batch-Files/`)
- **System-Control/**: Core system operations
  - `START_CLEAN_SYSTEM.bat` - Start the complete system
  - `CLOSE_SERVERS.bat` - Close all running servers
  - `START_SERVER_SIMPLE.bat` - Start simple server only

- **Testing/**: System testing tools
  - `TEST_AUTO_RECONNECTION.bat` - Test auto-reconnection
  - `TEST_OFFLINE_FUNCTIONALITY.bat` - Test offline features
  - `TEST_MYSQL_INTEGRATION.bat` - Test database integration
  - `TEST_HYBRID_SYSTEM.bat` - Test hybrid system features

- **Setup/**: Installation and setup scripts
  - `COMPLETE_SYSTEM_SETUP.bat` - Complete system installation
  - `ENHANCED_SYSTEM_SETUP.bat` - Enhanced setup with HTTPS
  - `SETUP_MYSQL.bat` - MySQL database setup

- **Utilities/**: Maintenance and recovery tools
  - `SYSTEM_RECOVERY.bat` - System recovery and repair
  - `FIX_HTTPS_AND_OPENSSL.bat` - Fix HTTPS/SSL issues
  - `VERIFY_SYSTEM.bat` - Verify system integrity

### Assets (`Assets/`)
- **Fonts/**: Font files and resources
- **Scripts/**: Utility scripts and tools

### Core System (`System/`)
- **server/**: Main server application
- **web-interface/**: Web interface files
  - **pages/**: HTML pages (Admin Dashboard, Entry Scanner, Exit Validator)
  - **scripts/**: JavaScript files
  - **styles/**: CSS stylesheets
  - **libraries/**: External libraries

### Documentation (`Documentation/`)
- Complete system documentation and guides

### Data Storage
- **Student-Data/**: Excel import folder (auto-monitored)
- **Logs/**: System logs and registrations
- **Backups/**: System backups

## 🌐 Access URLs

After starting the system, access:
- **HTTP**: `http://[YOUR_IP]:3000`
- **HTTPS**: `https://[YOUR_IP]:3443`

### Pages
- **Admin Dashboard**: `/Admin-Dashboard.html`
- **Entry Scanner**: `/Entry-Scanner.html`
- **Exit Validator**: `/Exit-Validator.html`

## 🔧 Key Features

### ✅ Implemented Features
- **Auto-Reconnection**: Automatic reconnection when connection is lost
- **Offline Functionality**: Full offline operation with local storage
- **MySQL Integration**: Hybrid local + database storage
- **QR Code Scanning**: Entry and exit validation
- **Manual Student Entry**: Quick manual entry with step-by-step forms
- **Excel Import**: Automatic Excel file import from `Student-Data/` folder
- **Excel Export**: Export data to Excel format
- **HTTPS Support**: Secure connections with SSL certificates
- **Real-time Updates**: Live device status and statistics
- **Persistent Login**: Device login persistence
- **Manual Reconnect**: Permanent reconnect buttons on all pages

### 🔄 Connection Management
- **Heartbeat System**: Regular connection monitoring
- **Connection Status**: Real-time connection indicators
- **Auto-Reconnection**: Exponential backoff reconnection
- **Manual Reconnect**: Always-available reconnect buttons

### 💾 Data Management
- **Hybrid Storage**: Local storage + MySQL backup
- **Zero Data Loss**: All data saved locally and synced
- **Offline Queues**: Operations queued when offline
- **Auto-Sync**: Automatic synchronization when online

## 🛠️ Troubleshooting

### Common Issues
1. **Port in use**: Run `CLOSE_SERVERS.bat` first
2. **MySQL connection**: Check MySQL service and credentials
3. **HTTPS issues**: Run `FIX_HTTPS_AND_OPENSSL.bat`
4. **System problems**: Run `SYSTEM_RECOVERY.bat`

### Testing
- Use testing scripts in `Batch-Files/Testing/` to verify functionality
- Check logs in `Logs/` folder for error details

## 📋 System Requirements

- **Node.js**: v14 or higher
- **MySQL**: v5.7 or higher
- **Windows**: 10 or higher
- **Browser**: Modern browser with WebSocket support

## 🔐 Security

- **HTTPS**: SSL/TLS encryption for secure connections
- **Local Storage**: Encrypted local data storage
- **Input Validation**: All inputs validated and sanitized

## 📞 Support

For issues or questions:
1. Check the `Documentation/` folder
2. Run appropriate testing scripts
3. Check system logs for error details
4. Use recovery tools if needed

---

**Version**: 2.0  
**Last Updated**: September 2025  
**Status**: Production Ready ✅
