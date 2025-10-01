@echo off
title Comprehensive Error Fix - Student Lab System
color 0C
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   COMPREHENSIVE ERROR FIX TOOL
echo ========================================
echo.
echo This tool will diagnose and fix common issues
echo in the Student Lab System.
echo.

set /p continue="Continue with error diagnosis and fix? (y/n): "
if /i not "%continue%"=="y" (
    echo Error fix cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STEP 1: SYSTEM DIAGNOSIS
echo ========================================

echo 🔍 Running comprehensive system diagnosis...

REM Check Node.js
echo.
echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found - CRITICAL ERROR
    set NODE_ERROR=1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js found: %NODE_VERSION%
    set NODE_ERROR=0
)

REM Check npm
echo.
echo Checking npm installation...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found - CRITICAL ERROR
    set NPM_ERROR=1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm found: %NPM_VERSION%
    set NPM_ERROR=0
)

REM Check MySQL
echo.
echo Checking MySQL installation...
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ MySQL not found - DATABASE ERROR
    set MYSQL_ERROR=1
) else (
    for /f "tokens=*" %%i in ('mysql --version') do set MYSQL_VERSION=%%i
    echo ✅ MySQL found: %MYSQL_VERSION%
    set MYSQL_ERROR=0
)

REM Check system files
echo.
echo Checking system files...
cd /d "%~dp0..\..\..\System"

if exist "server\main-server.js" (
    echo ✅ Main server file: OK
    set SERVER_FILE_ERROR=0
) else (
    echo ❌ Main server file: MISSING
    set SERVER_FILE_ERROR=1
)

if exist "server\database.js" (
    echo ✅ Database module: OK
    set DATABASE_FILE_ERROR=0
) else (
    echo ❌ Database module: MISSING
    set DATABASE_FILE_ERROR=1
)

if exist "server\db-config.js" (
    echo ✅ Database config: OK
    set DB_CONFIG_ERROR=0
) else (
    echo ❌ Database config: MISSING
    set DB_CONFIG_ERROR=1
)

if exist "web-interface\pages\Entry-Scanner.html" (
    echo ✅ Entry Scanner: OK
    set ENTRY_SCANNER_ERROR=0
) else (
    echo ❌ Entry Scanner: MISSING
    set ENTRY_SCANNER_ERROR=1
)

if exist "web-interface\pages\Exit-Validator.html" (
    echo ✅ Exit Validator: OK
    set EXIT_VALIDATOR_ERROR=0
) else (
    echo ❌ Exit Validator: MISSING
    set EXIT_VALIDATOR_ERROR=1
)

REM Check SSL certificates
echo.
echo Checking SSL certificates...
if exist "server\certs\server.crt" if exist "server\certs\server.key" (
    echo ✅ SSL certificates: OK
    set SSL_ERROR=0
) else (
    echo ❌ SSL certificates: MISSING
    set SSL_ERROR=1
)

REM Check package files
echo.
echo Checking package files...
if exist "package.json" (
    echo ✅ Main package.json: OK
    set MAIN_PACKAGE_ERROR=0
) else (
    echo ❌ Main package.json: MISSING
    set MAIN_PACKAGE_ERROR=1
)

if exist "server\package.json" (
    echo ✅ Server package.json: OK
    set SERVER_PACKAGE_ERROR=0
) else (
    echo ❌ Server package.json: MISSING
    set SERVER_PACKAGE_ERROR=1
)

echo.
echo ========================================
echo   STEP 2: ERROR ANALYSIS
echo ========================================

echo 📊 Analyzing errors...

set TOTAL_ERRORS=0
set CRITICAL_ERRORS=0

if %NODE_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    set /a CRITICAL_ERRORS+=1
    echo ❌ CRITICAL: Node.js not installed
)

if %NPM_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    set /a CRITICAL_ERRORS+=1
    echo ❌ CRITICAL: npm not available
)

if %MYSQL_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    echo ⚠️  WARNING: MySQL not found
)

if %SERVER_FILE_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    set /a CRITICAL_ERRORS+=1
    echo ❌ CRITICAL: Main server file missing
)

if %DATABASE_FILE_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    set /a CRITICAL_ERRORS+=1
    echo ❌ CRITICAL: Database module missing
)

if %DB_CONFIG_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    echo ⚠️  WARNING: Database config missing
)

if %ENTRY_SCANNER_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    echo ⚠️  WARNING: Entry Scanner missing
)

if %EXIT_VALIDATOR_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    echo ⚠️  WARNING: Exit Validator missing
)

if %SSL_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    echo ⚠️  WARNING: SSL certificates missing
)

if %MAIN_PACKAGE_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    echo ⚠️  WARNING: Main package.json missing
)

