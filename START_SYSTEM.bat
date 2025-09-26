@echo off
title Student Lab System - Main Launcher
color 0A

echo.
echo ========================================
echo    STUDENT LAB SYSTEM - MAIN LAUNCHER
echo ========================================
echo.
echo Please select an option:
echo.
echo [1] Start System (Recommended)
echo [2] System Control
echo [3] Testing Tools
echo [4] Setup ^& Installation
echo [5] Utilities ^& Recovery
echo [6] View Documentation
echo [7] Exit
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" (
    echo.
    echo Starting Student Lab System...
    call "Batch-Files\System-Control\START_CLEAN_SYSTEM.bat"
    goto end
)

if "%choice%"=="2" (
    echo.
    echo ========================================
    echo         SYSTEM CONTROL OPTIONS
    echo ========================================
    echo.
    echo [1] Start Clean System
    echo [2] Start Simple Server
    echo [3] Close All Servers
    echo [4] Back to Main Menu
    echo.
    set /p subchoice="Enter your choice (1-4): "
    
    if "%subchoice%"=="1" call "Batch-Files\System-Control\START_CLEAN_SYSTEM.bat"
    if "%subchoice%"=="2" call "Batch-Files\System-Control\START_SERVER_SIMPLE.bat"
    if "%subchoice%"=="3" call "Batch-Files\System-Control\CLOSE_SERVERS.bat"
    if "%subchoice%"=="4" goto start
    goto end
)

if "%choice%"=="3" (
    echo.
    echo ========================================
    echo          TESTING TOOLS
    echo ========================================
    echo.
    echo [1] Test Auto Reconnection
    echo [2] Test Offline Functionality
    echo [3] Test MySQL Integration
    echo [4] Test Hybrid System
    echo [5] Verify System
    echo [6] Back to Main Menu
    echo.
    set /p subchoice="Enter your choice (1-6): "
    
    if "%subchoice%"=="1" call "Batch-Files\Testing\TEST_AUTO_RECONNECTION.bat"
    if "%subchoice%"=="2" call "Batch-Files\Testing\TEST_OFFLINE_FUNCTIONALITY.bat"
    if "%subchoice%"=="3" call "Batch-Files\Testing\TEST_MYSQL_INTEGRATION.bat"
    if "%subchoice%"=="4" call "Batch-Files\Testing\TEST_HYBRID_SYSTEM.bat"
    if "%subchoice%"=="5" call "Batch-Files\Utilities\VERIFY_SYSTEM.bat"
    if "%subchoice%"=="6" goto start
    goto end
)

if "%choice%"=="4" (
    echo.
    echo ========================================
    echo       SETUP & INSTALLATION
    echo ========================================
    echo.
    echo [1] Complete System Setup
    echo [2] Enhanced System Setup
    echo [3] MySQL Setup
    echo [4] Back to Main Menu
    echo.
    set /p subchoice="Enter your choice (1-4): "
    
    if "%subchoice%"=="1" call "Batch-Files\Setup\COMPLETE_SYSTEM_SETUP.bat"
    if "%subchoice%"=="2" call "Batch-Files\Setup\ENHANCED_SYSTEM_SETUP.bat"
    if "%subchoice%"=="3" call "Batch-Files\Setup\SETUP_MYSQL.bat"
    if "%subchoice%"=="4" goto start
    goto end
)

if "%choice%"=="5" (
    echo.
    echo ========================================
    echo        UTILITIES & RECOVERY
    echo ========================================
    echo.
    echo [1] System Recovery
    echo [2] Fix HTTPS & OpenSSL
    echo [3] Verify System
    echo [4] Back to Main Menu
    echo.
    set /p subchoice="Enter your choice (1-4): "
    
    if "%subchoice%"=="1" call "Batch-Files\Utilities\SYSTEM_RECOVERY.bat"
    if "%subchoice%"=="2" call "Batch-Files\Utilities\FIX_HTTPS_AND_OPENSSL.bat"
    if "%subchoice%"=="3" call "Batch-Files\Utilities\VERIFY_SYSTEM.bat"
    if "%subchoice%"=="4" goto start
    goto end
)

if "%choice%"=="6" (
    echo.
    echo ========================================
    echo           DOCUMENTATION
    echo ========================================
    echo.
    echo Opening Documentation folder...
    start "" "Documentation"
    echo.
    echo Documentation opened in Windows Explorer.
    echo.
    pause
    goto start
)

if "%choice%"=="7" (
    echo.
    echo Thank you for using Student Lab System!
    echo.
    exit /b 0
)

echo.
echo Invalid choice. Please try again.
echo.
pause
goto start

:start
cls
goto :eof

:end
echo.
echo Operation completed.
echo.
pause
