@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   ENHANCED SYSTEM SETUP - BULLETPROOF
echo   Student Lab System - Zero Error Version
echo ========================================
echo.

REM Set error handling
set "ErrorCount=0"
set "WarningCount=0"
set "RecoveryActions=0"

REM Create logs directory
if not exist "Logs" mkdir "Logs"
set "SetupLog=Logs\enhanced-setup-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log"
set "SetupLog=%SetupLog: =0%"

REM Logging function
:LogMessage
set "Message=%~1"
set "Level=%~2"
set "Color=%~3"
echo [%time%] [%Level%] %Message% >> "%SetupLog%"
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

REM System health check function
:CheckSystemHealth
call :LogMessage "🔍 Performing comprehensive system health check..." "INFO" "INFO"
set "HealthScore=0"
set "TotalChecks=12"
set "PassedChecks=0"

REM Check Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ Node.js: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Node.js: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
    set "RecoveryActions=!RecoveryActions! InstallNode"
)

REM Check npm
where npm >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ npm: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ npm: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
    set "RecoveryActions=!RecoveryActions! InstallNode"
)

REM Check OpenSSL
where openssl >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ OpenSSL: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ OpenSSL: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
    set "RecoveryActions=!RecoveryActions! InstallOpenSSL"
)

REM Check main server file
if exist "System\server\main-server.js" (
    call :LogMessage "✅ Main Server File: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Main Server File: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
)

REM Check package.json
if exist "System\server\package.json" (
    call :LogMessage "✅ Package.json: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Package.json: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
)

REM Check student database
if exist "Student-Data\students-database.xlsx" (
    call :LogMessage "✅ Student Database: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Student Database: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
)

REM Check web interface
if exist "System\web-interface" (
    call :LogMessage "✅ Web Interface: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Web Interface: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
)

REM Check SSL certificates
if exist "System\server\certs\server.key" if exist "System\server\certs\server.crt" (
    call :LogMessage "✅ SSL Certificates: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ SSL Certificates: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
    set "RecoveryActions=!RecoveryActions! GenerateCerts"
)

REM Check node_modules
if exist "System\server\node_modules" (
    call :LogMessage "✅ Node Modules: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Node Modules: FAILED" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
    set "RecoveryActions=!RecoveryActions! InstallDeps"
)

REM Check port 3000
netstat -an | findstr ":3000" >nul 2>nul
if %errorlevel% neq 0 (
    call :LogMessage "✅ Port 3000: FREE" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Port 3000: IN USE" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
    set "RecoveryActions=!RecoveryActions! KillNode"
)

REM Check port 3443
netstat -an | findstr ":3443" >nul 2>nul
if %errorlevel% neq 0 (
    call :LogMessage "✅ Port 3443: FREE" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Port 3443: IN USE" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
    set "RecoveryActions=!RecoveryActions! KillNode"
)

REM Check disk space
for /f "tokens=3" %%a in ('dir /-c ^| findstr "bytes free"') do set "FreeSpace=%%a"
if %FreeSpace% gtr 1000000000 (
    call :LogMessage "✅ Disk Space: OK" "INFO" "SUCCESS"
    set /a "PassedChecks+=1"
) else (
    call :LogMessage "❌ Disk Space: LOW" "WARNING" "ERROR"
    set /a "ErrorCount+=1"
)

REM Calculate health score
set /a "HealthScore=(PassedChecks * 100) / TotalChecks"
call :LogMessage "📊 System Health Score: !HealthScore!% (!PassedChecks!/!TotalChecks! checks passed)" "INFO" "INFO"
goto :eof

REM Install Node.js function
:InstallNode
call :LogMessage "📦 Installing Node.js..." "PROCESS" "PROCESS"

REM Try winget first
winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements --silent >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ Node.js installed via winget" "INFO" "SUCCESS"
    goto :eof
)

REM Try chocolatey
where choco >nul 2>nul
if %errorlevel% equ 0 (
    choco install nodejs -y --force >nul 2>nul
    if %errorlevel% equ 0 (
        call :LogMessage "✅ Node.js installed via chocolatey" "INFO" "SUCCESS"
        goto :eof
    )
)

call :LogMessage "❌ Node.js installation failed" "ERROR" "ERROR"
goto :eof

REM Install OpenSSL function
:InstallOpenSSL
call :LogMessage "🔐 Installing OpenSSL..." "PROCESS" "PROCESS"

REM Try winget first
winget install OpenSSL --accept-package-agreements --accept-source-agreements --silent >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ OpenSSL installed via winget" "INFO" "SUCCESS"
    goto :eof
)

REM Try chocolatey
where choco >nul 2>nul
if %errorlevel% equ 0 (
    choco install openssl -y --force >nul 2>nul
    if %errorlevel% equ 0 (
        call :LogMessage "✅ OpenSSL installed via chocolatey" "INFO" "SUCCESS"
        goto :eof
    )
)

REM Try Git Bash OpenSSL
if exist "C:\Program Files\Git\usr\bin\openssl.exe" (
    set "PATH=%PATH%;C:\Program Files\Git\usr\bin"
    call :LogMessage "✅ Using Git Bash OpenSSL" "INFO" "SUCCESS"
    goto :eof
)

call :LogMessage "❌ OpenSSL installation failed" "ERROR" "ERROR"
goto :eof

REM Generate certificates function
:GenerateCerts
call :LogMessage "🔐 Generating SSL certificates..." "PROCESS" "PROCESS"

