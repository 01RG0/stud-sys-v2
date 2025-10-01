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
echo [1] Quick Start (Recommended)
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
    call "Batch-Files\System-Control\QUICK_START.bat"
    goto end
)

if "%choice%"=="2" (
    echo.
    echo ========================================
    echo         SYSTEM CONTROL OPTIONS
    echo ========================================
    echo.
    echo [1] Enhanced System Control
    echo [2] Start Clean System
    echo [3] Start Simple Server
    echo [4] Close All Servers
    echo [5] Back to Main Menu
    echo.
    set /p subchoice="Enter your choice (1-5): "
    
    if "%subchoice%"=="1" call "Batch-Files\System-Control\ENHANCED_SYSTEM_CONTROL.bat"
    if "%subchoice%"=="2" call "Batch-Files\System-Control\START_CLEAN_SYSTEM.bat"
    if "%subchoice%"=="3" call "Batch-Files\System-Control\START_SERVER_SIMPLE.bat"
    if "%subchoice%"=="4" call "Batch-Files\System-Control\CLOSE_SERVERS.bat"
    if "%subchoice%"=="5" goto start
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
    echo [5] Test Zero Data Loss
    echo [6] Test Data Collection Manager
    echo [7] Comprehensive Bug Fix
    echo [8] Verify System
    echo [9] Back to Main Menu
    echo.
    set /p subchoice="Enter your choice (1-9): "
    
    if "%subchoice%"=="1" call "Batch-Files\Testing\TEST_AUTO_RECONNECTION.bat"
    if "%subchoice%"=="2" call "Batch-Files\Testing\TEST_OFFLINE_FUNCTIONALITY.bat"
    if "%subchoice%"=="3" call "Batch-Files\Testing\TEST_MYSQL_INTEGRATION.bat"
    if "%subchoice%"=="4" call "Batch-Files\Testing\TEST_HYBRID_SYSTEM.bat"
    if "%subchoice%"=="5" call "Batch-Files\Testing\TEST_ZERO_DATA_LOSS.bat"
    if "%subchoice%"=="6" call "Batch-Files\Testing\TEST_DATA_COLLECTION_MANAGER.bat"
    if "%subchoice%"=="7" call "Batch-Files\Utilities\COMPREHENSIVE_ERROR_FIX.bat"
    if "%subchoice%"=="8" call "Batch-Files\Utilities\VERIFY_COMPLETE_SYSTEM.bat"
    if "%subchoice%"=="9" goto start
    goto end
)

if "%choice%"=="4" (
    echo.
    echo ========================================
    echo       SETUP ^& INSTALLATION
    echo ========================================
    echo.
    echo [1] Optimized Setup (Recommended)
    echo [2] Master Setup (Complete)
    echo [3] Enhanced MySQL Setup
    echo [4] Back to Main Menu
    echo.
    set /p subchoice="Enter your choice (1-4): "
    
    if "%subchoice%"=="1" call "Batch-Files\Setup\OPTIMIZED_SETUP.bat"
    if "%subchoice%"=="2" call "Batch-Files\Setup\MASTER_SETUP.bat"
    if "%subchoice%"=="3" call "Batch-Files\Setup\ENHANCED_MYSQL_SETUP.bat"
    if "%subchoice%"=="4" goto start
    goto end
)

if "%choice%"=="5" (
    echo.
    echo ========================================
    echo        UTILITIES ^& RECOVERY
    echo ========================================
    echo.
    echo [1] Comprehensive Error Fix
    echo [2] System Recovery
    echo [3] Fix HTTPS & OpenSSL
    echo [4] Verify Complete System
    echo [5] Organize Project
    echo [6] Check Package Compatibility
    echo [7] Update Packages
    echo [8] Back to Main Menu
    echo.
    set /p subchoice="Enter your choice (1-8): "
    
    if "%subchoice%"=="1" call "Batch-Files\Utilities\COMPREHENSIVE_ERROR_FIX.bat"
    if "%subchoice%"=="2" call "Batch-Files\Utilities\SYSTEM_RECOVERY.bat"
    if "%subchoice%"=="3" call "Batch-Files\Utilities\FIX_HTTPS_AND_OPENSSL.bat"
    if "%subchoice%"=="4" call "Batch-Files\Utilities\VERIFY_COMPLETE_SYSTEM.bat"
    if "%subchoice%"=="5" call "Batch-Files\Utilities\ORGANIZE_PROJECT.bat"
    if "%subchoice%"=="6" call "Batch-Files\Utilities\CHECK_PACKAGE_COMPATIBILITY.bat"
    if "%subchoice%"=="7" call "Batch-Files\Utilities\UPDATE_PACKAGES.bat"
    if "%subchoice%"=="8" goto start
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
    echo Available documentation:
    echo - Complete Setup Guide
    echo - MySQL Setup Guide
    echo - Hybrid System Guide
    echo - Zero Data Loss System
    echo - HTTPS Troubleshooting Guide
    echo - And many more...
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