if %SERVER_PACKAGE_ERROR%==1 (
    set /a TOTAL_ERRORS+=1
    echo ⚠️  WARNING: Server package.json missing
)

echo.
echo 📈 Error Summary:
echo   Total Errors: %TOTAL_ERRORS%
echo   Critical Errors: %CRITICAL_ERRORS%
echo   Warnings: %TOTAL_ERRORS%-%CRITICAL_ERRORS%

if %CRITICAL_ERRORS% gtr 0 (
    echo.
    echo ❌ CRITICAL ERRORS FOUND - System cannot run
    echo Please fix critical errors before continuing.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   STEP 3: AUTOMATIC FIXES
echo ========================================

echo 🔧 Applying automatic fixes...

REM Fix package.json issues
if %MAIN_PACKAGE_ERROR%==1 (
    echo.
    echo 📦 Creating main package.json...
    cd /d "%~dp0..\..\..\System"
    (
    echo {
    echo   "name": "student-lab-system",
    echo   "version": "2.0.0",
    echo   "description": "Advanced Student Lab Management System",
    echo   "main": "server/main-server.js",
    echo   "scripts": {
    echo     "start": "node server/main-server.js",
    echo     "dev": "node server/main-server.js",
    echo     "test": "echo \"Error: no test specified\" && exit 1"
    echo   },
    echo   "keywords": ["student-management", "qr-scanner", "mysql", "express"],
    echo   "author": "Student Lab System Team",
    echo   "license": "MIT",
    echo   "type": "commonjs",
    echo   "dependencies": {
    echo     "cors": "^2.8.5",
    echo     "dotenv": "^16.3.1",
    echo     "express": "^4.18.2",
    echo     "multer": "^2.0.0",
    echo     "mysql2": "^3.6.5",
    echo     "ws": "^8.18.3",
    echo     "xlsx": "^0.18.5"
    echo   },
    echo   "engines": {
    echo     "node": ">=16.0.0"
    echo   }
    echo }
    ) > package.json
    echo ✅ Main package.json created
)

if %SERVER_PACKAGE_ERROR%==1 (
    echo.
    echo 📦 Creating server package.json...
    cd /d "%~dp0..\..\..\System\server"
    (
    echo {
    echo   "name": "student-lab-system-server",
    echo   "version": "2.0.0",
    echo   "description": "Student Lab Management System Server",
    echo   "main": "main-server.js",
    echo   "scripts": {
    echo     "start": "node main-server.js",
    echo     "dev": "nodemon main-server.js",
    echo     "test": "echo \"Error: no test specified\" && exit 1"
    echo   },
    echo   "keywords": ["student", "lab", "qr-scanner", "management"],
    echo   "author": "Student Lab System Team",
    echo   "license": "MIT",
    echo   "type": "commonjs",
    echo   "dependencies": {
    echo     "cors": "^2.8.5",
    echo     "dotenv": "^16.6.1",
    echo     "express": "^4.18.2",
    echo     "multer": "^2.0.2",
    echo     "mysql2": "^3.15.1",
    echo     "ws": "^8.18.3",
    echo     "xlsx": "^0.18.5"
    echo   },
    echo   "devDependencies": {
    echo     "nodemon": "^3.1.10"
    echo   },
    echo   "engines": {
    echo     "node": ">=16.0.0"
    echo   }
    echo }
    ) > package.json
    echo ✅ Server package.json created
)

REM Fix database config
if %DB_CONFIG_ERROR%==1 (
    echo.
    echo 🗄️ Creating database configuration...
    cd /d "%~dp0..\..\..\System\server"
    (
    echo // Database Configuration
    echo // Generated by COMPREHENSIVE_ERROR_FIX.bat
    echo.
    echo module.exports = {
    echo     host: 'localhost',
    echo     user: 'root',
    echo     password: '',
    echo     database: 'student_lab_system',
    echo     charset: 'utf8mb4',
    echo     connectionLimit: 10,
    echo     acquireTimeout: 60000,
    echo     timeout: 60000,
    echo     reconnect: true
    echo };
    ) > db-config.js
    echo ✅ Database configuration created
)

REM Fix SSL certificates
if %SSL_ERROR%==1 (
    echo.
    echo 🔒 Generating SSL certificates...
    cd /d "%~dp0..\..\..\System\server"
    if exist "generate-ssl-cert.bat" (
        call generate-ssl-cert.bat
        if %errorlevel% neq 0 (
            echo ❌ SSL certificate generation failed
        ) else (
            echo ✅ SSL certificates generated
        )
    ) else (
        echo ❌ SSL certificate generator not found
    )
)

echo.
echo ========================================
echo   STEP 4: PACKAGE INSTALLATION
echo ========================================

echo 📦 Installing/updating packages...

REM Install main packages
echo.
echo Installing main system packages...
cd /d "%~dp0..\..\..\System"
npm install --production --silent
if %errorlevel% neq 0 (
    echo ❌ Main package installation failed
    echo Trying with verbose output...
    npm install --production
    if %errorlevel% neq 0 (
        echo ❌ Main package installation failed completely
    ) else (
        echo ✅ Main packages installed successfully
    )
) else (
    echo ✅ Main packages installed successfully
)

REM Install server packages
echo.
echo Installing server packages...
cd /d "%~dp0..\..\..\System\server"
npm install --production --silent
if %errorlevel% neq 0 (
    echo ❌ Server package installation failed
    echo Trying with verbose output...
    npm install --production
    if %errorlevel% neq 0 (
        echo ❌ Server package installation failed completely
    ) else (
        echo ✅ Server packages installed successfully
    )
) else (
    echo ✅ Server packages installed successfully
)

echo.
echo ========================================
echo   STEP 5: SYSTEM VALIDATION
echo ========================================

echo 🧪 Validating system...

REM Test server syntax
echo.
echo Testing server syntax...
cd /d "%~dp0..\..\..\System"
node -c server\main-server.js
if %errorlevel% neq 0 (
    echo ❌ Server syntax errors found
    set SYNTAX_ERROR=1
) else (
    echo ✅ Server syntax is valid
    set SYNTAX_ERROR=0
)

REM Test database connection
echo.
echo Testing database connection...
cd /d "%~dp0..\..\..\System\server"
if exist "db-config.js" (
    node -e "const mysql=require('mysql2/promise');const config=require('./db-config.js');mysql.createConnection(config).then(conn=>{console.log('✅ Database connection: OK');conn.end();}).catch(err=>{console.log('❌ Database connection: FAILED -',err.message);});" 2>nul
    if %errorlevel% neq 0 (
        set DB_CONNECTION_ERROR=1
    ) else (
        set DB_CONNECTION_ERROR=0
    )
) else (
    echo ❌ Database configuration not found
    set DB_CONNECTION_ERROR=1
)

echo.
echo ========================================
echo   STEP 6: FINAL REPORT
echo ========================================

echo 📋 Final Error Fix Report:
echo.

set REMAINING_ERRORS=0

if %NODE_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ❌ Node.js not installed - MANUAL FIX REQUIRED
    echo    Solution: Install Node.js from https://nodejs.org/
)

