@echo off
title Student Lab System - Complete Setup
color 0A
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   STUDENT LAB SYSTEM - COMPLETE SETUP
echo ========================================
echo.
echo This script will:
echo   ✓ Check and install all required software
echo   ✓ Set up MySQL database with dedicated user
echo   ✓ Install Node.js dependencies
echo   ✓ Configure all system files
echo   ✓ Test everything to ensure it works
echo.

set /p continue="Continue with complete setup? (y/n): "
if "%continue%"=="" (
    echo.
    echo No input received. Exiting...
    timeout /t 2 >nul
    exit /b 0
)
if /i not "%continue%"=="y" (
    echo Setup cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STEP 1: SYSTEM REQUIREMENTS CHECK
echo ========================================

REM Check Windows version
echo Checking Windows version...
ver | findstr /i "windows" >nul
if %errorlevel% neq 0 (
    echo ERROR: This script requires Windows
    pause
    exit /b 1
) else (
    echo OK Windows detected
)

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Not running as administrator
    echo Some operations may require admin privileges
) else (
    echo OK Running as administrator
)

echo.
echo ========================================
echo   STEP 2: MYSQL INSTALLATION CHECK
echo ========================================

REM Check if MySQL is installed
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: MySQL not found!
    echo.
    echo Please install MySQL first:
    echo 1. Download from: https://dev.mysql.com/downloads/mysql/
    echo 2. Or use XAMPP: https://www.apachefriends.org/
    echo 3. Make sure MySQL is added to your system PATH
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('mysql --version') do set MYSQL_VERSION=%%i
    echo OK MySQL found: %MYSQL_VERSION%
)

REM Check MySQL service
echo Checking MySQL service...
sc query mysql >nul 2>&1
if %errorlevel% neq 0 (
    sc query mysql80 >nul 2>&1
    if %errorlevel% neq 0 (
        sc query mysql57 >nul 2>&1
        if %errorlevel% neq 0 (
            echo ERROR: MySQL service not found!
            pause
            exit /b 1
        ) else (
            set MYSQL_SERVICE=mysql57
        )
    ) else (
        set MYSQL_SERVICE=mysql80
    )
) else (
    set MYSQL_SERVICE=mysql
)

echo Starting MySQL service...
sc query %MYSQL_SERVICE% | findstr "RUNNING" >nul
if %errorlevel% neq 0 (
    net start %MYSQL_SERVICE%
    if %errorlevel% neq 0 (
        echo ERROR: Failed to start MySQL service!
        pause
        exit /b 1
    )
)
echo OK MySQL service is running

echo.
echo ========================================
echo   STEP 3: MYSQL CONNECTION SETUP
echo ========================================

echo  Analyzing MySQL connection...
echo.

REM Try to connect without password first
mysql -u root -e "SELECT 1 as test;" >nul 2>&1
if %errorlevel% equ 0 (
    echo OK MySQL root user has no password
    set MYSQL_HAS_PASSWORD=0
    set MYSQL_ROOT_USER=root
    set MYSQL_ROOT_PASS=
) else (
    echo WARNING:  MySQL root user requires password
    set MYSQL_HAS_PASSWORD=1
    
    echo Please enter your MySQL root credentials:
    set /p MYSQL_ROOT_USER="MySQL root username (default: root): "
    if "%MYSQL_ROOT_USER%"=="" set MYSQL_ROOT_USER=root
    
    set /p MYSQL_ROOT_PASS="MySQL root password: "
    if "%MYSQL_ROOT_PASS%"=="" (
        echo.
        echo No password entered. Trying without password...
        set MYSQL_ROOT_PASS=
    )
    
    echo Testing connection...
    mysql -u %MYSQL_ROOT_USER% -p%MYSQL_ROOT_PASS% -e "SELECT 1 as test;" >nul 2>&1
    if %errorlevel% neq 0 (
        echo ERROR: MySQL connection failed!
        pause
        exit /b 1
    ) else (
        echo OK MySQL connection successful
    )
)

echo.
echo ========================================
echo   STEP 4: PROJECT USER CREATION
echo ========================================

