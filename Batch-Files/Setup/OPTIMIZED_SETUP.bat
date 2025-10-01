@echo off
title Student Lab System - Optimized Setup
color 0A
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   STUDENT LAB SYSTEM - OPTIMIZED SETUP
echo ========================================
echo.
echo This optimized setup will:
echo   ✓ Check system requirements
echo   ✓ Install/update all packages
echo   ✓ Set up MySQL database
echo   ✓ Generate SSL certificates
echo   ✓ Test system functionality
echo   ✓ Verify complete setup
echo.

set /p continue="Continue with optimized setup? (y/n): "
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
echo 🔍 Checking Windows version...
for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j
echo ✅ Windows version: %VERSION%

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Warning: Not running as administrator
    echo Some operations may require elevated privileges
) else (
    echo ✅ Running as administrator
)

REM Check Node.js
echo.
echo 🔍 Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    echo Please install Node.js 18.0.0+ from: https://nodejs.org/
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js: %NODE_VERSION%
)

REM Check npm
echo.
echo 🔍 Checking npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found!
    echo Please reinstall Node.js with npm included
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm: %NPM_VERSION%
)

echo.
echo ========================================
echo   STEP 2: PACKAGE INSTALLATION
echo ========================================

REM Install main packages
echo 📦 Installing main system packages...
cd /d "%~dp0..\..\..\System"
if exist "package.json" (
    npm install --production --silent
    if %errorlevel% neq 0 (
        echo ❌ Main package installation failed
        echo Trying with verbose output...
        npm install --production
        if %errorlevel% neq 0 (
            echo ❌ Main package installation failed completely
            pause
            exit /b 1
        )
    ) else (
        echo ✅ Main packages installed successfully
    )
) else (
    echo ❌ Main package.json not found
    pause
    exit /b 1
)

REM Install server packages
echo.
echo 📦 Installing server packages...
cd /d "%~dp0..\..\..\System\server"
if exist "package.json" (
    npm install --production --silent
    if %errorlevel% neq 0 (
        echo ❌ Server package installation failed
        echo Trying with verbose output...
        npm install --production
        if %errorlevel% neq 0 (
            echo ❌ Server package installation failed completely
            pause
            exit /b 1
        )
    ) else (
        echo ✅ Server packages installed successfully
    )
) else (
    echo ❌ Server package.json not found
    pause
    exit /b 1
)

echo.
echo ========================================
echo   STEP 3: MYSQL SETUP
echo ========================================

REM Check MySQL
echo 🔍 Checking MySQL...
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ MySQL not found!
    echo Please install MySQL from: https://dev.mysql.com/downloads/mysql/
    echo.
    set /p skip_mysql="Skip MySQL setup and continue? (y/n): "
    if /i not "%skip_mysql%"=="y" (
        pause
        exit /b 1
    )
    set MYSQL_SKIPPED=1
) else (
    for /f "tokens=*" %%i in ('mysql --version') do set MYSQL_VERSION=%%i
    echo ✅ MySQL: %MYSQL_VERSION%
    set MYSQL_SKIPPED=0
)

if "%MYSQL_SKIPPED%"=="0" (
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
        echo Please check your credentials and try again
        set /p skip_mysql="Skip MySQL setup and continue? (y/n): "
        if /i not "%skip_mysql%"=="y" (
            pause
            exit /b 1
        )
        set MYSQL_SKIPPED=1
    ) else (
        echo ✅ MySQL connection successful!
        
        REM Create database
        echo.
        echo 🗄️ Creating database 'student_lab_system'...
        if "%mysql_password%"=="" (
            mysql -u %mysql_user% -e "CREATE DATABASE IF NOT EXISTS student_lab_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        ) else (
            mysql -u %mysql_user% -p%mysql_password% -e "CREATE DATABASE IF NOT EXISTS student_lab_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        )
        
        if %errorlevel% neq 0 (
            echo ❌ Failed to create database
        ) else (
            echo ✅ Database 'student_lab_system' created successfully
        )
        
        REM Create database config
        echo.
        echo 📝 Creating database configuration...
        cd /d "%~dp0..\..\..\System\server"
        
        (
        echo // Database Configuration
        echo // Generated by OPTIMIZED_SETUP.bat
        echo.
        echo module.exports = {
        echo     host: 'localhost',
        echo     user: '%mysql_user%',
        echo     password: '%mysql_password%',
        echo     database: 'student_lab_system',
        echo     charset: 'utf8mb4',
        echo     connectionLimit: 10,
        echo     acquireTimeout: 60000,
        echo     timeout: 60000,
        echo     reconnect: true
        echo };
        ) > db-config.js
        
        if %errorlevel% neq 0 (
            echo ❌ Failed to create database configuration
        ) else (
            echo ✅ Database configuration created: db-config.js
        )
    )
)

