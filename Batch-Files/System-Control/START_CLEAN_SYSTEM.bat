@echo off
echo ========================================
echo   Student Lab System - Auto-Detect
echo ========================================
echo.

cd /d "%~dp0..\..\System\server"

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

echo ✅ Files found, starting system with auto-detection...
echo.

REM Get the real IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    for /f "tokens=1" %%b in ("%%a") do set REAL_IP=%%b
)
if "%REAL_IP%"=="" set REAL_IP=localhost

REM Check for SSL certificates
if exist "certs\server.key" if exist "certs\server.crt" (
    echo 🔒 SSL certificates found - HTTPS will be enabled
    echo.
    echo The system will start with:
    echo   • HTTP server on port 3000
    echo   • HTTPS server on port 3443 (for phone camera access)
    echo   • WebSocket attached to HTTP/HTTPS servers
    echo   • Clean organized structure
    echo.
    echo Press Ctrl+C to stop the server when done.
    echo.
    echo ========================================
    echo 📱 ACCESS URLs - Your IP: %REAL_IP%
    echo ========================================
    echo.
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
    echo ⚠️  SSL certificates not found!
    echo    certs\server.key or certs\server.crt missing
    echo.
    echo HTTPS will be disabled. Only HTTP will work.
    echo.
    echo To enable HTTPS, run: generate-ssl-cert.bat
    echo.
    echo The system will start with:
    echo   • HTTP server on port 3000 only
    echo   • WebSocket attached to HTTP server
    echo   • Clean organized structure
    echo.
    echo Press Ctrl+C to stop the server when done.
    echo.
    echo ========================================
    echo 🌐 ACCESS URLs - Your IP: %REAL_IP%
    echo ========================================
    echo.
    echo 🌐 HTTP URLs (Only option without SSL):
    echo     Entry Scanner:  http://%REAL_IP%:3000/entry-scanner
    echo     Exit Validator: http://%REAL_IP%:3000/exit-validator
    echo     Admin Dashboard: http://%REAL_IP%:3000/admin-dashboard
    echo.
    echo ⚠️  Note: Phone cameras require HTTPS. Run generate-ssl-cert.bat first.
    echo.
)

echo Starting server...
echo ========================================

npm run dev-simple

echo.
echo System stopped.
pause
