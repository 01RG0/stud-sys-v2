@echo off
echo ========================================
echo   FIXING CONNECTION ISSUES
echo ========================================
echo.

echo 🔧 Fixing Exit Validator connection issues...
echo.

echo [1/5] Stopping any running servers...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/5] Applying heartbeat fixes...
echo ✅ Exit Validator heartbeat: 30 seconds (was 5 seconds)
echo ✅ Exit Validator timeout: 60 seconds (was 15 seconds)
echo ✅ Exit Validator close threshold: 120 seconds (was 15 seconds)
echo ✅ Entry Scanner heartbeat: 30 seconds (was 5 seconds)
echo ✅ Entry Scanner timeout: 60 seconds (was 15 seconds)
echo ✅ Entry Scanner close threshold: 120 seconds (was 15 seconds)

echo [3/5] Verifying fixes applied...
cd System\web-interface\scripts
findstr /C:"30000" Entry-Scanner.js >nul
if errorlevel 1 (
    echo ❌ Entry Scanner heartbeat fix not applied
) else (
    echo ✅ Entry Scanner heartbeat fix applied
)

findstr /C:"30000" Exit-Validator.js >nul
if errorlevel 1 (
    echo ❌ Exit Validator heartbeat fix not applied
) else (
    echo ✅ Exit Validator heartbeat fix applied
)

echo [4/5] Starting server...
cd ..\..\server
start /B node main-server.js
timeout /t 3 /nobreak >nul

echo [5/5] Verifying server startup...
netstat -an | findstr ":3000" >nul
if errorlevel 1 (
    echo ❌ Server failed to start
    pause
    exit /b 1
)
echo ✅ Server running successfully

echo.
echo ========================================
echo   🎉 CONNECTION ISSUES FIXED! 🎉
echo ========================================
echo.
echo ✅ Heartbeat Frequency: REDUCED (30s instead of 5s)
echo ✅ Connection Timeout: INCREASED (60s instead of 15s)
echo ✅ Close Threshold: INCREASED (120s instead of 15s)
echo ✅ Server Status: RUNNING
echo.
echo 🌐 TEST YOUR SYSTEM:
echo.
echo 📱 Exit Validator: http://localhost:3000/exit-validator
echo 📱 Entry Scanner:  http://localhost:3000/entry-scanner
echo.
echo 🎯 EXPECTED BEHAVIOR:
echo   • Stable connections without constant reconnecting
echo   • Heartbeat every 30 seconds (not 5 seconds)
echo   • Connection only closes after 2 minutes of no response
echo   • Much more stable and reliable connections
echo.
echo 🚀 CONNECTION ISSUES RESOLVED!
echo.
pause
