@echo off
title Student Lab System - Main Launcher
color 0A
setlocal enabledelayedexpansion

echo.
echo ========================================
echo    STUDENT LAB SYSTEM - MAIN LAUNCHER
echo ========================================
echo.
echo Welcome to Student Lab System v2
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

echo Starting PowerShell launcher...
echo.

REM Launch the PowerShell launcher
if exist "LAUNCHER.ps1" (
    powershell -ExecutionPolicy Bypass -File "LAUNCHER.ps1"
) else (
    echo ERROR: LAUNCHER.ps1 not found!
    echo Please ensure all files are properly installed.
    pause
    exit /b 1
)