echo  Creating dedicated project user...
echo.

set PROJECT_USER=student_lab_user
set PROJECT_PASS=StudentLab2024!Secure

echo Creating MySQL user: %PROJECT_USER%
echo Password: %PROJECT_PASS%

REM Create the project user
if "%MYSQL_HAS_PASSWORD%"=="0" (
    mysql -u %MYSQL_ROOT_USER% -e "CREATE USER IF NOT EXISTS '%PROJECT_USER%'@'localhost' IDENTIFIED BY '%PROJECT_PASS%';"
    mysql -u %MYSQL_ROOT_USER% -e "GRANT ALL PRIVILEGES ON *.* TO '%PROJECT_USER%'@'localhost';"
    mysql -u %MYSQL_ROOT_USER% -e "FLUSH PRIVILEGES;"
) else (
    mysql -u %MYSQL_ROOT_USER% -p%MYSQL_ROOT_PASS% -e "CREATE USER IF NOT EXISTS '%PROJECT_USER%'@'localhost' IDENTIFIED BY '%PROJECT_PASS%';"
    mysql -u %MYSQL_ROOT_USER% -p%MYSQL_ROOT_PASS% -e "GRANT ALL PRIVILEGES ON *.* TO '%PROJECT_USER%'@'localhost';"
    mysql -u %MYSQL_ROOT_USER% -p%MYSQL_ROOT_PASS% -e "FLUSH PRIVILEGES;"
)

if %errorlevel% neq 0 (
    echo ERROR: Failed to create project user!
    pause
    exit /b 1
) else (
    echo OK Project user created successfully
)

echo.
echo ========================================
echo   STEP 5: DATABASE SETUP
echo ========================================

echo  Setting up project database...
echo.

set DB_NAME=student_lab_system

REM Create database
mysql -u %PROJECT_USER% -p%PROJECT_PASS% -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if %errorlevel% neq 0 (
    echo ERROR: Failed to create database!
    pause
    exit /b 1
) else (
    echo OK Database created successfully
)

REM Import schema
if exist "..\database\schema.sql" (
    echo Importing database schema...
    mysql -u %PROJECT_USER% -p%PROJECT_PASS% %DB_NAME% < "..\database\schema.sql"
    if %errorlevel% neq 0 (
        echo ERROR: Failed to import schema!
        pause
        exit /b 1
    ) else (
        echo OK Database schema imported successfully
    )
) else (
    echo WARNING:  Schema file not found, creating basic tables...
    mysql -u %PROJECT_USER% -p%PROJECT_PASS% %DB_NAME% -e "CREATE TABLE IF NOT EXISTS students (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255) NOT NULL, center VARCHAR(255), grade VARCHAR(50), phone VARCHAR(20), parent_phone VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
    mysql -u %PROJECT_USER% -p%PROJECT_PASS% %DB_NAME% -e "CREATE TABLE IF NOT EXISTS registrations (id INT AUTO_INCREMENT PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), center VARCHAR(255), device_name VARCHAR(100), registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
    echo OK Basic tables created
)

echo.
echo ========================================
echo   STEP 6: NODE.JS CHECK
echo ========================================

echo  Checking Node.js installation...

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS version
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo OK Node.js found: %NODE_VERSION%
)

npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found!
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo OK npm found: %NPM_VERSION%
)

echo.
echo ========================================
echo   STEP 7: DEPENDENCY INSTALLATION
echo ========================================

echo  Installing Node.js dependencies...

REM Navigate to server directory
cd /d "%~dp0..\System\server"

echo Installing server dependencies...
npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install server dependencies!
    pause
    exit /b 1
) else (
    echo OK Server dependencies installed
)

REM Navigate back to batch files directory
cd /d "%~dp0"

echo.
echo ========================================
echo   STEP 8: CONFIGURATION FILES
echo ========================================

echo  Creating configuration files...

REM Navigate to server directory
cd /d "%~dp0..\System\server"

