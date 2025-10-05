@echo off
title Student Lab System - Package Manager
color 0B
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   STUDENT LAB SYSTEM - PACKAGE MANAGER
echo ========================================
echo.
echo This script will:
echo   ✓ Check all required packages
echo   ✓ Download and install missing packages
echo   ✓ Update existing packages
echo   ✓ Verify package compatibility
echo   ✓ Clean up old/unused packages
echo.

set /p continue="Continue with package management? (y/n): "
if "%continue%"=="" (
    echo.
    echo No input received. Exiting...
    timeout /t 2 >nul
    exit /b 0
)
if /i not "%continue%"=="y" (
    echo Package management cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STEP 1: SYSTEM PACKAGES CHECK
echo ========================================

echo  Checking system packages...

REM Check Node.js
echo Checking Node.js...
timeout /t 1 >nul
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found!
    set NODE_MISSING=1
) else (
    for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
    if "%NODE_VERSION%"=="" (
        echo ERROR: Node.js version check failed!
        set NODE_MISSING=1
    ) else (
        echo OK Node.js: %NODE_VERSION%
        set NODE_MISSING=0
    )
)

REM Check npm
echo Checking npm...
timeout /t 1 >nul
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm not found!
    set NPM_MISSING=1
) else (
    for /f "tokens=*" %%i in ('npm --version 2^>nul') do set NPM_VERSION=%%i
    if "%NPM_VERSION%"=="" (
        echo ERROR: npm version check failed!
        set NPM_MISSING=1
    ) else (
        echo OK npm: %NPM_VERSION%
        set NPM_MISSING=0
    )
)

REM Check MySQL
echo Checking MySQL...
timeout /t 1 >nul
mysql --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: MySQL not found!
    set MYSQL_MISSING=1
) else (
    for /f "tokens=*" %%i in ('mysql --version 2^>nul') do set MYSQL_VERSION=%%i
    if "%MYSQL_VERSION%"=="" (
        echo ERROR: MySQL version check failed!
        set MYSQL_MISSING=1
    ) else (
        echo OK MySQL: %MYSQL_VERSION%
        set MYSQL_MISSING=0
    )
)

echo.
echo ========================================
echo   STEP 2: MISSING PACKAGES INSTALLATION
echo ========================================

if "%NODE_MISSING%"=="1" (
    echo  Node.js is missing!
    echo.
    echo Please install Node.js manually:
    echo 1. Go to: https://nodejs.org/
    echo 2. Download the LTS version
    echo 3. Run the installer
    echo 4. Restart this script
    echo.
    pause
    exit /b 1
)

if "%MYSQL_MISSING%"=="1" (
    echo  MySQL is missing!
    echo.
    echo Please install MySQL manually:
    echo 1. Go to: https://dev.mysql.com/downloads/mysql/
    echo 2. Download MySQL Community Server
    echo 3. Run the installer
    echo 4. Or use XAMPP: https://www.apachefriends.org/
    echo.
    pause
    exit /b 1
)

echo OK All system packages are available

echo.
echo ========================================
echo   STEP 3: NODE.JS DEPENDENCIES CHECK
echo ========================================

echo  Checking Node.js dependencies...

REM Navigate to server directory
cd /d "%~dp0..\System\server"

REM Check if package.json exists
if not exist "package.json" (
    echo ERROR: package.json not found in server directory!
    echo Please ensure the project files are complete
    pause
    exit /b 1
)

echo OK package.json found

REM Check if node_modules exists
if not exist "node_modules" (
    echo WARNING:  node_modules not found - dependencies need to be installed
    set DEPENDENCIES_MISSING=1
) else (
    echo OK node_modules directory exists
    set DEPENDENCIES_MISSING=0
)

echo.
echo ========================================
echo   STEP 4: DEPENDENCY INSTALLATION
echo ========================================

if "%DEPENDENCIES_MISSING%"=="1" (
    echo  Installing Node.js dependencies...
    echo This may take a few minutes...
    echo.
    
    echo Starting npm install (this may take several minutes)...
    echo If this appears to freeze, press Ctrl+C to cancel
    timeout /t 2 >nul
    npm install --no-optional --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies!
        echo.
        echo Common solutions:
        echo 1. Check internet connection
        echo 2. Clear npm cache: npm cache clean --force
        echo 3. Delete node_modules and package-lock.json, then try again
        echo 4. Run as administrator
        echo.
        pause
        exit /b 1
    ) else (
        echo OK Dependencies installed successfully
    )
) else (
    echo  Updating existing dependencies...
    echo.
    
    echo Starting npm update...
    timeout /t 2 >nul
    npm update --no-optional --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo WARNING:  Some packages could not be updated
    ) else (
        echo OK Dependencies updated successfully
    )
)

