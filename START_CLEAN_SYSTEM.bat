@echo off
echo ========================================
echo   Student Lab System - Auto-Detect
echo ========================================
echo.

cd /d "C:\Users\hamad\Desktop\stud sys v2\System\server"

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
    echo Access URLs:
    echo   HTTP URLs:
    echo     Entry Scanner:  http://localhost:3000/entry-scanner
    echo     Exit Validator: http://localhost:3000/exit-validator
    echo     Admin Dashboard: http://localhost:3000/admin-dashboard
    echo.
    echo   HTTPS URLs (for phone camera):
    echo     Entry Scanner:  https://localhost:3443/entry-scanner
    echo     Exit Validator: https://localhost:3443/exit-validator
    echo     Admin Dashboard: https://localhost:3443/admin-dashboard
    echo.
    echo   For phone access, use your computer's IP:
    echo     https://YOUR_IP:3443/entry-scanner
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
    echo Access URLs:
    echo   Entry Scanner:  http://localhost:3000/entry-scanner
    echo   Exit Validator: http://localhost:3000/exit-validator
    echo   Admin Dashboard: http://localhost:3000/admin-dashboard
    echo.
)

echo Starting server...
echo ========================================

npm run dev-simple

echo.
echo System stopped.
pause
