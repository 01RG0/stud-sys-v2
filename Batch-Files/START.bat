@echo off
title Student Lab System v2 - Enhanced Start
color 0A
setlocal enabledelayedexpansion

REM ========================================
REM Student Lab System v2 - Enhanced Start Script
REM ========================================
REM This script provides intelligent system startup with auto-detection,
REM comprehensive checks, and user-friendly interface

echo.
echo ========================================
echo   Student Lab System v2 - Enhanced Start
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "System\server" (
    echo ERROR: System\server directory not found!
    echo Please run this script from the project root directory.
    pause
    exit /b 1
)

REM Change to server directory
cd /d "%~dp0..\..\System\server"

REM Check for required files
echo Checking system requirements...
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Make sure you're in the System\server directory
    pause
    exit /b 1
)

if not exist "main-server.js" (
    echo ERROR: main-server.js not found!
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo WARNING: node_modules not found!
    echo Dependencies may not be installed.
    echo Run 'npm install' first if needed.
    echo.
)

if not exist ".env" (
    echo WARNING: .env file not found!
    echo Environment configuration may be missing.
    echo Run the setup script first if needed.
    echo.
)

echo ✅ System requirements checked
echo.

REM Get the real IP address
echo Detecting system IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do set REAL_IP=%%b
)
if "%REAL_IP%"=="" set REAL_IP=localhost

echo ✅ System IP detected: %REAL_IP%
echo.

REM Check for SSL certificates
set SSL_ENABLED=false
if exist "certs\server.key" if exist "certs\server.crt" (
    set SSL_ENABLED=true
    echo ✅ SSL certificates found - HTTPS will be enabled
    echo.
    echo The system will start with:
    echo   • HTTP server on port 3000
    echo   • HTTPS server on port 3443 (for phone camera access)
    echo   • WebSocket on port 3001
    echo   • Secure WebSocket on port 3444
    echo   • Clean organized structure
    echo.
) else (
    echo ⚠️  SSL certificates not found!
    echo    certs\server.key or certs\server.crt missing
    echo.
    echo HTTPS will be disabled. Only HTTP will work.
    echo.
    echo To enable HTTPS, run: SSL-CERT.bat
    echo.
    echo The system will start with:
    echo   • HTTP server on port 3000 only
    echo   • WebSocket on port 3001
    echo   • Clean organized structure
    echo.
)

REM Check port availability
echo Checking port availability...
netstat -an | findstr ":3000 " >nul
if %errorlevel% equ 0 (
    echo WARNING: Port 3000 is already in use
) else (
    echo ✅ Port 3000 is available
)

netstat -an | findstr ":3443 " >nul
if %errorlevel% equ 0 (
    echo WARNING: Port 3443 is already in use
) else (
    echo ✅ Port 3443 is available
)

netstat -an | findstr ":3001 " >nul
if %errorlevel% equ 0 (
    echo WARNING: Port 3001 is already in use
) else (
    echo ✅ Port 3001 is available
)

netstat -an | findstr ":3444 " >nul
if %errorlevel% equ 0 (
    echo WARNING: Port 3444 is already in use
) else (
    echo ✅ Port 3444 is available
)

echo.

REM Display system information
echo ========================================
echo   SYSTEM INFORMATION
echo ========================================
echo.
echo System IP: %REAL_IP%
echo HTTP Port: 3000
echo HTTPS Port: 3443
echo WebSocket Port: 3001
echo Secure WebSocket Port: 3444
echo SSL Enabled: %SSL_ENABLED%
echo.

REM Display access URLs
echo ========================================
echo   ACCESS URLs - Your IP: %REAL_IP%
echo ========================================
echo.

if "%SSL_ENABLED%"=="true" (
    echo 🔒 HTTPS URLs (Recommended for phones):
    echo     Entry Scanner:  https://%REAL_IP%:3443/entry-scanner
    echo     Exit Validator: https://%REAL_IP%:3443/exit-validator
    echo     Admin Dashboard: https://%REAL_IP%:3443/admin-dashboard
    echo.
    echo 🌐 HTTP URLs (For local computers):
    echo     Entry Scanner:  http://%REAL_IP%:3000/entry-scanner
    echo     Exit Validator: http://%REAL_IP%:3000/exit-validator
    echo     Admin Dashboard: http://%REAL_IP%:3000/admin-dashboard
    echo.
    echo 📱 For phone camera access, use HTTPS URLs above
    echo.
) else (
    echo 🌐 HTTP URLs (Only option without SSL):
    echo     Entry Scanner:  http://%REAL_IP%:3000/entry-scanner
    echo     Exit Validator: http://%REAL_IP%:3000/exit-validator
    echo     Admin Dashboard: http://%REAL_IP%:3000/admin-dashboard
    echo.
    echo ⚠️  Note: Phone cameras require HTTPS. Run SSL-CERT.bat first.
    echo.
)

REM Ask for confirmation
echo ========================================
echo   START CONFIRMATION
echo ========================================
echo.
set /p start_confirm="Start the server now? (y/n): "
if /i "%start_confirm%" neq "y" (
    echo Start cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STARTING SERVER
echo ========================================
echo.

if "%SSL_ENABLED%"=="true" (
    echo Starting server with SSL support...
    echo • HTTP server on port 3000
    echo • HTTPS server on port 3443
    echo • WebSocket on port 3001
    echo • Secure WebSocket on port 3444
) else (
    echo Starting server in HTTP-only mode...
    echo • HTTP server on port 3000
    echo • WebSocket on port 3001
)

echo.
echo Press Ctrl+C to stop the server when done.
echo.

REM Start the server
npm run dev-simple

echo.
echo ========================================
echo   SERVER STOPPED
echo ========================================
echo.
echo System stopped successfully.
echo Thank you for using Student Lab System v2
echo.
pause