echo.
echo ========================================
echo   STEP 5: PACKAGE VERIFICATION
echo ========================================

echo  Verifying installed packages...

REM Check critical packages
set CRITICAL_PACKAGES=express mysql2 cors multer xlsx ws dotenv

for %%p in (%CRITICAL_PACKAGES%) do (
    echo Checking %%p...
    timeout /t 1 >nul
    npm list %%p --depth=0 >nul 2>&1
    if !errorlevel! neq 0 (
        echo ERROR: %%p is missing or not properly installed
        set PACKAGE_ERROR=1
    ) else (
        echo OK %%p is installed
    )
)

if defined PACKAGE_ERROR (
    echo.
    echo ERROR: Some critical packages are missing!
    echo Attempting to reinstall...
    echo Reinstalling packages...
    timeout /t 2 >nul
    npm install --no-optional --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo ERROR: Reinstallation failed!
        pause
        exit /b 1
    ) else (
        echo OK Packages reinstalled successfully
    )
)

echo.
echo ========================================
echo   STEP 6: PACKAGE CLEANUP
echo ========================================

echo  Cleaning up packages...

REM Clear npm cache
echo Clearing npm cache...
timeout /t 1 >nul
npm cache clean --force >nul 2>&1
echo OK npm cache cleared

REM Check for outdated packages
echo Checking for outdated packages...
timeout /t 1 >nul
npm outdated --depth=0 >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING:  Some packages are outdated
    echo Run 'npm update' to update them
) else (
    echo OK All packages are up to date
)

REM Check for vulnerabilities
echo Checking for security vulnerabilities...
timeout /t 1 >nul
npm audit --audit-level=moderate >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING:  Some security vulnerabilities found
    echo Run 'npm audit fix' to fix them
) else (
    echo OK No security vulnerabilities found
)

echo.
echo ========================================
echo   STEP 7: COMPATIBILITY CHECK
echo ========================================

echo  Checking package compatibility...

REM Check Node.js version compatibility
echo Checking Node.js version compatibility...
for /f "tokens=1" %%i in ('node --version') do set NODE_MAJOR=%%i
set NODE_MAJOR=%NODE_MAJOR:v=%

if %NODE_MAJOR% lss 16 (
    echo WARNING:  Node.js version %NODE_VERSION% may not be fully compatible
    echo Recommended: Node.js 16 or higher
) else (
    echo OK Node.js version is compatible
)

REM Check npm version
echo Checking npm version compatibility...
for /f "tokens=1" %%i in ('npm --version') do set NPM_MAJOR=%%i

if %NPM_MAJOR% lss 8 (
    echo WARNING:  npm version %NPM_VERSION% may not be fully compatible
    echo Recommended: npm 8 or higher
) else (
    echo OK npm version is compatible
)

echo.
echo ========================================
echo   STEP 8: FINAL VERIFICATION
echo ========================================

echo  Final package verification...

REM Test Node.js
echo Testing Node.js...
timeout /t 1 >nul
node -e "console.log('Node.js test: OK')" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js test failed!
    pause
    exit /b 1
) else (
    echo OK Node.js test passed
)

REM Test npm
echo Testing npm...
timeout /t 1 >nul
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm test failed!
    pause
    exit /b 1
) else (
    echo OK npm test passed
)

REM Test critical modules
echo Testing critical modules...
timeout /t 1 >nul
node -e "require('express'); console.log('Express: OK')" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Express module test failed!
    pause
    exit /b 1
) else (
    echo OK Express module test passed
)

timeout /t 1 >nul
node -e "require('mysql2'); console.log('MySQL2: OK')" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: MySQL2 module test failed!
    pause
    exit /b 1
) else (
    echo OK MySQL2 module test passed
)

echo.
echo ========================================
echo   PACKAGE MANAGEMENT COMPLETED!
echo ========================================
echo.
echo Package Summary:
echo OK Node.js: %NODE_VERSION%
echo OK npm: %NPM_VERSION%
echo OK MySQL: %MYSQL_VERSION%
echo OK Dependencies: Installed and verified
echo OK Compatibility: Checked
echo OK Security: Audited
echo.
echo All packages are ready!
echo.
echo Next steps:
echo 1. Run SETUP.bat to configure the system
echo 2. Run START.bat to start the server
echo.
echo For troubleshooting:
echo - Check internet connection
echo - Run as administrator
echo - Clear npm cache: npm cache clean --force
echo.
pause
