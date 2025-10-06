@echo off
title Student Lab System - Enhanced Launcher
color 0A
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   STUDENT LAB SYSTEM - ENHANCED LAUNCHER
echo ========================================
echo.
echo Welcome to Student Lab System v2
echo Enhanced with Real IP Detection and Live Logs
echo.

REM Check if Batch-Files directory exists
if not exist "Batch-Files" (
    echo ERROR: Batch-Files directory not found!
    echo Please ensure the project is properly installed.
    pause
    exit /b 1
)

REM Check if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PowerShell is not available!
    echo Please install PowerShell or use the .ps1 launcher directly.
    pause
    exit /b 1
)

REM Check if START-SIMPLE.ps1 exists
if not exist "Batch-Files\START-SIMPLE.ps1" (
    echo ERROR: START-SIMPLE.ps1 not found in Batch-Files directory!
    echo Please ensure all files are properly installed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   QUICK START OPTIONS
echo ========================================
echo.
echo 1. Quick Start Server (Auto-start with live logs)
echo 2. Interactive Menu (Full launcher)
echo 3. Stop Server
echo 4. Update Database (Offline Sync)
echo 5. Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Starting server with live logs and real IP detection...
    echo.
    powershell -ExecutionPolicy Bypass -Command "& '.\Batch-Files\START-SIMPLE.ps1' -AutoStart"
    goto :end
)

if "%choice%"=="2" (
    echo.
    echo Starting interactive launcher...
    echo.
    if exist "LAUNCHER.ps1" (
        powershell -ExecutionPolicy Bypass -File "LAUNCHER.ps1"
    ) else (
        echo ERROR: LAUNCHER.ps1 not found!
        echo Please ensure all files are properly installed.
        pause
        exit /b 1
    )
    goto :end
)

if "%choice%"=="3" (
    echo.
    echo Stopping server...
    echo.
    if exist "Batch-Files\STOP.ps1" (
        powershell -ExecutionPolicy Bypass -File "Batch-Files\STOP.ps1"
    ) else (
        echo ERROR: STOP.ps1 not found!
        echo Please ensure all files are properly installed.
        pause
        exit /b 1
    )
    goto :end
)

if "%choice%"=="4" (
    echo.
    echo Updating database for offline sync...
    echo.
    if exist "Batch-Files\UPDATE-DATABASE.ps1" (
        powershell -ExecutionPolicy Bypass -File "Batch-Files\UPDATE-DATABASE.ps1"
    ) else (
        echo ERROR: UPDATE-DATABASE.ps1 not found!
        echo Please ensure all files are properly installed.
        pause
        exit /b 1
    )
    goto :end
)

if "%choice%"=="5" (
    echo.
    echo Goodbye!
    goto :end
)

echo.
echo Invalid choice. Please run the launcher again.
pause

:end
echo.
echo Thank you for using Student Lab System v2!
pause
