@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   Student Lab System - HTTPS Version
echo   Enhanced with Error Recovery
echo ========================================
echo.

REM Set error handling
set "ErrorCount=0"
set "RecoveryAttempts=0"

REM Create logs directory
if not exist "Logs" mkdir "Logs"
set "StartupLog=Logs\https-startup-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log"
set "StartupLog=%StartupLog: =0%"

REM Logging function
:LogMessage
set "Message=%~1"
set "Level=%~2"
set "Color=%~3"
echo [%time%] [%Level%] %Message% >> "%StartupLog%"
if "%Color%"=="SUCCESS" (
    echo ✅ %Message%
) else if "%Color%"=="WARNING" (
    echo ⚠️  %Message%
) else if "%Color%"=="ERROR" (
    echo ❌ %Message%
) else if "%Color%"=="INFO" (
    echo ℹ️  %Message%
) else if "%Color%"=="PROCESS" (
    echo 🔄 %Message%
) else (
    echo %Message%
)
goto :eof

REM Kill existing Node.js processes
:CleanupProcesses
call :LogMessage "🔄 Cleaning up existing processes..." "PROCESS" "PROCESS"
taskkill /f /im node.exe >nul 2>nul
timeout /t 2 /nobreak >nul
call :LogMessage "✅ Processes cleaned up" "INFO" "SUCCESS"
goto :eof

REM Check and fix ports
:CheckPorts
call :LogMessage "🔍 Checking port availability..." "INFO" "INFO"

netstat -an | findstr ":3000" >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "⚠️  Port 3000 is in use, attempting to free it..." "WARNING" "WARNING"
    call :CleanupProcesses
    timeout /t 3 /nobreak >nul
)

netstat -an | findstr ":3443" >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "⚠️  Port 3443 is in use, attempting to free it..." "WARNING" "WARNING"
    call :CleanupProcesses
    timeout /t 3 /nobreak >nul
)

goto :eof

cd /d "C:\Users\hamad\Desktop\stud sys v2\System\server"

call :LogMessage "🔍 Checking system..." "INFO" "INFO"

REM Enhanced file checks with recovery
if not exist "package.json" (
    call :LogMessage "❌ package.json not found!" "ERROR" "ERROR"
    call :LogMessage "   Attempting to recover..." "PROCESS" "PROCESS"
    
    REM Try to find package.json in parent directories
    if exist "..\package.json" (
        copy "..\package.json" "package.json" >nul 2>nul
        call :LogMessage "✅ Recovered package.json from parent directory" "INFO" "SUCCESS"
    ) else (
        call :LogMessage "❌ Cannot recover package.json" "ERROR" "ERROR"
        set /a "ErrorCount+=1"
    )
)

if not exist "main-server.js" (
    call :LogMessage "❌ main-server.js not found!" "ERROR" "ERROR"
    call :LogMessage "   Attempting to recover..." "PROCESS" "PROCESS"
    
    REM Try to find main-server.js in parent directories
    if exist "..\main-server.js" (
        copy "..\main-server.js" "main-server.js" >nul 2>nul
        call :LogMessage "✅ Recovered main-server.js from parent directory" "INFO" "SUCCESS"
    ) else (
        call :LogMessage "❌ Cannot recover main-server.js" "ERROR" "ERROR"
        set /a "ErrorCount+=1"
    )
)

REM Check for critical errors
if %ErrorCount% gtr 0 (
    call :LogMessage "❌ Critical errors found. Cannot start system." "ERROR" "ERROR"
    pause
    exit /b 1
)

call :LogMessage "✅ Files found, starting system with HTTPS support..." "INFO" "SUCCESS"
echo.

REM Check and fix ports before starting
call :CheckPorts

