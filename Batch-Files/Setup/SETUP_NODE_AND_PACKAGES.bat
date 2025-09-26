@echo off
title Node.js and Package Setup
color 0B

echo.
echo ========================================
echo   NODE.JS AND PACKAGE SETUP
echo ========================================
echo.

REM Check if Node.js is installed
echo 🔍 Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Recommended version: Node.js 18.x LTS or higher
    echo.
    echo After installation:
    echo 1. Restart your command prompt
    echo 2. Run this script again
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js found: %NODE_VERSION%
)

REM Check npm version
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
echo   INSTALLING PACKAGES
echo ========================================

REM Navigate to System directory
cd /d "%~dp0..\..\System"

echo 📦 Installing system-level packages...
echo This may take a few minutes...

REM Install system packages
npm install --production --silent
if %errorlevel% neq 0 (
    echo ❌ Failed to install system packages!
    echo Trying with verbose output...
    npm install --production
    if %errorlevel% neq 0 (
        echo ❌ System package installation failed!
        echo.
        echo Common solutions:
        echo 1. Check your internet connection
        echo 2. Clear npm cache: npm cache clean --force
        echo 3. Delete node_modules folder and try again
        echo.
        pause
        exit /b 1
    )
) else (
    echo ✅ System packages installed successfully
)

REM Navigate to server directory
cd /d "%~dp0..\..\System\server"

echo 📦 Installing server packages...
npm install --production --silent
if %errorlevel% neq 0 (
    echo ❌ Failed to install server packages!
    echo Trying with verbose output...
    npm install --production
    if %errorlevel% neq 0 (
        echo ❌ Server package installation failed!
        echo.
        echo Common solutions:
        echo 1. Check your internet connection
        echo 2. Clear npm cache: npm cache clean --force
        echo 3. Delete node_modules folder and try again
        echo.
        pause
        exit /b 1
    )
) else (
    echo ✅ Server packages installed successfully
)

echo.
echo ========================================
echo   VERIFYING PACKAGES
echo ========================================

echo 🔍 Checking required packages...

REM Check for required packages
set MISSING_PACKAGES=

REM Check express
npm list express >nul 2>&1
if %errorlevel% neq 0 set MISSING_PACKAGES=%MISSING_PACKAGES% express

REM Check ws
npm list ws >nul 2>&1
if %errorlevel% neq 0 set MISSING_PACKAGES=%MISSING_PACKAGES% ws

REM Check mysql2
npm list mysql2 >nul 2>&1
if %errorlevel% neq 0 set MISSING_PACKAGES=%MISSING_PACKAGES% mysql2

REM Check multer
npm list multer >nul 2>&1
if %errorlevel% neq 0 set MISSING_PACKAGES=%MISSING_PACKAGES% multer

REM Check xlsx
npm list xlsx >nul 2>&1
if %errorlevel% neq 0 set MISSING_PACKAGES=%MISSING_PACKAGES% xlsx

if not "%MISSING_PACKAGES%"=="" (
    echo ❌ Missing packages: %MISSING_PACKAGES%
    echo.
    echo Installing missing packages...
    npm install %MISSING_PACKAGES% --production --silent
    if %errorlevel% neq 0 (
        echo ❌ Failed to install missing packages!
        pause
        exit /b 1
    ) else (
        echo ✅ Missing packages installed successfully
    )
) else (
    echo ✅ All required packages are installed
)

echo.
echo ========================================
echo   PACKAGE SETUP COMPLETED!
echo ========================================
echo.
echo ✅ Node.js: %NODE_VERSION%
echo ✅ npm: %NPM_VERSION%
echo ✅ System packages: Installed
echo ✅ Server packages: Installed
echo ✅ All dependencies: Verified
echo.
echo Your system is ready for package management!
echo.
pause
