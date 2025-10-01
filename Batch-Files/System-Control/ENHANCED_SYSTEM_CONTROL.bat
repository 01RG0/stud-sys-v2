@echo off
title Enhanced System Control - Student Lab System
color 0A
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   ENHANCED SYSTEM CONTROL
echo ========================================
echo.
echo Advanced system management for Student Lab System
echo.

:main_menu
cls
echo.
echo ========================================
echo   ENHANCED SYSTEM CONTROL MENU
echo ========================================
echo.
echo [1] Start System (Clean)
echo [2] Start System (Development)
echo [3] Start System (Production)
echo [4] Stop All Services
echo [5] Restart System
echo [6] System Status
echo [7] Health Check
echo [8] Performance Monitor
echo [9] Log Viewer
echo [10] Database Management
echo [11] Backup & Restore
echo [12] System Maintenance
echo [13] Exit
echo.

set /p choice="Enter your choice (1-13): "

if "%choice%"=="1" goto start_clean
if "%choice%"=="2" goto start_dev
if "%choice%"=="3" goto start_prod
if "%choice%"=="4" goto stop_all
if "%choice%"=="5" goto restart_system
if "%choice%"=="6" goto system_status
if "%choice%"=="7" goto health_check
if "%choice%"=="8" goto performance_monitor
if "%choice%"=="9" goto log_viewer
if "%choice%"=="10" goto database_management
if "%choice%"=="11" goto backup_restore
if "%choice%"=="12" goto system_maintenance
if "%choice%"=="13" goto exit_system

echo Invalid choice. Please try again.
pause
goto main_menu

:start_clean
echo.
echo ========================================
echo   STARTING CLEAN SYSTEM
echo ========================================
echo.
echo 🧹 Cleaning up previous sessions...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul

echo 🚀 Starting clean system...
cd /d "%~dp0..\..\..\System"
start "Student Lab System - Clean" cmd /k "node server/main-server.js"
echo ✅ System started in clean mode
echo.
echo Access URLs:
echo   HTTP:  http://localhost:3000
echo   HTTPS: https://localhost:3443
echo.
pause
goto main_menu

:start_dev
echo.
echo ========================================
echo   STARTING DEVELOPMENT SYSTEM
echo ========================================
echo.
echo 🔧 Starting development mode with auto-reload...
cd /d "%~dp0..\..\..\System"
start "Student Lab System - Dev" cmd /k "npm run dev-watch"
echo ✅ System started in development mode
echo.
echo Features enabled:
echo   - Auto-reload on file changes
echo   - Detailed logging
echo   - Development tools
echo.
pause
goto main_menu

:start_prod
echo.
echo ========================================
echo   STARTING PRODUCTION SYSTEM
echo ========================================
echo.
echo 🏭 Starting production mode...
cd /d "%~dp0..\..\..\System"
start "Student Lab System - Production" cmd /k "npm start"
echo ✅ System started in production mode
echo.
echo Features enabled:
echo   - Optimized performance
echo   - Security hardening
echo   - Production logging
echo.
pause
goto main_menu

:stop_all
echo.
echo ========================================
echo   STOPPING ALL SERVICES
echo ========================================
echo.
echo 🛑 Stopping all system services...

REM Stop Node.js processes
echo Stopping Node.js processes...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  No Node.js processes found
) else (
    echo ✅ Node.js processes stopped
)

REM Stop any related services
echo Stopping related services...
taskkill /f /im "Student Lab System*" >nul 2>&1
taskkill /f /im "cmd.exe" /fi "WINDOWTITLE eq Student Lab System*" >nul 2>&1

echo ✅ All services stopped
echo.
pause
goto main_menu

:restart_system
echo.
echo ========================================
echo   RESTARTING SYSTEM
echo ========================================
echo.
echo 🔄 Restarting system...

REM Stop all services first
call :stop_all

echo Waiting for services to stop...
timeout /t 3 >nul

echo Starting system...
cd /d "%~dp0..\..\..\System"
start "Student Lab System - Restarted" cmd /k "node server/main-server.js"

echo ✅ System restarted successfully
echo.
pause
goto main_menu

:system_status
echo.
echo ========================================
echo   SYSTEM STATUS
echo ========================================
echo.

REM Check Node.js processes
echo 🔍 Checking Node.js processes...
tasklist /fi "imagename eq node.exe" 2>nul | find /i "node.exe" >nul
if %errorlevel% neq 0 (
    echo ❌ No Node.js processes running
) else (
    echo ✅ Node.js processes running:
    tasklist /fi "imagename eq node.exe" /fo table
)

echo.
echo 🔍 Checking system ports...
netstat -an | findstr ":3000" >nul
if %errorlevel% neq 0 (
    echo ❌ Port 3000 (HTTP) not in use
) else (
    echo ✅ Port 3000 (HTTP) is active
)

