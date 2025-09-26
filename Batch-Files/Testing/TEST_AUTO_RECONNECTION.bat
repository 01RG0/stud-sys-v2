@echo off
echo ========================================
echo   Auto-Reconnection Test Suite
echo   Student Lab System
echo ========================================
echo.

echo Checking if Node.js is installed...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version

echo.
echo Checking if server is running...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Server is not running on localhost:3000
    echo Please start the server first using START_CLEAN_SYSTEM.bat
    echo.
    echo Do you want to continue with the test anyway? (y/n)
    set /p continue=
    if /i not "%continue%"=="y" (
        echo Test cancelled.
        pause
        exit /b 1
    )
)

echo.
echo Starting auto-reconnection tests...
echo This will test:
echo   - Server connection
echo   - WebSocket reconnection for Entry Scanner
echo   - WebSocket reconnection for Exit Validator  
echo   - WebSocket reconnection for Admin Dashboard
echo   - Device discovery functionality
echo.

cd /d "%~dp0..\..\System"
node test-auto-reconnection.js

echo.
echo Test completed. Check the results above.
echo.
pause
