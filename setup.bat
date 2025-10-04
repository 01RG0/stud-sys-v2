@echo off
setlocal enabledelayedexpansion

:: ========================================
:: Student Management System v2 - Setup Script
:: ========================================

echo.
echo ========================================
echo   Student Management System v2 Setup
echo ========================================
echo.

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Running with administrator privileges
) else (
    echo [WARNING] Not running as administrator. Some operations may require elevation.
    echo.
)

:: Set colors for better output
color 0A

:: Function to pause and wait for user input
:wait
echo.
echo Press any key to continue...
pause >nul
echo.

:: Check if Node.js is installed
echo [STEP 1/8] Checking Node.js installation...
node --version >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] Node.js is already installed
    node --version
) else (
    echo [ERROR] Node.js is not installed
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version and run the installer
    echo.
    echo After installation, restart this script
    goto wait
)

:: Check if npm is available
echo.
echo [STEP 2/8] Checking npm installation...
npm --version >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] npm is available
    npm --version
) else (
    echo [ERROR] npm is not available
    echo Please reinstall Node.js
    goto wait
)

:: Check if MySQL is installed
echo.
echo [STEP 3/8] Checking MySQL installation...
mysql --version >nul 2>&1
if %errorLevel% == 0 (
    echo [SUCCESS] MySQL is already installed
    mysql --version
    set MYSQL_INSTALLED=1
) else (
    echo [WARNING] MySQL is not installed or not in PATH
    echo.
    echo Please install MySQL from: https://dev.mysql.com/downloads/mysql/
    echo.
    echo Installation steps:
    echo 1. Download MySQL Community Server
    echo 2. Run the installer
    echo 3. Choose "Developer Default" setup type
    echo 4. Set root password (remember this!)
    echo 5. Complete installation
    echo.
    echo After installation, restart this script
    set MYSQL_INSTALLED=0
    goto wait
)

:: Install Node.js dependencies
echo.
echo [STEP 4/8] Installing Node.js dependencies...
if exist "package.json" (
    echo [INFO] Installing dependencies from package.json...
    npm install
    if %errorLevel% == 0 (
        echo [SUCCESS] Dependencies installed successfully
    ) else (
        echo [ERROR] Failed to install dependencies
        echo Please check your internet connection and try again
        goto wait
    )
) else (
    echo [WARNING] package.json not found
    echo Creating basic package.json...
    echo {> package.json
    echo   "name": "student-management-system",>> package.json
    echo   "version": "2.0.0",>> package.json
    echo   "description": "Student Management System with QR Scanning",>> package.json
    echo   "main": "System/server/main-server.js",>> package.json
    echo   "scripts": {>> package.json
    echo     "start": "node System/server/main-server.js",>> package.json
    echo     "dev": "nodemon System/server/main-server.js">> package.json
    echo   },>> package.json
    echo   "dependencies": {>> package.json
    echo     "express": "^4.18.2",>> package.json
    echo     "ws": "^8.13.0",>> package.json
    echo     "mysql2": "^3.6.0",>> package.json
    echo     "multer": "^1.4.5-lts.1",>> package.json
    echo     "xlsx": "^0.18.5",>> package.json
    echo     "cors": "^2.8.5">> package.json
    echo   }>> package.json
    echo }>> package.json
    
    echo [INFO] Installing dependencies...
    npm install
    if %errorLevel% == 0 (
        echo [SUCCESS] Dependencies installed successfully
    ) else (
        echo [ERROR] Failed to install dependencies
        goto wait
    )
)

:: Create database directory and files
echo.
echo [STEP 5/8] Setting up database files...
if not exist "database" mkdir database