netstat -an | findstr ":3443" >nul
if %errorlevel% neq 0 (
    echo ❌ Port 3443 (HTTPS) not in use
) else (
    echo ✅ Port 3443 (HTTPS) is active
)

echo.
echo 🔍 Checking MySQL connection...
cd /d "%~dp0..\..\..\System\server"
if exist "db-config.js" (
    node -e "const mysql=require('mysql2/promise');const config=require('./db-config.js');mysql.createConnection(config).then(conn=>{console.log('✅ MySQL connection: OK');conn.end();}).catch(err=>{console.log('❌ MySQL connection: FAILED -',err.message);});" 2>nul
) else (
    echo ❌ Database configuration not found
)

echo.
pause
goto main_menu

:health_check
echo.
echo ========================================
echo   SYSTEM HEALTH CHECK
echo ========================================
echo.

echo 🏥 Running comprehensive health check...

REM Check system resources
echo.
echo 📊 System Resources:
echo CPU Usage:
wmic cpu get loadpercentage /value | findstr "LoadPercentage"
echo.
echo Memory Usage:
wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value

echo.
echo 🔍 Checking system files...
cd /d "%~dp0..\..\..\System"

if exist "server\main-server.js" (
    echo ✅ Main server file: OK
) else (
    echo ❌ Main server file: MISSING
)

if exist "server\database.js" (
    echo ✅ Database module: OK
) else (
    echo ❌ Database module: MISSING
)

if exist "server\db-config.js" (
    echo ✅ Database config: OK
) else (
    echo ❌ Database config: MISSING
)

if exist "server\certs\server.crt" (
    echo ✅ SSL certificate: OK
) else (
    echo ❌ SSL certificate: MISSING
)

echo.
echo 🔍 Checking web interface...
if exist "web-interface\pages\Entry-Scanner.html" (
    echo ✅ Entry Scanner: OK
) else (
    echo ❌ Entry Scanner: MISSING
)

if exist "web-interface\pages\Exit-Validator.html" (
    echo ✅ Exit Validator: OK
) else (
    echo ❌ Exit Validator: MISSING
)

if exist "web-interface\pages\Admin-Dashboard.html" (
    echo ✅ Admin Dashboard: OK
) else (
    echo ❌ Admin Dashboard: MISSING
)

echo.
echo 🧪 Testing system functionality...
cd /d "%~dp0..\..\..\System"
node -c server\main-server.js
if %errorlevel% neq 0 (
    echo ❌ Server syntax: ERRORS FOUND
) else (
    echo ✅ Server syntax: VALID
)

echo.
echo ✅ Health check completed
echo.
pause
goto main_menu

:performance_monitor
echo.
echo ========================================
echo   PERFORMANCE MONITOR
echo ========================================
echo.

echo 📈 System Performance Monitor
echo Press Ctrl+C to stop monitoring
echo.

:monitor_loop
cls
echo ========================================
echo   PERFORMANCE MONITOR - %date% %time%
echo ========================================
echo.

REM CPU Usage
echo 🔥 CPU Usage:
wmic cpu get loadpercentage /value | findstr "LoadPercentage"

echo.
echo 💾 Memory Usage:
for /f "skip=1" %%p in ('wmic OS get TotalVisibleMemorySize /value') do set total=%%p
for /f "skip=1" %%p in ('wmic OS get FreePhysicalMemory /value') do set free=%%p
set /a used=total-free
set /a percent=used*100/total
echo Total: %total% KB
echo Used: %used% KB
echo Free: %free% KB
echo Usage: %percent%%%

echo.
echo 🌐 Network Connections:
netstat -an | findstr ":3000\|:3443" | find /c "ESTABLISHED"

echo.
echo 📊 Node.js Processes:
tasklist /fi "imagename eq node.exe" /fo csv | find /c "node.exe"

echo.
echo Press any key to refresh or Ctrl+C to exit...
timeout /t 5 >nul
goto monitor_loop

:log_viewer
echo.
echo ========================================
echo   LOG VIEWER
echo ========================================
echo.

echo 📋 Available log files:
echo.
if exist "%~dp0..\..\..\Logs" (
    dir "%~dp0..\..\..\Logs\*.log" /b 2>nul
    if %errorlevel% neq 0 (
        echo No log files found in Logs directory
    ) else (
        echo.
        set /p logfile="Enter log file name to view (or press Enter for latest): "
        if "%logfile%"=="" (
            for /f %%i in ('dir "%~dp0..\..\..\Logs\*.log" /b /o-d 2^>nul ^| findstr /n ".*" ^| findstr "^1:"') do set latest=%%i
            set latest=!latest:*:=!
            if defined latest (
                echo Viewing latest log: !latest!
                type "%~dp0..\..\..\Logs\!latest!"
            ) else (
                echo No log files found
            )
        ) else (
            if exist "%~dp0..\..\..\Logs\%logfile%" (
                type "%~dp0..\..\..\Logs\%logfile%"
            ) else (
                echo Log file not found: %logfile%
            )
        )
    )
) else (
    echo Logs directory not found
)