if %NPM_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ❌ npm not available - MANUAL FIX REQUIRED
    echo    Solution: Reinstall Node.js with npm included
)

if %MYSQL_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ⚠️  MySQL not found - MANUAL FIX REQUIRED
    echo    Solution: Install MySQL from https://dev.mysql.com/downloads/mysql/
)

if %SERVER_FILE_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ❌ Main server file missing - MANUAL FIX REQUIRED
    echo    Solution: Restore from backup or reinstall system
)

if %DATABASE_FILE_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ❌ Database module missing - MANUAL FIX REQUIRED
    echo    Solution: Restore from backup or reinstall system
)

if %ENTRY_SCANNER_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ⚠️  Entry Scanner missing - MANUAL FIX REQUIRED
    echo    Solution: Restore from backup or reinstall system
)

if %EXIT_VALIDATOR_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ⚠️  Exit Validator missing - MANUAL FIX REQUIRED
    echo    Solution: Restore from backup or reinstall system
)

if %SYNTAX_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ❌ Server syntax errors - MANUAL FIX REQUIRED
    echo    Solution: Check server code for syntax errors
)

if %DB_CONNECTION_ERROR%==1 (
    set /a REMAINING_ERRORS+=1
    echo ⚠️  Database connection failed - MANUAL FIX REQUIRED
    echo    Solution: Check MySQL installation and configuration
)

echo.
echo 📊 Fix Summary:
echo   Errors Fixed: %TOTAL_ERRORS%-%REMAINING_ERRORS%
echo   Remaining Errors: %REMAINING_ERRORS%

if %REMAINING_ERRORS%==0 (
    echo.
    echo ✅ ALL ERRORS FIXED! System is ready to use.
    echo.
    echo You can now:
    echo 1. Run QUICK_START.bat to start the system
    echo 2. Run MASTER_SETUP.bat for complete setup
    echo 3. Access the system at http://localhost:3000
) else (
    echo.
    echo ⚠️  Some errors remain and require manual intervention.
    echo Please address the remaining errors before using the system.
)

echo.
echo ========================================
echo   ERROR FIX COMPLETED
echo ========================================
echo.

set /p test_system="Test the system now? (y/n): "
if /i "%test_system%"=="y" (
    echo.
    echo 🧪 Testing system startup...
    cd /d "%~dp0..\..\..\System"
    timeout /t 3 >nul
    start "System Test" cmd /k "node server/main-server.js"
    echo ✅ System test started in new window
    echo Check the new window for any startup errors.
)

echo.
pause
