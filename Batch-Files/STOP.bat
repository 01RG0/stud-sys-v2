@echo off
title Student Lab System - Quick Stop
color 0C
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   STUDENT LAB SYSTEM - QUICK STOP
echo ========================================
echo.
echo Stopping all servers...
echo.

REM Check if Node.js processes are running
tasklist | findstr "node.exe" >nul
if %errorlevel% neq 0 (
    echo No Node.js processes found
    echo Server is already stopped
    pause
    exit /b 0
)

echo Found Node.js processes:
tasklist | findstr "node.exe"
echo.

REM Try graceful shutdown first
echo Attempting graceful shutdown...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr /v "PID"') do (
    set pid=%%i
    set pid=!pid:"=!
    echo Sending shutdown signal to process !pid!...
    taskkill /pid !pid! >nul 2>&1
)

echo Waiting for graceful shutdown...
timeout /t 3 >nul

REM Check if processes are still running
tasklist | findstr "node.exe" >nul
if %errorlevel% equ 0 (
    echo Processes still running, forcing shutdown...
    taskkill /f /im node.exe
    if %errorlevel% equ 0 (
        echo All Node.js processes force-stopped
    ) else (
        echo ERROR: Failed to stop some processes
    )
) else (
    echo All Node.js processes stopped gracefully
)

echo.
echo Server stopped successfully
echo.
pause