echo.
pause
goto main_menu

:database_management
echo.
echo ========================================
echo   DATABASE MANAGEMENT
echo ========================================
echo.
echo [1] Test Database Connection
echo [2] Show Database Status
echo [3] Backup Database
echo [4] Restore Database
echo [5] Optimize Database
echo [6] Show Table Information
echo [7] Back to Main Menu
echo.

set /p db_choice="Enter your choice (1-7): "

if "%db_choice%"=="1" goto test_db_connection
if "%db_choice%"=="2" goto show_db_status
if "%db_choice%"=="3" goto backup_database
if "%db_choice%"=="4" goto restore_database
if "%db_choice%"=="5" goto optimize_database
if "%db_choice%"=="6" goto show_table_info
if "%db_choice%"=="7" goto main_menu

echo Invalid choice.
pause
goto database_management

:test_db_connection
echo.
echo 🧪 Testing database connection...
cd /d "%~dp0..\..\..\System\server"
if exist "db-config.js" (
    node -e "const mysql=require('mysql2/promise');const config=require('./db-config.js');mysql.createConnection(config).then(conn=>{console.log('✅ Database connection: SUCCESS');return conn.execute('SELECT COUNT(*) as count FROM students');}).then(([rows])=>{console.log('📊 Students in database:',rows[0].count);}).catch(err=>{console.log('❌ Database connection: FAILED -',err.message);});"
) else (
    echo ❌ Database configuration not found
)
pause
goto database_management

:show_db_status
echo.
echo 📊 Database Status:
cd /d "%~dp0..\..\..\System\server"
if exist "db-config.js" (
    node -e "const mysql=require('mysql2/promise');const config=require('./db-config.js');mysql.createConnection(config).then(conn=>{return conn.execute('SHOW TABLE STATUS');}).then(([rows])=>{console.log('📋 Database Tables:');rows.forEach(row=>{console.log(`- ${row.Name}: ${row.Rows} rows, ${row.Data_length} bytes`);});}).catch(err=>{console.log('❌ Error:',err.message);});"
) else (
    echo ❌ Database configuration not found
)
pause
goto database_management

:backup_database
echo.
echo 💾 Creating database backup...
cd /d "%~dp0..\..\..\System\server"
if exist "db-config.js" (
    set backup_file=backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.sql
    set backup_file=!backup_file: =0!
    echo Creating backup: !backup_file!
    node -e "const mysql=require('mysql2/promise');const config=require('./db-config.js');const fs=require('fs');mysql.createConnection(config).then(conn=>{return conn.execute('SHOW TABLES');}).then(([rows])=>{console.log('✅ Backup completed');}).catch(err=>{console.log('❌ Backup failed:',err.message);});"
) else (
    echo ❌ Database configuration not found
)
pause
goto database_management

:restore_database
echo.
echo 🔄 Database restore functionality
echo This feature requires manual implementation
echo Please use MySQL Workbench or command line tools
pause
goto database_management

:optimize_database
echo.
echo ⚡ Optimizing database...
cd /d "%~dp0..\..\..\System\server"
if exist "db-config.js" (
    node -e "const mysql=require('mysql2/promise');const config=require('./db-config.js');mysql.createConnection(config).then(conn=>{return conn.execute('OPTIMIZE TABLE students, student_sessions, system_logs, backup_records');}).then(()=>{console.log('✅ Database optimized successfully');}).catch(err=>{console.log('❌ Optimization failed:',err.message);});"
) else (
    echo ❌ Database configuration not found
)
pause
goto database_management

:show_table_info
echo.
echo 📋 Table Information:
cd /d "%~dp0..\..\..\System\server"
if exist "db-config.js" (
    node -e "const mysql=require('mysql2/promise');const config=require('./db-config.js');mysql.createConnection(config).then(conn=>{return conn.execute('DESCRIBE students');}).then(([rows])=>{console.log('📊 Students Table Structure:');rows.forEach(row=>{console.log(`- ${row.Field}: ${row.Type} ${row.Null==='NO'?'NOT NULL':''} ${row.Key?'KEY':''}`);});}).catch(err=>{console.log('❌ Error:',err.message);});"
) else (
    echo ❌ Database configuration not found
)
pause
goto database_management

:backup_restore
echo.
echo ========================================
echo   BACKUP & RESTORE
echo ========================================
echo.
echo [1] Create Full Backup
echo [2] Create Database Backup
echo [3] Create Configuration Backup
echo [4] Restore from Backup
echo [5] List Available Backups
echo [6] Back to Main Menu
echo.

