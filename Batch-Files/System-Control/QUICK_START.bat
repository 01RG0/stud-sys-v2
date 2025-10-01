@echo off
title Student Lab System - Quick Start
color 0B

echo.
echo ========================================
echo    STUDENT LAB SYSTEM - QUICK START
echo ========================================
echo.
echo [1] Start System (Most Common)
echo [2] Close Servers
echo [3] Test Connection
echo [4] Full Menu
echo [5] Exit
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Starting Student Lab System...
    call "Batch-Files\System-Control\START_CLEAN_SYSTEM.bat"
    goto end
)

if "%choice%"=="2" (
    echo.
    echo Closing all servers...
    call "Batch-Files\System-Control\CLOSE_SERVERS.bat"
    goto end
)

if "%choice%"=="3" (
    echo.
    echo Testing system connection...
    call "Batch-Files\Testing\TEST_AUTO_RECONNECTION.bat"
    goto end
)

if "%choice%"=="4" (
    call "START_SYSTEM.bat"
    goto end
)

if "%choice%"=="5" (
    echo.
    echo Goodbye!
    exit /b 0
)

echo.
echo Invalid choice. Please try again.
echo.
pause
goto :eof

:end
echo.
echo Operation completed.
echo.
pause
