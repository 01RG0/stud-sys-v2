# Student Lab System v2 - Simplified Setup

## 🚀 Quick Start Guide

This system has been simplified to just **7 main files** for easy setup and management.

### 📁 Main Files

1. **`LAUNCHER.bat`** - Main menu (start here)
2. **`Batch-Files/SETUP.bat`** - Complete system setup (first time only)
3. **`Batch-Files/PACKAGES.bat`** - Install/update dependencies
4. **`Batch-Files/SERVERS.bat`** - Start/stop server control
5. **`Batch-Files/START.bat`** - Quick server start
6. **`Batch-Files/STOP.bat`** - Quick server stop
7. **`Batch-Files/SSL-CERT.bat`** - Generate SSL certificates

## 🎯 First Time Setup

### Step 1: Run Setup
1. **Double-click `LAUNCHER.bat`**
2. **Select option 2: Complete Setup**
3. **Follow the on-screen instructions**

The setup will:
- ✅ Check and configure MySQL
- ✅ Create dedicated database user
- ✅ Set up database with schema
- ✅ Install Node.js dependencies
- ✅ Create configuration files
- ✅ Test everything

### Step 2: Start Server
1. **Select option 1: Quick Start**
2. **Server will start automatically**
3. **Open: http://localhost:3000**

## 🔧 Daily Usage

### Starting the System
- **Option 1:** Run `LAUNCHER.bat` → Option 1 (recommended)
- **Option 2:** Double-click `Batch-Files/START.bat` (direct)

### Stopping the System
- **Option 1:** Run `LAUNCHER.bat` → Option 2 (recommended)
- **Option 2:** Double-click `Batch-Files/STOP.bat` (direct)
- **Option 3:** Press `Ctrl+C` in the server window
- **Option 4:** Run `LAUNCHER.bat` → Option 5 → Option 2

## 📦 Package Management

### Install/Update Dependencies
- Run `LAUNCHER.bat` → Option 4
- Or directly: `Batch-Files/PACKAGES.bat`

### What it does:
- ✅ Checks Node.js and MySQL
- ✅ Installs missing packages
- ✅ Updates existing packages
- ✅ Verifies compatibility
- ✅ Cleans up old packages

## 🖥️ Server Control

### Advanced Server Management
- Run `LAUNCHER.bat` → Option 5
- Or directly: `Batch-Files/SERVERS.bat`

### Features:
- ✅ Start server
- ✅ Stop all servers
- ✅ Restart server
- ✅ Check server status
- ✅ View server logs
- ✅ Kill all Node processes

## 🔄 Multi-Device Deployment

### Easy Setup on New Devices
1. **Copy entire project folder** to new device
2. **Run `SETUP.bat`** (handles everything automatically)
3. **Start with `START.bat`**

### Benefits:
- ✅ Same configuration on all devices
- ✅ Dedicated database user (secure)
- ✅ Automatic dependency installation
- ✅ No manual configuration needed

## 🛠️ Troubleshooting

### Common Issues

#### Server Won't Start
1. Run `PACKAGES.bat` to check dependencies
2. Run `SERVERS.bat` → Check Status
3. Ensure MySQL is running

#### Database Connection Failed
1. Run `SETUP.bat` again
2. Check MySQL service is running
3. Verify credentials in `.env` file

#### Port 3000 Already in Use
1. Run `SERVERS.bat` → Stop All Servers
2. Or: Kill All Node Processes
3. Then start server again

### Manual Commands
```bash
# Start server manually
cd System\server
node main-server.js

# Install dependencies manually
cd System\server
npm install

# Check MySQL service
net start mysql
```

## 📋 System Requirements

### Required Software
- **Windows 10/11**
- **MySQL 5.7+ or 8.0+**
- **Node.js 16+**
- **npm** (comes with Node.js)

### Installation Links
- **MySQL:** https://dev.mysql.com/downloads/mysql/
- **Node.js:** https://nodejs.org/
- **XAMPP (includes MySQL):** https://www.apachefriends.org/

## 🎉 That's It!

The system is now **super simple**:
- **1 launcher** to access everything
- **1 file to setup** everything
- **1 file to start** the server
- **1 file to stop** the server
- **1 file to manage** packages
- **1 file to control** servers
- **1 file to generate** SSL certificates

All batch files are organized in the `Batch-Files` folder for easy management!

---

**For support:** Run the setup script again or check the server logs.