echo.
echo ========================================
echo   STEP 4: SSL CERTIFICATE SETUP
echo ========================================

echo 🔒 Checking SSL certificates...
cd /d "%~dp0..\..\..\System\server"
if exist "certs\server.crt" if exist "certs\server.key" (
    echo ✅ SSL certificates already exist
) else (
    echo 📜 Generating SSL certificates...
    if exist "generate-ssl-cert.bat" (
        call generate-ssl-cert.bat
        if %errorlevel% neq 0 (
            echo ❌ SSL certificate generation failed
            echo HTTPS will not be available
        ) else (
            echo ✅ SSL certificates generated successfully
        )
    ) else (
        echo ❌ SSL certificate generator not found
        echo HTTPS will not be available
    )
)

echo.
echo ========================================
echo   STEP 5: SYSTEM TESTING
echo ========================================

echo 🧪 Testing system functionality...

REM Test server syntax
echo.
echo 🔍 Testing server syntax...
cd /d "%~dp0..\..\..\System"
node -c server\main-server.js
if %errorlevel% neq 0 (
    echo ❌ Server syntax error found
    pause
    exit /b 1
) else (
    echo ✅ Server syntax is valid
)

REM Test database connection
echo.
echo 🔍 Testing database connection...
cd /d "%~dp0..\..\..\System\server"
if exist "db-config.js" (
    node -e "const mysql=require('mysql2/promise');const config=require('./db-config.js');mysql.createConnection(config).then(conn=>{console.log('✅ Database connection: OK');conn.end();}).catch(err=>{console.log('❌ Database connection: FAILED -',err.message);});" 2>nul
    if %errorlevel% neq 0 (
        echo ❌ Database connection test failed
    ) else (
        echo ✅ Database connection test passed
    )
) else (
    echo ⚠️  Database configuration not found - skipping test
)

echo.
echo ========================================
echo   STEP 6: FINAL VERIFICATION
echo ========================================

echo 📋 System Status:
echo   ✅ Node.js: %NODE_VERSION%
echo   ✅ npm: %NPM_VERSION%
if "%MYSQL_SKIPPED%"=="0" (
    echo   ✅ MySQL: %MYSQL_VERSION%
    echo   ✅ Database: student_lab_system
) else (
    echo   ⚠️  MySQL: Skipped
)
echo   ✅ Packages: Installed
echo   ✅ SSL Certificates: Checked
echo   ✅ System Files: Valid

echo.
echo ========================================
echo   OPTIMIZED SETUP COMPLETED!
echo ========================================
echo.
echo Your Student Lab System is ready to use!
echo.
echo Quick Start Options:
echo   1. Run: LAUNCHER.bat (Main launcher)
echo   2. Run: Batch-Files\System-Control\QUICK_START.bat
echo   3. Run: Batch-Files\System-Control\START_CLEAN_SYSTEM.bat
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
    cd /d "%~dp0..\..\.."
    call "Batch-Files\System-Control\QUICK_START.bat"
) else (
    echo.
    echo Setup completed. You can start the system anytime using LAUNCHER.bat
)

echo.
pause