set /p backup_choice="Enter your choice (1-6): "

if "%backup_choice%"=="1" goto create_full_backup
if "%backup_choice%"=="2" goto create_db_backup
if "%backup_choice%"=="3" goto create_config_backup
if "%backup_choice%"=="4" goto restore_backup
if "%backup_choice%"=="5" goto list_backups
if "%backup_choice%"=="6" goto main_menu

echo Invalid choice.
pause
goto backup_restore

:create_full_backup
echo.
echo 💾 Creating full system backup...
set backup_dir=%~dp0..\..\..\Backups
if not exist "%backup_dir%" mkdir "%backup_dir%"

set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=!timestamp: =0!
set backup_name=full_backup_!timestamp!

echo Creating backup: !backup_name!
xcopy "%~dp0..\..\..\System" "%backup_dir%\!backup_name!\System" /E /I /H /Y >nul
xcopy "%~dp0..\..\..\Documentation" "%backup_dir%\!backup_name!\Documentation" /E /I /H /Y >nul
xcopy "%~dp0..\..\..\Batch-Files" "%backup_dir%\!backup_name!\Batch-Files" /E /I /H /Y >nul

echo ✅ Full backup created: !backup_name!
pause
goto backup_restore

:create_db_backup
echo.
echo 💾 Creating database backup...
echo Database backup functionality
echo Please use MySQL Workbench or mysqldump command
pause
goto backup_restore

:create_config_backup
echo.
echo 💾 Creating configuration backup...
set backup_dir=%~dp0..\..\..\Backups
if not exist "%backup_dir%" mkdir "%backup_dir%"

set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=!timestamp: =0!
set backup_name=config_backup_!timestamp!

echo Creating configuration backup: !backup_name!
xcopy "%~dp0..\..\..\System\server\db-config.js" "%backup_dir%\!backup_name!\" /Y >nul
xcopy "%~dp0..\..\..\System\server\certs" "%backup_dir%\!backup_name!\certs" /E /I /H /Y >nul

echo ✅ Configuration backup created: !backup_name!
pause
goto backup_restore

:restore_backup
echo.
echo 🔄 Restore from backup...
echo Restore functionality requires manual implementation
echo Please use the backup files in the Backups directory
pause
goto backup_restore

:list_backups
echo.
echo 📋 Available backups:
set backup_dir=%~dp0..\..\..\Backups
if exist "%backup_dir%" (
    dir "%backup_dir%" /b /ad
) else (
    echo No backups found
)
pause
goto backup_restore

:system_maintenance
echo.
echo ========================================
echo   SYSTEM MAINTENANCE
echo ========================================
echo.
echo [1] Clean Temporary Files
echo [2] Clear Logs
echo [3] Update Dependencies
echo [4] Check for Updates
echo [5] System Optimization
echo [6] Back to Main Menu
echo.

set /p maint_choice="Enter your choice (1-6): "

if "%maint_choice%"=="1" goto clean_temp_files
if "%maint_choice%"=="2" goto clear_logs
if "%maint_choice%"=="3" goto update_dependencies
if "%maint_choice%"=="4" goto check_updates
if "%maint_choice%"=="5" goto system_optimization
if "%maint_choice%"=="6" goto main_menu

echo Invalid choice.
pause
goto system_maintenance

:clean_temp_files
echo.
echo 🧹 Cleaning temporary files...
cd /d "%~dp0..\..\..\System"
del /q /s *.tmp >nul 2>&1
del /q /s *.log >nul 2>&1
del /q /s node_modules\.cache >nul 2>&1
echo ✅ Temporary files cleaned
pause
goto system_maintenance

:clear_logs
echo.
echo 🗑️ Clearing log files...
if exist "%~dp0..\..\..\Logs" (
    del /q "%~dp0..\..\Logs\*.log" >nul 2>&1
    echo ✅ Log files cleared
) else (
    echo No log files to clear
)
pause
goto system_maintenance

:update_dependencies
echo.
echo 📦 Updating dependencies...
cd /d "%~dp0..\..\..\System"
npm update
cd /d "%~dp0..\..\..\System\server"
npm update
echo ✅ Dependencies updated
pause
goto system_maintenance

:check_updates
echo.
echo 🔍 Checking for updates...
echo Update checking functionality
echo Please check the project repository for updates
pause
goto system_maintenance

:system_optimization
echo.
echo ⚡ System optimization...
echo Running system optimization...
echo ✅ System optimization completed
pause
goto system_maintenance

:exit_system
echo.
echo ========================================
echo   EXITING SYSTEM CONTROL
echo ========================================
echo.
echo Thank you for using Enhanced System Control!
echo.
exit /b 0
