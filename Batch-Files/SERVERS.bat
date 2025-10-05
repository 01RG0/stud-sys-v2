@echo off
title Student Lab System - Server Control
color 0C
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   STUDENT LAB SYSTEM - SERVER CONTROL
echo ========================================
echo.
echo Please select an action:
echo.
echo [1] Start Server
echo [2] Stop All Servers
echo [3] Restart Server
echo [4] Check Server Status
echo [5] View Server Logs
echo [6] Kill All Node Processes
echo [7] Exit
echo.
set /p choice="Enter your choice (1-7): "
if "%choice%"=="" (
    echo.
    echo No input received. Returning to menu...
    timeout /t 2 >nul
    goto menu
)

if "%choice%"=="1" goto start_server
if "%choice%"=="2" goto stop_servers
if "%choice%"=="3" goto restart_server
if "%choice%"=="4" goto check_status
if "%choice%"=="5" goto view_logs
if "%choice%"=="6" goto kill_all
if "%choice%"=="7" goto exit
goto invalid_choice

:start_server
echo.
echo ========================================
echo   STARTING SERVER
echo ========================================

echo  Starting Student Lab System server...
echo.

REM Navigate to server directory
cd /d "%~dp0..\System\server"

REM Check if server files exist
if not exist "main-server.js" (
    echo ERROR: Server file not found: main-server.js
    echo Please run LAUNCHER.bat → Option 3 (Complete Setup) first
    pause
    goto menu
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo ERROR: Dependencies not installed
    echo Please run LAUNCHER.bat → Option 4 (Package Manager) first
    pause
    goto menu
)

REM Check if configuration files exist
if not exist ".env" (
    echo ERROR: Configuration file not found: .env
    echo Please run LAUNCHER.bat → Option 3 (Complete Setup) first
    pause
    goto menu
)

REM Check if server is already running
netstat -an | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo WARNING:  Server may already be running on port 3000
    echo Checking for existing Node.js processes...
    tasklist | findstr "node.exe" >nul
    if %errorlevel% equ 0 (
        echo Found existing Node.js processes:
        tasklist | findstr "node.exe"
        echo.
        set /p kill_existing="Kill existing processes and start new server? (y/n): "
        if "%kill_existing%"=="" (
            echo.
            echo No input received. Cancelling...
            timeout /t 2 >nul
            goto menu
        )
        if /i "!kill_existing!"=="y" (
            echo Stopping existing processes...
            taskkill /f /im node.exe >nul 2>&1
            timeout /t 2 >nul
        ) else (
            echo Server start cancelled
            pause
            goto menu
        )
    )
)

echo Starting server...
echo Server will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

REM Start the server
node main-server.js

echo.
echo Server stopped
pause
goto menu

:stop_servers
echo.
echo ========================================
echo   STOPPING ALL SERVERS
echo ========================================

echo  Stopping all servers and processes...
echo.

REM First, try graceful shutdown by sending SIGINT to Node.js processes
echo Attempting graceful shutdown...
tasklist | findstr "node.exe" >nul
if %errorlevel% equ 0 (
    echo Found Node.js processes, sending shutdown signal...
    for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr /v "PID"') do (
        set pid=%%i
        set pid=!pid:"=!
        echo Sending SIGINT to process !pid!...
        taskkill /pid !pid! >nul 2>&1
    )
    echo Waiting for graceful shutdown...
    timeout /t 3 >nul
)

REM Check if processes are still running
tasklist | findstr "node.exe" >nul
if %errorlevel% equ 0 (
    echo WARNING:  Processes still running, forcing shutdown...
    tasklist | findstr "node.exe"
    echo.
    taskkill /f /im node.exe
    if %errorlevel% equ 0 (
        echo OK Node.js processes force-stopped
    ) else (
        echo ERROR: Failed to stop Node.js processes
    )
) else (
    echo OK All Node.js processes stopped gracefully
)

REM Stop MySQL service (optional)
echo.
set /p stop_mysql="Stop MySQL service? (y/n): "
if "%stop_mysql%"=="" (
    echo.
    echo No input received. Skipping MySQL stop...
    timeout /t 2 >nul
    goto :skip_mysql_stop
)
if /i "%stop_mysql%"=="y" (
    echo Stopping MySQL service...
    sc query mysql >nul 2>&1
    if %errorlevel% neq 0 (
        sc query mysql80 >nul 2>&1
        if %errorlevel% neq 0 (
            sc query mysql57 >nul 2>&1
            if %errorlevel% neq 0 (
                echo WARNING:  MySQL service not found
            ) else (
                set MYSQL_SERVICE=mysql57
            )
        ) else (
            set MYSQL_SERVICE=mysql80
        )
    ) else (
        set MYSQL_SERVICE=mysql
    )
    
    if defined MYSQL_SERVICE (
        net stop %MYSQL_SERVICE%
        if %errorlevel% equ 0 (
            echo OK MySQL service stopped
        ) else (
            echo ERROR: Failed to stop MySQL service
        )
    )
)

