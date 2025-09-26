@echo off
title Student Lab System - Complete Setup
color 0A

echo.
echo ========================================
echo   STUDENT LAB SYSTEM - COMPLETE SETUP
echo ========================================
echo.
echo This will set up everything needed for the system:
echo   - Check and install Node.js
echo   - Install all required packages
echo   - Check MySQL connection
echo   - Generate SSL certificates
echo   - Test system functionality
echo.

set /p continue="Continue with setup? (y/n): "
if /i not "%continue%"=="y" (
    echo Setup cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STEP 1: CHECKING NODE.JS
echo ========================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Recommended version: Node.js 18.x or higher
    echo.
    echo After installing Node.js, run this setup again.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js found: %NODE_VERSION%
)

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not available!
    echo Please reinstall Node.js with npm included.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm found: %NPM_VERSION%
)

echo.
echo ========================================
echo   STEP 2: INSTALLING PACKAGES
echo ========================================

REM Navigate to server directory
cd /d "%~dp0..\..\System\server"

echo 📦 Installing server dependencies...
npm install --production --silent
if %errorlevel% neq 0 (
    echo ❌ Failed to install server dependencies!
    echo Trying with verbose output...
    npm install --production
    if %errorlevel% neq 0 (
        echo ❌ Package installation failed!
        pause
        exit /b 1
    )
) else (
    echo ✅ Server dependencies installed successfully
)

REM Navigate to main System directory
cd /d "%~dp0..\..\System"

echo 📦 Installing system dependencies...
npm install --production --silent
if %errorlevel% neq 0 (
    echo ❌ Failed to install system dependencies!
    echo Trying with verbose output...
    npm install --production
    if %errorlevel% neq 0 (
        echo ❌ Package installation failed!
        pause
        exit /b 1
    )
) else (
    echo ✅ System dependencies installed successfully
)

echo.
echo ========================================
echo   STEP 3: CHECKING MYSQL
echo ========================================

REM Check if MySQL is installed
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ MySQL command line client not found!
    echo.
    echo Please ensure MySQL is installed and accessible from command line.
    echo You can install MySQL from: https://dev.mysql.com/downloads/mysql/
    echo.
    echo Alternative: If MySQL is installed but not in PATH, you can:
    echo 1. Add MySQL bin directory to your system PATH
    echo 2. Or use MySQL Workbench to create the database manually
    echo.
    set /p skip_mysql="Skip MySQL check and continue? (y/n): "
    if /i not "%skip_mysql%"=="y" (
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%i in ('mysql --version') do set MYSQL_VERSION=%%i
    echo ✅ MySQL found: %MYSQL_VERSION%
)

REM Test MySQL connection
echo.
echo 🔗 Testing MySQL connection...
echo Please enter your MySQL credentials:
echo.

set /p mysql_user="MySQL Username (default: root): "
if "%mysql_user%"=="" set mysql_user=root

set /p mysql_password="MySQL Password (press Enter if no password): "

REM Test connection
if "%mysql_password%"=="" (
    mysql -u %mysql_user% -e "SELECT 1;" >nul 2>&1
) else (
    mysql -u %mysql_user% -p%mysql_password% -e "SELECT 1;" >nul 2>&1
)

if %errorlevel% neq 0 (
    echo ❌ MySQL connection failed!
    echo.
    echo Common solutions:
    echo 1. Check if MySQL service is running
    echo 2. Verify username and password
    echo 3. Check if MySQL is listening on default port 3306
    echo.
    echo You can start MySQL service with:
    echo   net start mysql
    echo.
    set /p skip_mysql="Skip MySQL setup and continue? (y/n): "
    if /i not "%skip_mysql%"=="y" (
        pause
        exit /b 1
    )
) else (
    echo ✅ MySQL connection successful!
    
    REM Create database
    echo.
    echo 🗄️ Creating database 'student_lab_system'...
    if "%mysql_password%"=="" (
        mysql -u %mysql_user% -e "CREATE DATABASE IF NOT EXISTS student_lab_system;"
    ) else (
        mysql -u %mysql_user% -p%mysql_password% -e "CREATE DATABASE IF NOT EXISTS student_lab_system;"
    )
    
    if %errorlevel% neq 0 (
        echo ❌ Failed to create database!
        echo You may need to create it manually.
    ) else (
        echo ✅ Database 'student_lab_system' created successfully
    )
)

echo.
echo ========================================
echo   STEP 4: GENERATING SSL CERTIFICATES
echo ========================================

REM Navigate to server directory
cd /d "%~dp0..\..\System\server"

echo 🔒 Checking SSL certificates...
if exist "certs\server.crt" if exist "certs\server.key" (
    echo ✅ SSL certificates already exist
) else (
    echo 📜 Generating SSL certificates...
    if exist "generate-ssl-cert.bat" (
        call generate-ssl-cert.bat
        if %errorlevel% neq 0 (
            echo ❌ SSL certificate generation failed!
            echo HTTPS will not be available.
        ) else (
            echo ✅ SSL certificates generated successfully
        )
    ) else (
        echo ❌ SSL certificate generator not found!
        echo HTTPS will not be available.
    )
)

echo.
echo ========================================
echo   STEP 5: TESTING SYSTEM
echo ========================================

echo 🧪 Running system tests...
cd /d "%~dp0..\..\System"

REM Test if main server file exists
if not exist "server\main-server.js" (
    echo ❌ Main server file not found!
    pause
    exit /b 1
)

REM Test if database file exists
if not exist "server\database.js" (
    echo ❌ Database file not found!
    pause
    exit /b 1
)

echo ✅ All system files found

REM Test Node.js syntax
echo 🔍 Testing server syntax...
node -c server\main-server.js
if %errorlevel% neq 0 (
    echo ❌ Server syntax error found!
    pause
    exit /b 1
) else (
    echo ✅ Server syntax is valid
)

echo.
echo ========================================
echo   STEP 6: FINAL VERIFICATION
echo ========================================

echo 📋 System Status:
echo   ✅ Node.js: %NODE_VERSION%
echo   ✅ npm: %NPM_VERSION%
if defined MYSQL_VERSION echo   ✅ MySQL: %MYSQL_VERSION%
echo   ✅ Packages: Installed
echo   ✅ SSL Certificates: Checked
echo   ✅ System Files: Valid

echo.
echo ========================================
echo   SETUP COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo Your system is ready to use!
echo.
echo To start the system:
echo   1. Run: QUICK_START.bat
echo   2. Or run: START_SYSTEM.bat
echo.
echo Access URLs (after starting):
echo   Entry Scanner:  http://localhost:3000/entry-scanner
echo   Exit Validator: http://localhost:3000/exit-validator
echo   Admin Dashboard: http://localhost:3000/admin-dashboard
echo.
echo For HTTPS (phone camera access):
echo   Entry Scanner:  https://localhost:3443/entry-scanner
echo   Exit Validator: https://localhost:3443/exit-validator
echo   Admin Dashboard: https://localhost:3443/admin-dashboard
echo.

set /p start_now="Start the system now? (y/n): "
if /i "%start_now%"=="y" (
    echo.
    echo 🚀 Starting Student Lab System...
    cd /d "%~dp0..\..\"
    call "Batch-Files\System-Control\START_CLEAN_SYSTEM.bat"
) else (
    echo.
    echo Setup completed. You can start the system anytime using QUICK_START.bat
)

echo.
pause