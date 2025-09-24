@echo off
echo ========================================
echo   Student Lab System - HTTP Only
echo ========================================
echo.

cd /d "%~dp0System\server"

echo Checking system...
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

echo ✅ Files found, starting HTTP-only system...
echo.

REM Temporarily disable HTTPS by moving certificates
if exist "certs\server.key" (
    echo 🔧 Temporarily disabling HTTPS certificates...
    if not exist "certs\backup" mkdir "certs\backup"
    move "certs\server.key" "certs\backup\server.key.backup" >nul 2>&1
    move "certs\server.crt" "certs\backup\server.crt.backup" >nul 2>&1
    echo ✅ HTTPS disabled for this session
    echo.
)

echo The system will start with:
echo   • HTTP server on port 3000 only
echo   • WebSocket attached to HTTP server
echo   • Clean organized structure
echo   • No HTTPS complications
echo.
echo Press Ctrl+C to stop the server when done.
echo.
echo Access URLs:
echo   Entry Scanner:  http://localhost:3000/entry-scanner
echo   Exit Validator: http://localhost:3000/exit-validator
echo   Admin Dashboard: http://localhost:3000/admin-dashboard
echo.
echo 📱 For phone camera access:
echo   Use Chrome with flag: --unsafely-treat-insecure-origin-as-secure=http://YOUR_IP:3000
echo   Or use the HTTPS version: START_CLEAN_SYSTEM_HTTPS.bat
echo.

echo Starting server...
echo ========================================

npm run dev-simple

echo.
echo Restoring HTTPS certificates...
if exist "certs\backup\server.key.backup" (
    move "certs\backup\server.key.backup" "certs\server.key" >nul 2>&1
    move "certs\backup\server.crt.backup" "certs\server.crt" >nul 2>&1
    echo ✅ HTTPS certificates restored
)

echo.
echo System stopped.
pause