REM Enhanced SSL certificate check with auto-generation
if exist "certs\server.key" if exist "certs\server.crt" (
    call :LogMessage "🔒 SSL certificates found - HTTPS will be enabled" "INFO" "SUCCESS"
    echo.
    call :LogMessage "The system will start with:" "INFO" "INFO"
    call :LogMessage "  • HTTP server on port 3000" "INFO" "INFO"
    call :LogMessage "  • HTTPS server on port 3443 (for phone camera access)" "INFO" "INFO"
    call :LogMessage "  • WebSocket attached to HTTP/HTTPS servers" "INFO" "INFO"
    call :LogMessage "  • Clean organized structure" "INFO" "INFO"
    echo.
    call :LogMessage "Press Ctrl+C to stop the server when done." "WARNING" "WARNING"
    echo.
    call :LogMessage "Access URLs:" "INFO" "INFO"
    call :LogMessage "  HTTP URLs:" "INFO" "INFO"
    call :LogMessage "    Entry Scanner:  http://localhost:3000/entry-scanner" "INFO" "INFO"
    call :LogMessage "    Exit Validator: http://localhost:3000/exit-validator" "INFO" "INFO"
    call :LogMessage "    Admin Dashboard: http://localhost:3000/admin-dashboard" "INFO" "INFO"
    echo.
    call :LogMessage "  HTTPS URLs (for phone camera):" "INFO" "INFO"
    call :LogMessage "    Entry Scanner:  https://localhost:3443/entry-scanner" "INFO" "INFO"
    call :LogMessage "    Exit Validator: https://localhost:3443/exit-validator" "INFO" "INFO"
    call :LogMessage "    Admin Dashboard: https://localhost:3443/admin-dashboard" "INFO" "INFO"
    echo.
    call :LogMessage "  For phone access, use your computer's IP:" "INFO" "INFO"
    call :LogMessage "    https://YOUR_IP:3443/entry-scanner" "INFO" "INFO"
    echo.
) else (
    call :LogMessage "⚠️  SSL certificates not found!" "WARNING" "WARNING"
    call :LogMessage "   certs\server.key or certs\server.crt missing" "WARNING" "WARNING"
    echo.
    call :LogMessage "🔄 Attempting to generate certificates automatically..." "PROCESS" "PROCESS"
    
    REM Try to generate certificates automatically
    if exist "generate-ssl-cert.bat" (
        call generate-ssl-cert.bat
        if exist "certs\server.key" if exist "certs\server.crt" (
            call :LogMessage "✅ Certificates generated successfully!" "INFO" "SUCCESS"
            goto :StartWithHTTPS
        )
    )
    
    call :LogMessage "❌ Could not generate certificates automatically" "ERROR" "ERROR"
    call :LogMessage "HTTPS will be disabled. Only HTTP will work." "WARNING" "WARNING"
    echo.
    call :LogMessage "To enable HTTPS, run: generate-ssl-cert.bat" "INFO" "INFO"
    echo.
    call :LogMessage "The system will start with:" "INFO" "INFO"
    call :LogMessage "  • HTTP server on port 3000 only" "INFO" "INFO"
    call :LogMessage "  • WebSocket attached to HTTP server" "INFO" "INFO"
    call :LogMessage "  • Clean organized structure" "INFO" "INFO"
    echo.
    call :LogMessage "Press Ctrl+C to stop the server when done." "WARNING" "WARNING"
    echo.
    call :LogMessage "Access URLs:" "INFO" "INFO"
    call :LogMessage "  Entry Scanner:  http://localhost:3000/entry-scanner" "INFO" "INFO"
    call :LogMessage "  Exit Validator: http://localhost:3000/exit-validator" "INFO" "INFO"
    call :LogMessage "  Admin Dashboard: http://localhost:3000/admin-dashboard" "INFO" "INFO"
    echo.
)

:StartWithHTTPS

call :LogMessage "🚀 Starting server..." "PROCESS" "PROCESS"
echo ========================================

REM Enhanced startup with error handling
:StartServer
call :LogMessage "   Attempting to start server..." "INFO" "INFO"

REM Check if npm is available
where npm >nul 2>nul
if %errorlevel% neq 0 (
    call :LogMessage "❌ npm not found, trying direct node execution..." "WARNING" "WARNING"
    node main-server.js
    if %errorlevel% neq 0 (
        call :LogMessage "❌ Server startup failed!" "ERROR" "ERROR"
        call :LogMessage "   Error code: %errorlevel%" "ERROR" "ERROR"
        goto :ErrorRecovery
    )
) else (
    npm run dev-simple
    if %errorlevel% neq 0 (
        call :LogMessage "❌ npm run dev-simple failed, trying direct node execution..." "WARNING" "WARNING"
        node main-server.js
        if %errorlevel% neq 0 (
            call :LogMessage "❌ Server startup failed!" "ERROR" "ERROR"
            call :LogMessage "   Error code: %errorlevel%" "ERROR" "ERROR"
            goto :ErrorRecovery
        )
    )
)

goto :ServerStopped

:ErrorRecovery
set /a "RecoveryAttempts+=1"
if %RecoveryAttempts% lss 3 (
    call :LogMessage "🔄 Attempting recovery (attempt %RecoveryAttempts%/3)..." "PROCESS" "PROCESS"
    
    REM Try to fix common issues
    call :CleanupProcesses
    timeout /t 3 /nobreak >nul
    
    REM Check if dependencies are installed
    if not exist "node_modules" (
        call :LogMessage "   Installing missing dependencies..." "INFO" "INFO"
        npm install --production --silent
    )
    
    goto :StartServer
) else (
    call :LogMessage "❌ Maximum recovery attempts reached!" "ERROR" "ERROR"
    call :LogMessage "   Please check the log file: %StartupLog%" "ERROR" "ERROR"
    call :LogMessage "   Manual intervention required." "ERROR" "ERROR"
)

:ServerStopped
echo.
call :LogMessage "🛑 System stopped." "INFO" "INFO"
call :LogMessage "📁 Log file: %StartupLog%" "INFO" "INFO"
pause
