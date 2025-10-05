@echo off
title Student Lab System - Main Launcher
color 0A
setlocal enabledelayedexpansion

:start
cls
echo.
echo ========================================
echo    STUDENT LAB SYSTEM - MAIN LAUNCHER
echo ========================================
echo.
echo Welcome to Student Lab System v2
echo.
echo Please select an option:
echo.
echo [1]  Quick Start (Start Server)
echo [2]  Quick Stop (Stop Server)
echo [3]  Complete Setup (First Time)
echo [4]  Package Manager (Install Dependencies)
echo [5]  Server Control (Advanced)
echo [6]  Generate SSL Certificate
echo [7]  Exit
echo.
set /p choice="Enter your choice (1-7): "
if "%choice%"=="" (
    echo.
    echo No input received. Returning to menu...
    timeout /t 2 >nul
    goto start
)

if "%choice%"=="1" (
    echo.
    echo Starting Student Lab System...
    echo.
    if exist "Batch-Files\START.bat" (
        call "Batch-Files\START.bat"
    ) else (
        echo ERROR: START.bat not found in Batch-Files directory!
        echo Please ensure all files are properly installed.
        pause
    )
    goto end
)

if "%choice%"=="2" (
    echo.
    echo Stopping Student Lab System...
    echo.
    if exist "Batch-Files\STOP.bat" (
        call "Batch-Files\STOP.bat"
    ) else (
        echo ERROR: STOP.bat not found in Batch-Files directory!
        echo Please ensure all files are properly installed.
        pause
    )
    goto end
)

if "%choice%"=="3" (
    echo.
    echo Running complete setup...
    echo.
    if exist "Batch-Files\SETUP.bat" (
        call "Batch-Files\SETUP.bat"
    ) else (
        echo ERROR: SETUP.bat not found in Batch-Files directory!
        echo Please ensure all files are properly installed.
        pause
    )
    goto end
)

if "%choice%"=="4" (
    echo.
    echo Running package manager...
    echo.
    if exist "Batch-Files\PACKAGES.bat" (
        call "Batch-Files\PACKAGES.bat"
    ) else (
        echo ERROR: PACKAGES.bat not found in Batch-Files directory!
        echo Please ensure all files are properly installed.
        pause
    )
    goto end
)

if "%choice%"=="5" (
    echo.
    echo Opening server control...
    echo.
    if exist "Batch-Files\SERVERS.bat" (
        call "Batch-Files\SERVERS.bat"
    ) else (
        echo ERROR: SERVERS.bat not found in Batch-Files directory!
        echo Please ensure all files are properly installed.
        pause
    )
    goto end
)

if "%choice%"=="6" (
    echo.
    echo Generating SSL Certificate...
    echo.
    if exist "Batch-Files\SSL-CERT.bat" (
        call "Batch-Files\SSL-CERT.bat"
    ) else (
        echo ERROR: SSL-CERT.bat not found in Batch-Files directory!
        echo Please ensure all files are properly installed.
        pause
    )
    goto end
)

if "%choice%"=="7" (
    echo.
    echo Goodbye! Thank you for using Student Lab System v2
    echo.
    timeout /t 2 >nul
    exit /b 0
)

echo.
echo ERROR: Invalid choice. Please select 1-7.
echo.
echo Press any key to return to main menu...
pause >nul
goto start

:end
echo.
echo ========================================
echo Press any key to return to main menu...
echo ========================================
pause >nul
goto start
