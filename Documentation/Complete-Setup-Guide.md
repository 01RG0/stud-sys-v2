# 🚀 Student Lab System - Complete Setup & Operations Guide

## 📋 Table of Contents
1. [System Requirements](#system-requirements)
2. [Fresh Installation](#fresh-installation)
3. [Quick Start Commands](#quick-start-commands)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Operations Manual](#operations-manual)
6. [Recovery Procedures](#recovery-procedures)
7. [Advanced Configuration](#advanced-configuration)

---

## 🖥️ System Requirements

### Minimum Requirements
- **OS**: Windows 10/11 (64-bit)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 1GB free space
- **Network**: Local network access
- **Camera**: Built-in or USB camera for QR scanning

### Software Dependencies
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **PowerShell**: v5.1 or higher (built into Windows)
- **Browser**: Chrome, Firefox, or Edge (latest versions)

---

## 🔧 Fresh Installation

### Step 1: Install Node.js
```powershell
# Check if Node.js is installed
node -v
npm -v

# If not installed, download from: https://nodejs.org/
# Choose "LTS" version (currently v20.x.x)
# Run installer as Administrator
# Restart PowerShell after installation
```

### Step 2: Verify Installation
```powershell
# Open PowerShell as Administrator
# Navigate to your project
cd "C:\Users\hamad\Desktop\stud sys v2"

# Check versions
node -v    # Should show v18+ 
npm -v     # Should show v8+
Get-Host   # Check PowerShell version
```

### Step 3: Project Setup
```powershell
# Navigate to manager directory (IMPORTANT!)
cd "C:\Users\hamad\Desktop\stud sys v2\manager"

# Install dependencies
npm install

# Verify package.json exists
Test-Path "package.json"  # Should return True

# Check installed packages
npm list --depth=0
```

### Step 4: Prepare Student Data
```powershell
# Copy your Excel file to the data folder
Copy-Item "path\to\your\students.xlsx" "data\students.xlsx"

# Or use the example file you provided
Copy-Item "..\student file example\Senior 1 - Math - Alakbal - 2025-09-14.xlsx" "data\students.xlsx"

# Verify file exists
Test-Path "data\students.xlsx"  # Should return True
```

---

## ⚡ Quick Start Commands

### Start the System (Development Mode)
```powershell
# Navigate to manager directory
cd "C:\Users\hamad\Desktop\stud sys v2\manager"

# Start with auto-restart (recommended for development)
npm run dev

# You should see:
# ✅ Loaded X students from Excel
# 🌐 HTTP server listening on http://localhost:3000
# 🔌 WebSocket server listening on port 3001
```

### Start the System (Production Mode)
```powershell
# Navigate to manager directory
cd "C:\Users\hamad\Desktop\stud sys v2\manager"

# Start production server
npm start

# For background operation
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'C:\Users\hamad\Desktop\stud sys v2\manager'; npm start"
```

### Access the System
Open these URLs in your browser:
- **First Scan**: http://localhost:3000/first-scan.html
- **Last Scan**: http://localhost:3000/last-scan.html
- **Dashboard**: http://localhost:3000/dashboard.html
- **API Test**: http://localhost:3000/api/student-cache

---

## 🛠️ Troubleshooting Guide

### ❌ Common Error: "Could not read package.json"
```powershell
# PROBLEM: Running npm from wrong directory
# SOLUTION: Always run from manager directory

# Wrong (will fail):
cd "C:\Users\hamad\Desktop\stud sys v2"
npm start  # ❌ Error: package.json not found

# Correct:
cd "C:\Users\hamad\Desktop\stud sys v2\manager"
npm start  # ✅ Works
```

### ❌ Error: "Node.js not found"
```powershell
# Check if Node.js is in PATH
$env:PATH -split ';' | Where-Object { $_ -like "*node*" }

# If empty, reinstall Node.js:
# 1. Download from https://nodejs.org/
# 2. Run installer as Administrator
# 3. Restart PowerShell
# 4. Verify: node -v
```

### ❌ Error: "npm install failed"
```powershell
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
Remove-Item "package-lock.json" -ErrorAction SilentlyContinue
npm install

# If still fails, try with admin privileges
# Right-click PowerShell -> Run as Administrator
```

### ❌ Error: "Port already in use"
```powershell
# Check what's using ports 3000 and 3001
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# Kill processes if needed (replace PID with actual process ID)
taskkill /PID <ProcessID> /F

# Or use different ports
$env:HTTP_PORT="3002"
$env:WS_PORT="3003"
npm start
```

### ❌ Error: "Failed to load student data"
```powershell
# Check if Excel file exists
Test-Path "data\students.xlsx"

# Check file permissions
Get-Acl "data\students.xlsx" | Select-Object Owner, AccessToString

# Verify Excel format - should have columns:
# ID, Name, Center, Subject, Grade, Fees, Phone, Parent Phone

# Test with sample data (system will create sample if no Excel found)
Remove-Item "data\students.xlsx" -ErrorAction SilentlyContinue
npm start  # Will use built-in sample data
```

### ❌ Browser Issues: "Camera access denied"
```powershell
# Browser settings:
# Chrome: Settings > Privacy > Site Settings > Camera
# Firefox: about:preferences#privacy > Permissions > Camera
# Edge: Settings > Site permissions > Camera

# Must use HTTPS or localhost for camera access
# If accessing from other devices, consider setting up HTTPS
```

---

## 📚 Operations Manual

### Daily Startup Procedure
```powershell
# 1. Open PowerShell as Administrator
# 2. Navigate to manager directory
cd "C:\Users\hamad\Desktop\stud sys v2\manager"

# 3. Check system status
npm run dev  # Development mode with logs

# 4. Verify in browser:
# - http://localhost:3000/dashboard.html (should show no devices initially)
# - http://localhost:3000/first-scan.html (camera should work)
# - http://localhost:3000/last-scan.html (camera should work)

# 5. Ready for operation!
```

### Network Setup for Multiple Devices
```powershell
# 1. Find your computer's IP address
ipconfig | findstr IPv4

# 2. Open Windows Firewall (run as Administrator)
New-NetFirewallRule -DisplayName "StudentLab-HTTP" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000
New-NetFirewallRule -DisplayName "StudentLab-WS" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001

# 3. Share URLs with other devices (replace IP):
# First Scan: http://192.168.1.100:3000/first-scan.html
# Last Scan: http://192.168.1.100:3000/last-scan.html
# Dashboard: http://192.168.1.100:3000/dashboard.html
```

### Daily Operations
```powershell
# Export daily registrations to CSV
node scripts\export-daily.js

# View logs
Get-Content "logs\registered-$(Get-Date -Format 'yyyy-MM-dd').json"

# Backup data
$date = Get-Date -Format "yyyy-MM-dd"
Copy-Item "data\students.xlsx" "data\backup\students-$date.xlsx"
Copy-Item "logs\*" "logs\backup\$date\" -Recurse
```

### Shutdown Procedure
```powershell
# Graceful shutdown
# Press Ctrl+C in the terminal running npm

# Force shutdown if needed
Get-Process node | Stop-Process -Force

# Clean shutdown script
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Write-Host "✅ System shut down"
```

---

## 🔄 Recovery Procedures

### Complete System Reset
```powershell
# 1. Stop all processes
Get-Process node | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Navigate to manager directory
cd "C:\Users\hamad\Desktop\stud sys v2\manager"

# 3. Clean installation
Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
Remove-Item "package-lock.json" -ErrorAction SilentlyContinue
npm cache clean --force
npm install

# 4. Verify files
Test-Path "manager-server.js"
Test-Path "package.json"
Test-Path "data\students.xlsx"

# 5. Start system
npm run dev
```

### Restore from Backup
```powershell
# Restore student data
Copy-Item "data\backup\students-YYYY-MM-DD.xlsx" "data\students.xlsx"

# Restore logs
Copy-Item "logs\backup\YYYY-MM-DD\*" "logs\" -Recurse

# Restart system
npm start
```

### Emergency Sample Data
```powershell
# If Excel file is corrupted, system will auto-create sample data
# Or manually create sample:
Remove-Item "data\students.xlsx" -ErrorAction SilentlyContinue
npm start  # System creates sample data automatically

# Sample includes students with IDs: 557, 123
```

---

## ⚙️ Advanced Configuration

### Environment Variables
```powershell
# Custom ports
$env:HTTP_PORT="3000"
$env:WS_PORT="3001"

# Development mode
$env:NODE_ENV="development"

# Start with custom config
npm start
```

### Auto-Start with Windows (PM2)
```powershell
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start manager-server.js --name "student-lab"

# Save PM2 configuration
pm2 save

# Auto-start with Windows
pm2 startup windows
# Follow the instructions PM2 provides

# PM2 Management Commands:
pm2 status                    # View status
pm2 logs student-lab         # View logs
pm2 restart student-lab      # Restart app
pm2 stop student-lab         # Stop app
pm2 delete student-lab       # Remove app
```

### HTTPS Setup (Production)
```powershell
# Generate self-signed certificate (for testing)
# Install OpenSSL or use IIS to generate certificates

# Update manager-server.js to use HTTPS:
# const https = require('https');
# const fs = require('fs');
# 
# const options = {
#   key: fs.readFileSync('path/to/private-key.pem'),
#   cert: fs.readFileSync('path/to/certificate.pem')
# };
# 
# https.createServer(options, app).listen(443);
```

### Database Integration (Advanced)
```powershell
# Install database drivers (example: SQLite)
npm install sqlite3

# Modify manager-server.js to use database instead of Excel
# This requires custom development
```

---

## 🚨 Emergency Commands

### Quick Diagnostic
```powershell
# Run this if system isn't working
cd "C:\Users\hamad\Desktop\stud sys v2\manager"
Write-Host "=== System Diagnostic ==="
Write-Host "Node.js version: $(node -v)"
Write-Host "NPM version: $(npm -v)"
Write-Host "Package.json exists: $(Test-Path 'package.json')"
Write-Host "Students.xlsx exists: $(Test-Path 'data\students.xlsx')"
Write-Host "Node modules exist: $(Test-Path 'node_modules')"
Write-Host "Server file exists: $(Test-Path 'manager-server.js')"
netstat -ano | findstr :3000 | ForEach-Object { Write-Host "Port 3000 in use: $_" }
netstat -ano | findstr :3001 | ForEach-Object { Write-Host "Port 3001 in use: $_" }
```

### One-Command Restart
```powershell
# Complete restart in one command
cd "C:\Users\hamad\Desktop\stud sys v2\manager"; Get-Process node | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep 2; npm run dev
```

### System Health Check
```powershell
# Test all endpoints
$base = "http://localhost:3000"
try { Invoke-WebRequest "$base/api/student-cache" -UseBasicParsing | Out-Null; Write-Host "✅ API working" } catch { Write-Host "❌ API failed" }
try { Invoke-WebRequest "$base/first-scan.html" -UseBasicParsing | Out-Null; Write-Host "✅ First Scan UI working" } catch { Write-Host "❌ First Scan UI failed" }
try { Invoke-WebRequest "$base/last-scan.html" -UseBasicParsing | Out-Null; Write-Host "✅ Last Scan UI working" } catch { Write-Host "❌ Last Scan UI failed" }
try { Invoke-WebRequest "$base/dashboard.html" -UseBasicParsing | Out-Null; Write-Host "✅ Dashboard working" } catch { Write-Host "❌ Dashboard failed" }
```

---

## 📞 Support Checklist

When reporting issues, provide this information:

```powershell
# System Information
Write-Host "=== Support Information ==="
Write-Host "Windows Version: $((Get-WmiObject Win32_OperatingSystem).Caption)"
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
Write-Host "Node.js Version: $(node -v)"
Write-Host "NPM Version: $(npm -v)"
Write-Host "Current Directory: $(Get-Location)"
Write-Host "Package.json exists: $(Test-Path 'package.json')"
Write-Host "Students file exists: $(Test-Path 'data\students.xlsx')"
Write-Host "Last error: Check console output above"
```

---

## 🎯 Quick Reference Card

### Essential Commands (Print This!)
```powershell
# Navigate to project
cd "C:\Users\hamad\Desktop\stud sys v2\manager"

# Start system
npm run dev

# Check status
npm list --depth=0

# Export data
node scripts\export-daily.js

# Emergency restart
Get-Process node | Stop-Process -Force; npm start

# System URLs
# http://localhost:3000/first-scan.html
# http://localhost:3000/last-scan.html  
# http://localhost:3000/dashboard.html
```

---

**🎉 You're all set! This guide covers every possible scenario for running your Student Lab System successfully.**
