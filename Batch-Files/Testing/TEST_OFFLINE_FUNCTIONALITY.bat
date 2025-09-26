@echo off
echo ========================================
echo   Offline Functionality Test Suite
echo   Student Lab System
echo ========================================
echo.

echo This test suite verifies that the system works
echo completely offline without any internet connection
echo or server connection.
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
echo Starting offline functionality tests...
echo This will test:
echo   - Entry Scanner offline operation
echo   - Exit Validator offline operation
echo   - Manual student entry offline
echo   - QR code scanning offline
echo   - Data persistence and synchronization
echo   - LocalStorage functionality
echo.

cd /d "%~dp0..\..\System"
node test-offline-functionality.js

echo.
echo Offline functionality test completed.
echo Check the results above.
echo.
echo IMPORTANT: To fully test offline functionality:
echo 1. Start the server: START_CLEAN_SYSTEM.bat
echo 2. Open Entry Scanner in browser
echo 3. Disconnect internet/WiFi
echo 4. Try scanning QR codes and manual entry
echo 5. Reconnect internet and verify data syncs
echo.
pause