:skip_mysql_stop
REM Check for other common server processes
echo.
echo Checking for other server processes...
netstat -an | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo WARNING:  Port 3000 is still in use
    echo You may need to manually stop the process using this port
) else (
    echo OK Port 3000 is free
)

echo.
echo OK All servers stopped
pause
goto menu

:restart_server
echo.
echo ========================================
echo   RESTARTING SERVER
echo ========================================

echo  Restarting server...
echo.

REM Stop existing processes
echo Stopping existing processes...
taskkill /f /im node.exe >nul 2>&1
timeout /t 3 >nul

REM Start server
echo Starting server...
cd /d "%~dp0..\System\server"
node main-server.js

echo.
echo Server restart completed
pause
goto menu

:check_status
echo.
echo ========================================
echo   SERVER STATUS CHECK
echo ========================================

echo  Checking server status...
echo.

REM Check Node.js processes
echo Checking Node.js processes...
tasklist | findstr "node.exe" >nul
if %errorlevel% equ 0 (
    echo OK Node.js processes found:
    tasklist | findstr "node.exe"
) else (
    echo ERROR: No Node.js processes found
)

REM Check port 3000
echo.
echo Checking port 3000...
netstat -an | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo OK Port 3000 is in use
    netstat -an | findstr ":3000"
) else (
    echo ERROR: Port 3000 is not in use
)

REM Check MySQL service
echo.
echo Checking MySQL service...
sc query mysql >nul 2>&1
if %errorlevel% neq 0 (
    sc query mysql80 >nul 2>&1
    if %errorlevel% neq 0 (
        sc query mysql57 >nul 2>&1
        if %errorlevel% neq 0 (
            echo ERROR: MySQL service not found
        ) else (
            set MYSQL_SERVICE=mysql57
        )
    ) else (
        set MYSQL_SERVICE=mysql80
    )
) else (
    set MYSQL_SERVICE=mysql
)

if defined MYSQL_SERVICE (
    sc query %MYSQL_SERVICE% | findstr "RUNNING" >nul
    if %errorlevel% equ 0 (
        echo OK MySQL service is running
    ) else (
        echo ERROR: MySQL service is not running
    )
)

REM Check server files
echo.
echo Checking server files...
cd /d "%~dp0..\System\server"

if exist "main-server.js" (
    echo OK main-server.js exists
) else (
    echo ERROR: main-server.js not found
)

if exist "node_modules" (
    echo OK node_modules exists
) else (
    echo ERROR: node_modules not found
)

if exist ".env" (
    echo OK .env file exists
) else (
    echo ERROR: .env file not found
)

echo.
echo Status check completed
pause
goto menu

:view_logs
echo.
echo ========================================
echo   VIEWING SERVER LOGS
echo ========================================

echo  Server logs...
echo.

REM Check if logs directory exists
cd /d "%~dp0..\System\server"
if exist "logs" (
    echo Log files found:
    dir logs\*.log 2>nul
    if %errorlevel% equ 0 (
        echo.
        set /p log_file="Enter log file name (or press Enter for latest): "
        if "%log_file%"=="" (
            for /f "delims=" %%i in ('dir logs\*.log /b /o-d 2^>nul ^| findstr /v "\.log$"') do (
                set latest_log=%%i
                goto :show_latest_log
            )
            :show_latest_log
            if defined latest_log (
                echo Showing latest log: %latest_log%
                type "logs\%latest_log%"
            ) else (
                echo No log files found
            )
        ) else (
            if exist "logs\%log_file%" (
                type "logs\%log_file%"
            ) else (
                echo Log file not found: %log_file%
            )
        )
    ) else (
        echo No log files found in logs directory
    )
) else (
    echo Logs directory not found
    echo Logs will be created when the server runs
)

echo.
pause
goto menu

:kill_all
echo.
echo ========================================
echo   KILL ALL NODE PROCESSES
echo ========================================

echo WARNING: This will kill ALL Node.js processes!
echo.
set /p confirm="Are you sure? (y/n): "
if "%confirm%"=="" (
    echo.
    echo No input received. Cancelling...
    timeout /t 2 >nul
    goto menu
)
if /i not "%confirm%"=="y" (
    echo Operation cancelled
    pause
    goto menu
)

echo  Killing all Node.js processes...
tasklist | findstr "node.exe" >nul
if %errorlevel% equ 0 (
    echo Found Node.js processes:
    tasklist | findstr "node.exe"
    echo.
    taskkill /f /im node.exe
    if %errorlevel% equ 0 (
        echo OK All Node.js processes killed
    ) else (
        echo ERROR: Failed to kill some processes
    )
) else (
    echo OK No Node.js processes found
)

echo.
pause
goto menu

:invalid_choice
echo.
echo ERROR: Invalid choice. Please select 1-7.
pause
goto menu

:menu
cls
goto :eof

:exit
echo.
echo Goodbye!
exit /b 0
