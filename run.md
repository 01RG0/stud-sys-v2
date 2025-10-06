# Student Lab System v2 - Manual Setup Guide

## Complete Manual Setup Process for Fresh Device with Existing MySQL

This guide will help you set up the Student Lab System on a fresh device that already has MySQL installed.

---

## Prerequisites

- ✅ **Node.js** installed (version 14 or higher)
- ✅ **npm** installed (comes with Node.js)
- ✅ **MySQL** installed and running
- ✅ **Git** (optional, for cloning the repository)

---

## Step 1: Verify Your Environment

### Check Node.js
```bash
node --version
```
**Expected output:** `v14.x.x` or higher

### Check npm
```bash
npm --version
```
**Expected output:** `6.x.x` or higher

### Check MySQL
```bash
mysql --version
```
**Expected output:** MySQL version information

### Check MySQL Service Status

**Windows:**
```cmd
sc query mysql
```
**Or check Services.msc**

**Linux/macOS:**
```bash
sudo systemctl status mysql
```

---

## Step 2: Install Node.js Dependencies

```bash
# Navigate to server directory
cd System/server

# Install all dependencies
npm install

# Return to project root
cd ../..
```

**Expected output:** Dependencies installed successfully

---

## Step 3: Create MySQL Database and User

### Connect to MySQL as root
```bash
mysql -u root -p
```

### Run these SQL commands:
```sql
-- Create the database
CREATE DATABASE student_lab_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user
CREATE USER 'student_lab_user'@'localhost' IDENTIFIED BY 'StudentLab2024!Secure';

-- Grant all privileges
GRANT ALL PRIVILEGES ON student_lab_system.* TO 'student_lab_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

---

## Step 4: Import Database Schema

```bash
# Import the main schema
mysql -u student_lab_user -p student_lab_system < database/schema.sql

# Import sample data
mysql -u student_lab_user -p student_lab_system < database/sample_data.sql
```

**Password:** `StudentLab2024!Secure`

---

## Step 5: Create Environment Configuration

```bash
# Copy template to actual .env file
cp env.template .env
```

### Edit the `.env` file with your database credentials:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=student_lab_system
DB_USER=student_lab_user
DB_PASSWORD=StudentLab2024!Secure

# Server Configuration
PORT=3000
NODE_ENV=development

# WebSocket Configuration
WS_PORT=3000

# Offline Mode Configuration
OFFLINE_MODE_ENABLED=true
OFFLINE_QUEUE_SIZE=1000
OFFLINE_SYNC_RETRY_COUNT=3
OFFLINE_SYNC_RETRY_DELAY=5000
OFFLINE_SYNC_BATCH_SIZE=50
OFFLINE_SYNC_TIMEOUT=30000

# Data Integrity Configuration
DATA_INTEGRITY_CHECKS=true
DATA_VALIDATION_ENABLED=true
DUPLICATE_PREVENTION=true
```

---

## Step 6: Create Logs Directory

```bash
# Create logs directory
mkdir logs
```

---

## Step 7: Test Database Connection

### Create a test file `test-db.js`:
```javascript
const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('✅ Database connected successfully!');
  
  // Test query
  connection.query('SELECT COUNT(*) as count FROM students', (err, results) => {
    if (err) {
      console.error('❌ Query failed:', err.message);
    } else {
      console.log(`✅ Found ${results[0].count} students in database`);
    }
    connection.end();
  });
});
```

### Run the test:
```bash
cd System/server
node ../../test-db.js
cd ../..
```

**Expected output:**
```
✅ Database connected successfully!
✅ Found X students in database
```

### Clean up test file:
```bash
rm test-db.js
```

---

## Step 8: Test Server Startup

```bash
# Test server startup
cd System/server
node main-server.js
```

**Expected output:**
```
✅ Server started successfully
✅ Database connected
✅ WebSocket server running
✅ Real IP detected: [YOUR_IP]
```

**Press `Ctrl+C` to stop the test.**

---