:: Create database schema
echo [INFO] Creating database schema...
echo -- Student Management System Database Schema> database\schema.sql
echo -- Created by setup script>> database\schema.sql
echo.>> database\schema.sql
echo CREATE DATABASE IF NOT EXISTS student_management;>> database\schema.sql
echo USE student_management;>> database\schema.sql
echo.>> database\schema.sql
echo -- Students table>> database\schema.sql
echo CREATE TABLE IF NOT EXISTS students (>> database\schema.sql
echo   id VARCHAR(50) PRIMARY KEY,>> database\schema.sql
echo   name VARCHAR(255) NOT NULL,>> database\schema.sql
echo   center VARCHAR(255),>> database\schema.sql
echo   grade VARCHAR(50),>> database\schema.sql
echo   subject VARCHAR(255),>> database\schema.sql
echo   phone VARCHAR(20),>> database\schema.sql
echo   parent_phone VARCHAR(20),>> database\schema.sql
echo   email VARCHAR(255),>> database\schema.sql
echo   address TEXT,>> database\schema.sql
echo   fees DECIMAL(10,2) DEFAULT 0,>> database\schema.sql
echo   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,>> database\schema.sql
echo   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP>> database\schema.sql
echo );>> database\schema.sql
echo.>> database\schema.sql
echo -- Registrations table>> database\schema.sql
echo CREATE TABLE IF NOT EXISTS registrations (>> database\schema.sql
echo   id INT AUTO_INCREMENT PRIMARY KEY,>> database\schema.sql
echo   student_id VARCHAR(50) NOT NULL,>> database\schema.sql
echo   student_name VARCHAR(255) NOT NULL,>> database\schema.sql
echo   center VARCHAR(255),>> database\schema.sql
echo   fees DECIMAL(10,2) DEFAULT 0,>> database\schema.sql
echo   homework_score DECIMAL(5,2) DEFAULT 0,>> database\schema.sql
echo   exam_score DECIMAL(5,2),>> database\schema.sql
echo   extra_sessions INT DEFAULT 0,>> database\schema.sql
echo   comment TEXT,>> database\schema.sql
echo   payment_amount DECIMAL(10,2) DEFAULT 0,>> database\schema.sql
echo   device_name VARCHAR(100),>> database\schema.sql
echo   entry_method ENUM('qr_scan', 'manual') DEFAULT 'qr_scan',>> database\schema.sql
echo   offline_mode BOOLEAN DEFAULT FALSE,>> database\schema.sql
echo   registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,>> database\schema.sql
echo   INDEX idx_student_id (student_id),>> database\schema.sql
echo   INDEX idx_registered_at (registered_at),>> database\schema.sql
echo   INDEX idx_device_name (device_name)>> database\schema.sql
echo );>> database\schema.sql
echo.>> database\schema.sql
echo -- Devices table>> database\schema.sql
echo CREATE TABLE IF NOT EXISTS devices (>> database\schema.sql
echo   id INT AUTO_INCREMENT PRIMARY KEY,>> database\schema.sql
echo   name VARCHAR(100) UNIQUE NOT NULL,>> database\schema.sql
echo   role ENUM('entry_scanner', 'exit_validator', 'manager') NOT NULL,>> database\schema.sql
echo   last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,>> database\schema.sql
echo   is_online BOOLEAN DEFAULT FALSE,>> database\schema.sql
echo   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP>> database\schema.sql
echo );>> database\schema.sql

:: Create sample data
echo [INFO] Creating sample data...
echo -- Sample data for testing> database\sample_data.sql
echo USE student_management;>> database\sample_data.sql
echo.>> database\sample_data.sql
echo -- Insert sample students>> database\sample_data.sql
echo INSERT IGNORE INTO students (id, name, center, grade, subject, phone, parent_phone, email, fees) VALUES>> database\sample_data.sql
echo ('STU001', 'Ahmed Ali', 'Main Center', 'Grade 10', 'Mathematics', '01234567890', '01234567891', 'ahmed@example.com', 500.00),>> database\sample_data.sql
echo ('STU002', 'Fatima Hassan', 'Main Center', 'Grade 11', 'Physics', '01234567892', '01234567893', 'fatima@example.com', 600.00),>> database\sample_data.sql
echo ('STU003', 'Mohamed Omar', 'Branch Center', 'Grade 9', 'Chemistry', '01234567894', '01234567895', 'mohamed@example.com', 450.00),>> database\sample_data.sql
echo ('STU004', 'Aisha Ibrahim', 'Main Center', 'Grade 12', 'Biology', '01234567896', '01234567897', 'aisha@example.com', 700.00),>> database\sample_data.sql
echo ('STU005', 'Omar Khalil', 'Branch Center', 'Grade 10', 'English', '01234567898', '01234567899', 'omar@example.com', 550.00);>> database\sample_data.sql