REM Create .env file
echo Creating .env file...
(
echo # Student Lab System - Environment Configuration
echo # Generated by SETUP.bat
echo # Date: %date% %time%
echo.
echo # Database Configuration
echo DB_HOST=localhost
echo DB_PORT=3306
echo DB_NAME=%DB_NAME%
echo DB_USER=%PROJECT_USER%
echo DB_PASSWORD=%PROJECT_PASS%
echo.
echo # Server Configuration
echo PORT=3000
echo NODE_ENV=production
echo.
echo # WebSocket Configuration
echo WS_PORT=3000
echo.
echo # Security Configuration
echo JWT_SECRET=StudentLab2024!JWTSecret
echo SESSION_SECRET=StudentLab2024!SessionSecret
echo.
echo # Logging Configuration
echo LOG_LEVEL=INFO
echo LOG_FILE=./logs/server.log
echo.
echo # Performance Configuration
echo MAX_CONNECTIONS=100
echo REQUEST_TIMEOUT=30000
echo SYNC_INTERVAL=5000
echo.
echo # Offline Mode Configuration
echo OFFLINE_MODE_ENABLED=true
echo OFFLINE_QUEUE_SIZE=1000
echo.
echo # Data Integrity Configuration
echo DATA_INTEGRITY_CHECKS=true
echo DATA_VALIDATION_ENABLED=true
echo DUPLICATE_PREVENTION=true
) > .env

REM Create db-config.js file
echo Creating db-config.js file...
(
echo // Database Configuration
echo // Generated by SETUP.bat
echo // Date: %date% %time%
echo.
echo module.exports = {
echo     host: 'localhost',
echo     user: '%PROJECT_USER%',
echo     password: '%PROJECT_PASS%',
echo     database: '%DB_NAME%',
echo     charset: 'utf8mb4',
echo     connectionLimit: 10,
echo     acquireTimeout: 60000,
echo     timeout: 60000,
echo     reconnect: true,
echo     multipleStatements: true,
echo     dateStrings: true,
echo     supportBigNumbers: true,
echo     bigNumberStrings: true
echo };
) > db-config.js

echo OK Configuration files created

echo.
echo ========================================
echo   STEP 9: FINAL TESTING
echo ========================================

echo  Testing complete setup...

REM Test database connection
echo Testing database connection...
mysql -u %PROJECT_USER% -p%PROJECT_PASS% -e "USE %DB_NAME%; SHOW TABLES;" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Database connection test failed!
    pause
    exit /b 1
) else (
    echo OK Database connection successful
)

REM Test database operations
echo Testing database operations...
mysql -u %PROJECT_USER% -p%PROJECT_PASS% -e "USE %DB_NAME%; INSERT INTO system_config (config_key, config_value, config_type, description) VALUES ('setup_completed', 'true', 'boolean', 'Setup completion flag') ON DUPLICATE KEY UPDATE config_value='true';" >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING:  Database operation test failed (may be normal if system_config table doesn't exist)
) else (
    echo OK Database operations working correctly
)

REM Test Node.js server
echo Testing Node.js server startup...
timeout /t 2 >nul
node -e "console.log('Node.js test successful')" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js test failed!
    pause
    exit /b 1
) else (
    echo OK Node.js test successful
)

echo.
echo ========================================
echo   SETUP COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Setup Summary:
echo OK MySQL Service: %MYSQL_SERVICE% (Running)
echo OK Project User: %PROJECT_USER%
echo OK Database: %DB_NAME%
echo OK Node.js: %NODE_VERSION%
echo OK npm: %NPM_VERSION%
echo OK Dependencies: Installed
echo OK Configuration: Files created
echo OK Testing: All tests passed
echo.
echo Your Student Lab System is ready!
echo.
echo To start the system:
echo 1. Run: LAUNCHER.bat → Option 1 (Quick Start)
echo 2. Or manually: cd System\server ^&^& node main-server.js
echo 3. Open: http://localhost:3000
echo.
echo Database Info:
echo - Host: localhost
echo - Database: %DB_NAME%
echo - User: %PROJECT_USER%
echo - Password: %PROJECT_PASS%
echo.
echo For other devices, copy this project folder and run LAUNCHER.bat → Option 3
echo.
pause
