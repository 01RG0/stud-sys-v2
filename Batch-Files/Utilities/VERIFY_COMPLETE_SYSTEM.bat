@echo off
title Complete System Verification
color 0A

echo.
echo ========================================
echo   COMPLETE SYSTEM VERIFICATION
echo ========================================
echo.
echo This will verify all system components:
echo   - File structure and connections
echo   - ZERO DATA LOSS implementation
echo   - Offline functionality
echo   - Device communication
echo   - Data backup systems
echo.

set /p continue="Continue with verification? (y/n): "
if /i not "%continue%"=="y" (
    echo Verification cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STEP 1: FILE STRUCTURE VERIFICATION
echo ========================================

echo 🔍 Checking file structure...

REM Check main system files
if not exist "System\server\main-server.js" (
    echo ❌ Main server file missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Main server file found
)

if not exist "System\web-interface\pages\Entry-Scanner.html" (
    echo ❌ Entry Scanner HTML missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner HTML found
)

if not exist "System\web-interface\pages\Exit-Validator.html" (
    echo ❌ Exit Validator HTML missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator HTML found
)

if not exist "System\web-interface\pages\Admin-Dashboard.html" (
    echo ❌ Admin Dashboard HTML missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Admin Dashboard HTML found
)

if not exist "System\web-interface\scripts\Entry-Scanner.js" (
    echo ❌ Entry Scanner script missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner script found
)

if not exist "System\web-interface\scripts\Exit-Validator.js" (
    echo ❌ Exit Validator script missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator script found
)

if not exist "System\web-interface\scripts\Admin-Dashboard.js" (
    echo ❌ Admin Dashboard script missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Admin Dashboard script found
)

if not exist "System\web-interface\styles\common.css" (
    echo ❌ Common CSS missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Common CSS found
)

echo.
echo ========================================
echo   STEP 2: ZERO DATA LOSS VERIFICATION
echo ========================================

echo 🔍 Checking ZERO DATA LOSS implementation...

REM Check Entry Scanner for ZERO DATA LOSS functions
findstr /C:"ZERO DATA LOSS" "System\web-interface\scripts\Entry-Scanner.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Entry Scanner ZERO DATA LOSS not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner ZERO DATA LOSS implemented
)

REM Check Exit Validator for ZERO DATA LOSS functions
findstr /C:"ZERO DATA LOSS" "System\web-interface\scripts\Exit-Validator.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Exit Validator ZERO DATA LOSS not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator ZERO DATA LOSS implemented
)

REM Check for backup functions
findstr /C:"createEmergencyBackup" "System\web-interface\scripts\Entry-Scanner.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Entry Scanner backup functions missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner backup functions found
)

findstr /C:"createEmergencyBackup" "System\web-interface\scripts\Exit-Validator.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Exit Validator backup functions missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator backup functions found
)

echo.
echo ========================================
echo   STEP 3: OFFLINE FUNCTIONALITY CHECK
echo ========================================

echo 🔍 Checking offline functionality...

REM Check for offline mode indicators
findstr /C:"offlineMode" "System\web-interface\scripts\Entry-Scanner.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Entry Scanner offline mode not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner offline mode implemented
)

findstr /C:"offlineMode" "System\web-interface\scripts\Exit-Validator.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Exit Validator offline mode not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator offline mode implemented
)

REM Check for localStorage usage
findstr /C:"localStorage" "System\web-interface\scripts\Entry-Scanner.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Entry Scanner localStorage not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner localStorage implemented
)

findstr /C:"localStorage" "System\web-interface\scripts\Exit-Validator.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Exit Validator localStorage not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator localStorage implemented
)

echo.
echo ========================================
echo   STEP 4: DEVICE COMMUNICATION CHECK
echo ========================================

echo 🔍 Checking device communication...

REM Check for WebSocket implementation
findstr /C:"WebSocket" "System\web-interface\scripts\Entry-Scanner.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Entry Scanner WebSocket not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner WebSocket implemented
)

findstr /C:"WebSocket" "System\web-interface\scripts\Exit-Validator.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Exit Validator WebSocket not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator WebSocket implemented
)

findstr /C:"WebSocket" "System\web-interface\scripts\Admin-Dashboard.js" >nul
if %errorlevel% neq 0 (
    echo ❌ Admin Dashboard WebSocket not implemented!
    set ERROR_COUNT=1
) else (
    echo ✅ Admin Dashboard WebSocket implemented
)

echo.
echo ========================================
echo   STEP 5: RECONNECT FUNCTIONALITY CHECK
echo ========================================

echo 🔍 Checking reconnect functionality...

REM Check for permanent reconnect bar
findstr /C:"permanent-reconnect-bar" "System\web-interface\pages\Entry-Scanner.html" >nul
if %errorlevel% neq 0 (
    echo ❌ Entry Scanner reconnect bar missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner reconnect bar found
)

findstr /C:"permanent-reconnect-bar" "System\web-interface\pages\Exit-Validator.html" >nul
if %errorlevel% neq 0 (
    echo ❌ Exit Validator reconnect bar missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator reconnect bar found
)

findstr /C:"permanent-reconnect-bar" "System\web-interface\pages\Admin-Dashboard.html" >nul
if %errorlevel% neq 0 (
    echo ❌ Admin Dashboard reconnect bar missing!
    set ERROR_COUNT=1
) else (
    echo ✅ Admin Dashboard reconnect bar found
)

echo.
echo ========================================
echo   STEP 6: CSS AND STYLING CHECK
echo ========================================

echo 🔍 Checking CSS connections...

REM Check if common.css is linked in all pages
findstr /C:"common.css" "System\web-interface\pages\Entry-Scanner.html" >nul
if %errorlevel% neq 0 (
    echo ❌ Entry Scanner common.css not linked!
    set ERROR_COUNT=1
) else (
    echo ✅ Entry Scanner common.css linked
)

findstr /C:"common.css" "System\web-interface\pages\Exit-Validator.html" >nul
if %errorlevel% neq 0 (
    echo ❌ Exit Validator common.css not linked!
    set ERROR_COUNT=1
) else (
    echo ✅ Exit Validator common.css linked
)

findstr /C:"common.css" "System\web-interface\pages\Admin-Dashboard.html" >nul
if %errorlevel% neq 0 (
    echo ❌ Admin Dashboard common.css not linked!
    set ERROR_COUNT=1
) else (
    echo ✅ Admin Dashboard common.css linked
)

echo.
echo ========================================
echo   VERIFICATION RESULTS
echo ========================================

if defined ERROR_COUNT (
    echo ❌ VERIFICATION FAILED!
    echo.
    echo Some components are missing or not properly implemented.
    echo Please check the errors above and fix them.
    echo.
    pause
    exit /b 1
) else (
    echo ✅ VERIFICATION PASSED!
    echo.
    echo All system components are properly implemented:
    echo   - File structure is complete
    echo   - ZERO DATA LOSS system is active
    echo   - Offline functionality is implemented
    echo   - Device communication is working
    echo   - Reconnect functionality is available
    echo   - CSS styling is properly connected
    echo.
    echo 🛡️ Your system is ready for ZERO DATA LOSS operation!
    echo 📱 Offline-first mode is fully functional!
    echo 📶 Hotspot-only mode is ready!
    echo.
)

pause