echo [SUCCESS] Database files created

:: Create environment file
echo.
echo [STEP 6/8] Creating environment configuration...
if not exist ".env" (
    echo [INFO] Creating .env file...
    echo # Database Configuration> .env
    echo DB_HOST=localhost>> .env
    echo DB_PORT=3306>> .env
    echo DB_NAME=student_management>> .env
    echo DB_USER=root>> .env
    echo DB_PASSWORD=>> .env
    echo.>> .env
    echo # Server Configuration>> .env
    echo PORT=3000>> .env
    echo NODE_ENV=development>> .env
    echo.>> .env
    echo # WebSocket Configuration>> .env
    echo WS_PORT=3000>> .env
    echo [SUCCESS] .env file created
) else (
    echo [INFO] .env file already exists
)

:: Database setup
echo.
echo [STEP 7/8] Setting up database...
if %MYSQL_INSTALLED% == 1 (
    echo [INFO] Please enter your MySQL root password:
    set /p MYSQL_PASSWORD="MySQL Root Password: "
    
    echo [INFO] Creating database and tables...
    mysql -u root -p%MYSQL_PASSWORD% < database\schema.sql
    if %errorLevel% == 0 (
        echo [SUCCESS] Database created successfully
        
        echo [INFO] Importing sample data...
        mysql -u root -p%MYSQL_PASSWORD% < database\sample_data.sql
        if %errorLevel% == 0 (
            echo [SUCCESS] Sample data imported successfully
        ) else (
            echo [WARNING] Failed to import sample data (this is optional)
        )
        
        echo [INFO] Updating .env file with database password...
        powershell -Command "(Get-Content .env) -replace 'DB_PASSWORD=', 'DB_PASSWORD=%MYSQL_PASSWORD%' | Set-Content .env"
        
    ) else (
        echo [ERROR] Failed to create database
        echo Please check your MySQL password and try again
        goto wait
    )
) else (
    echo [SKIP] MySQL not available, skipping database setup
    echo Please run this script again after installing MySQL
)

:: Create logs directory
echo.
echo [STEP 8/8] Creating logs directory...
if not exist "logs" mkdir logs
echo [SUCCESS] Logs directory created

:: Final setup
echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo [SUCCESS] Student Management System v2 has been set up successfully!
echo.
echo Next steps:
echo 1. Edit .env file if needed (database password, etc.)
echo 2. Run LAUNCHER.bat to start the system
echo 3. Open http://localhost:3000 in your browser
echo 4. Start using the system!
echo.
echo System URLs:
echo - Main Interface: http://localhost:3000
echo - Entry Scanner: http://localhost:3000/entry-scanner
echo - Exit Validator: http://localhost:3000/exit-validator
echo - Manager Dashboard: http://localhost:3000/manager
echo.
echo Debug Commands:
echo - Ctrl+Shift+D: Show debug status
echo - Ctrl+Shift+S: Force sync all students
echo.
echo For support, check the README.md file
echo.

:: Ask if user wants to start the system
set /p START_NOW="Do you want to start the system now? (y/n): "
if /i "%START_NOW%"=="y" (
    echo.
    echo [INFO] Starting the system...
    echo.
    call LAUNCHER.bat
) else (
    echo.
    echo [INFO] You can start the system later by running LAUNCHER.bat
)

echo.
echo Setup completed successfully!
echo.
pause