## Step 9: Get Your Network IP

### Windows:
```cmd
ipconfig | findstr "IPv4"
```

### Or use PowerShell:
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*'} | Select-Object IPAddress
```

### Linux/macOS:
```bash
hostname -I
```

---

## Step 10: Start the System

```bash
# Start the server
cd System/server
node main-server.js
```

---

## Step 11: Access the System

Open your browser and go to:

- **Entry Scanner**: `http://[YOUR_IP]:3000/entry-scanner`
- **Exit Validator**: `http://[YOUR_IP]:3000/exit-validator`
- **Admin Dashboard**: `http://[YOUR_IP]:3000/admin-dashboard`

**Replace `[YOUR_IP]` with your actual network IP address.**

---

## Manual Verification Steps

### Check Database Tables:
```sql
mysql -u student_lab_user -p student_lab_system

-- List all tables
SHOW TABLES;

-- Check students table
SELECT COUNT(*) FROM students;

-- Check entry_registrations table
SELECT COUNT(*) FROM entry_registrations;

-- Check if offline sync fields exist
DESCRIBE entry_registrations;
```

### Check File Structure:
```bash
# Verify all files exist
ls System/server/main-server.js
ls System/web-interface/pages/Entry-Scanner.html
ls System/web-interface/scripts/Entry-Scanner.js
ls database/schema.sql
ls .env
```

### Test WebSocket Connection:
1. Open browser developer tools (F12)
2. Go to Console tab
3. Visit `http://[YOUR_IP]:3000/entry-scanner`
4. Look for WebSocket connection messages

---

## Troubleshooting Common Issues

### If Database Connection Fails:
```bash
# Check MySQL service
# Windows:
net start mysql

# Linux/macOS:
sudo systemctl start mysql

# Test connection
mysql -u student_lab_user -p
```

### If Port 3000 is Busy:
Edit `.env` file and change:
```env
PORT=3001
WS_PORT=3001
```

### If Node.js Dependencies Fail:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf System/server/node_modules
cd System/server
npm install
```

---

## Manual Setup Checklist

- [ ] Node.js installed and working
- [ ] MySQL running and accessible
- [ ] Database `student_lab_system` created
- [ ] User `student_lab_user` created with privileges
- [ ] Schema imported successfully
- [ ] Sample data imported
- [ ] `.env` file created with correct credentials
- [ ] Node.js dependencies installed
- [ ] Logs directory created
- [ ] Database connection test passed
- [ ] Server starts without errors
- [ ] Web interface accessible
- [ ] WebSocket connections working

---

## Ready to Go!

Once all steps are completed, your system will be fully functional with:

- ✅ **Offline sync capabilities**
- ✅ **Real IP detection**
- ✅ **Live server logs**
- ✅ **Complete database setup**
- ✅ **All web interfaces working**

## Starting the System

**To start the server:**
```bash
cd System/server
node main-server.js
```

**Or use the launcher scripts:**
- `./LAUNCHER.bat` (Windows)
- `./LAUNCHER.sh` (Linux/macOS)
- `./LAUNCHER.ps1` (PowerShell)

---

## System Features

### Core Functionality
- **Student Registration**: QR code scanning and manual entry
- **Entry/Exit Tracking**: Real-time student movement monitoring
- **Admin Dashboard**: Complete system overview and management
- **Data Collection Manager**: Advanced data handling and export

### Advanced Features
- **Offline Mode**: Works without internet connection
- **Auto-Sync**: Automatic data synchronization when reconnected
- **Real IP Detection**: Automatically detects and uses network IP
- **Live Logs**: Real-time server monitoring
- **Data Integrity**: Duplicate prevention and validation
- **Export Tools**: Excel export and data management

### Security Features
- **SSL/HTTPS Support**: Secure connections
- **Data Validation**: Input sanitization and validation
- **Error Handling**: Comprehensive error management
- **Backup System**: Automatic data backup

---

**Setup completed successfully! 🎉**

Your Student Lab System is now ready for production use.