if not exist "System\server\certs" mkdir "System\server\certs"

REM Find OpenSSL executable
set "OpenSSLExe="
where openssl >nul 2>nul
if %errorlevel% equ 0 (
    set "OpenSSLExe=openssl"
) else if exist "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" (
    set "OpenSSLExe=C:\Program Files\OpenSSL-Win64\bin\openssl.exe"
) else if exist "C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe" (
    set "OpenSSLExe=C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe"
) else if exist "C:\Program Files\Git\usr\bin\openssl.exe" (
    set "OpenSSLExe=C:\Program Files\Git\usr\bin\openssl.exe"
)

if "%OpenSSLExe%"=="" (
    call :LogMessage "❌ OpenSSL executable not found" "ERROR" "ERROR"
    goto :eof
)

REM Generate private key
call :LogMessage "   Generating private key..." "INFO" "INFO"
"%OpenSSLExe%" genrsa -out "System\server\certs\server.key" 2048
if %errorlevel% neq 0 (
    call :LogMessage "❌ Failed to generate private key" "ERROR" "ERROR"
    goto :eof
)

REM Generate certificate
call :LogMessage "   Generating certificate..." "INFO" "INFO"
"%OpenSSLExe%" req -new -x509 -key "System\server\certs\server.key" -out "System\server\certs\server.crt" -days 365 -subj "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"
if %errorlevel% neq 0 (
    call :LogMessage "❌ Failed to generate certificate" "ERROR" "ERROR"
    goto :eof
)

call :LogMessage "✅ SSL certificates generated successfully!" "INFO" "SUCCESS"
goto :eof

REM Install dependencies function
:InstallDeps
call :LogMessage "📦 Installing dependencies..." "PROCESS" "PROCESS"

cd /d "System\server"

REM Clean install if needed
if exist "node_modules" (
    call :LogMessage "   Cleaning existing node_modules..." "INFO" "INFO"
    rmdir /s /q "node_modules" >nul 2>nul
    del "package-lock.json" >nul 2>nul
)

REM Install dependencies
call :LogMessage "   Installing npm packages..." "INFO" "INFO"
npm install --production --silent
if %errorlevel% equ 0 (
    call :LogMessage "✅ Dependencies installed successfully" "INFO" "SUCCESS"
) else (
    call :LogMessage "❌ Dependency installation failed" "ERROR" "ERROR"
)

cd /d "%~dp0"
goto :eof

REM Kill Node.js processes function
:KillNode
call :LogMessage "🔄 Stopping Node.js processes..." "PROCESS" "PROCESS"
taskkill /f /im node.exe >nul 2>nul
timeout /t 2 /nobreak >nul
call :LogMessage "✅ Node.js processes stopped" "INFO" "SUCCESS"
goto :eof

REM Recovery function
:Recovery
call :LogMessage "🔧 Attempting automatic recovery..." "PROCESS" "PROCESS"

for %%a in (%RecoveryActions%) do (
    if "%%a"=="InstallNode" call :InstallNode
    if "%%a"=="InstallOpenSSL" call :InstallOpenSSL
    if "%%a"=="GenerateCerts" call :GenerateCerts
    if "%%a"=="InstallDeps" call :InstallDeps
    if "%%a"=="KillNode" call :KillNode
)

goto :eof

REM Main execution
call :LogMessage "Starting enhanced system setup..." "INFO" "INFO"
echo.

REM Initial system health check
call :CheckSystemHealth
echo.

REM Install Node.js if needed
if %ErrorCount% gtr 0 (
    call :LogMessage "Installing missing components..." "PROCESS" "PROCESS"
    call :Recovery
    echo.
    
    REM Re-check system health
    call :LogMessage "Re-checking system health..." "INFO" "INFO"
    call :CheckSystemHealth
    echo.
)

REM System status
if %HealthScore% geq 80 (
    call :LogMessage "🎉 System is ready for production!" "INFO" "SUCCESS"
) else if %HealthScore% geq 60 (
    call :LogMessage "⚠️  System is functional but has some issues" "WARNING" "WARNING"
) else (
    call :LogMessage "❌ System has critical issues that need attention" "ERROR" "ERROR"
)

echo.
call :LogMessage "📊 Setup Summary:" "INFO" "INFO"
call :LogMessage "   Health Score: %HealthScore%%" "INFO" "INFO"
call :LogMessage "   Errors: %ErrorCount%" "INFO" "INFO"
call :LogMessage "   Recovery Actions: %RecoveryActions%" "INFO" "INFO"
echo.
call :LogMessage "📁 Log file: %SetupLog%" "INFO" "INFO"

REM Ask if user wants to start the system
if %HealthScore% geq 60 (
    echo.
    set /p startNow="Start the system now? (y/N): "
    if /i "%startNow%"=="y" (
        echo.
        call :LogMessage "🚀 Starting Student Lab System..." "PROCESS" "PROCESS"
        call :LogMessage "   Press Ctrl+C to stop" "WARNING" "WARNING"
        echo.
        
        cd /d "System\server"
        node main-server.js
    ) else (
        echo.
        call :LogMessage "✅ Setup complete! Run any of the startup scripts when ready." "INFO" "SUCCESS"
    )
) else (
    echo.
    call :LogMessage "⚠️  Please fix critical errors before starting the system." "WARNING" "WARNING"
)

echo.
call :LogMessage "🎉 Enhanced setup complete!" "INFO" "SUCCESS"
pause
