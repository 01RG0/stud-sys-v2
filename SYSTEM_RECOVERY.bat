@echo off
setlocal enabledelayedexpansion
echo ========================================
echo   SYSTEM RECOVERY TOOL
echo   Student Lab System - Emergency Fix
echo ========================================
echo.

REM Set error handling
set "RecoveryCount=0"
set "SuccessCount=0"

REM Create logs directory
if not exist "Logs" mkdir "Logs"
set "RecoveryLog=Logs\recovery-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log"
set "RecoveryLog=%RecoveryLog: =0%"

REM Logging function
:LogMessage
set "Message=%~1"
set "Level=%~2"
set "Color=%~3"
echo [%time%] [%Level%] %Message% >> "%RecoveryLog%"
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

REM Kill all Node.js processes
:KillAllNode
call :LogMessage "🔄 Killing all Node.js processes..." "PROCESS" "PROCESS"
taskkill /f /im node.exe >nul 2>nul
taskkill /f /im npm.exe >nul 2>nul
taskkill /f /im nodemon.exe >nul 2>nul
timeout /t 3 /nobreak >nul
call :LogMessage "✅ All Node.js processes terminated" "INFO" "SUCCESS"
set /a "SuccessCount+=1"
goto :eof

REM Clean up ports
:CleanPorts
call :LogMessage "🔄 Cleaning up ports..." "PROCESS" "PROCESS"

REM Kill processes using ports 3000 and 3443
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
    taskkill /f /pid %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3443"') do (
    taskkill /f /pid %%a >nul 2>nul
)

timeout /t 2 /nobreak >nul
call :LogMessage "✅ Ports cleaned up" "INFO" "SUCCESS"
set /a "SuccessCount+=1"
goto :eof

REM Reset Node.js installation
:ResetNode
call :LogMessage "🔄 Resetting Node.js installation..." "PROCESS" "PROCESS"

REM Clear npm cache
where npm >nul 2>nul
if %errorlevel% equ 0 (
    npm cache clean --force >nul 2>nul
    call :LogMessage "✅ npm cache cleared" "INFO" "SUCCESS"
)

REM Remove node_modules and package-lock.json
if exist "%~dp0System\server\node_modules" (
    rmdir /s /q "%~dp0System\server\node_modules" >nul 2>nul
    call :LogMessage "✅ node_modules removed" "INFO" "SUCCESS"
)

if exist "%~dp0System\server\package-lock.json" (
    del "%~dp0System\server\package-lock.json" >nul 2>nul
    call :LogMessage "✅ package-lock.json removed" "INFO" "SUCCESS"
)

set /a "SuccessCount+=1"
goto :eof

REM Reinstall dependencies
:ReinstallDeps
call :LogMessage "🔄 Reinstalling dependencies..." "PROCESS" "PROCESS"

cd /d "%~dp0System\server"

REM Install dependencies
npm install --production --silent
if %errorlevel% equ 0 (
    call :LogMessage "✅ Dependencies reinstalled successfully" "INFO" "SUCCESS"
    set /a "SuccessCount+=1"
) else (
    call :LogMessage "❌ Dependency reinstallation failed" "ERROR" "ERROR"
)

cd /d "%~dp0"
goto :eof

REM Regenerate certificates
:RegenerateCerts
call :LogMessage "🔄 Regenerating SSL certificates..." "PROCESS" "PROCESS"

REM Remove existing certificates
if exist "%~dp0System\server\certs" (
    rmdir /s /q "%~dp0System\server\certs" >nul 2>nul
    call :LogMessage "✅ Old certificates removed" "INFO" "SUCCESS"
)

REM Create new certificate directory
mkdir "%~dp0System\server\certs" >nul 2>nul

REM Find OpenSSL
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
    call :LogMessage "❌ OpenSSL not found, cannot generate certificates" "ERROR" "ERROR"
    goto :eof
)

REM Generate new certificates
"%OpenSSLExe%" genrsa -out "%~dp0System\server\certs\server.key" 2048 >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ Private key generated" "INFO" "SUCCESS"
) else (
    call :LogMessage "❌ Failed to generate private key" "ERROR" "ERROR"
    goto :eof
)

"%OpenSSLExe%" req -new -x509 -key "%~dp0System\server\certs\server.key" -out "%~dp0System\server\certs\server.crt" -days 365 -subj "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost" >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ Certificate generated" "INFO" "SUCCESS"
    set /a "SuccessCount+=1"
) else (
    call :LogMessage "❌ Failed to generate certificate" "ERROR" "ERROR"
)

goto :eof

REM Fix file permissions
:FixPermissions
call :LogMessage "🔄 Fixing file permissions..." "PROCESS" "PROCESS"

REM Take ownership of project directory
takeown /f "%~dp0" /r /d y >nul 2>nul
icacls "%~dp0" /grant Everyone:F /t >nul 2>nul

call :LogMessage "✅ File permissions fixed" "INFO" "SUCCESS"
set /a "SuccessCount+=1"
goto :eof

REM System health check
:HealthCheck
call :LogMessage "🔍 Performing system health check..." "INFO" "INFO"

set "HealthScore=0"
set "TotalChecks=8"

REM Check Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ Node.js: OK" "INFO" "SUCCESS"
    set /a "HealthScore+=1"
) else (
    call :LogMessage "❌ Node.js: MISSING" "ERROR" "ERROR"
)

REM Check npm
where npm >nul 2>nul
if %errorlevel% equ 0 (
    call :LogMessage "✅ npm: OK" "INFO" "SUCCESS"
    set /a "HealthScore+=1"
) else (
    call :LogMessage "❌ npm: MISSING" "ERROR" "ERROR"
)

REM Check main server file
if exist "%~dp0System\server\main-server.js" (
    call :LogMessage "✅ Main Server: OK" "INFO" "SUCCESS"
    set /a "HealthScore+=1"
) else (
    call :LogMessage "❌ Main Server: MISSING" "ERROR" "ERROR"
)

REM Check package.json
if exist "%~dp0System\server\package.json" (
    call :LogMessage "✅ Package.json: OK" "INFO" "SUCCESS"
    set /a "HealthScore+=1"
) else (
    call :LogMessage "❌ Package.json: MISSING" "ERROR" "ERROR"
)

REM Check node_modules
if exist "%~dp0System\server\node_modules" (
    call :LogMessage "✅ Node Modules: OK" "INFO" "SUCCESS"
    set /a "HealthScore+=1"
) else (
    call :LogMessage "❌ Node Modules: MISSING" "ERROR" "ERROR"
)

REM Check SSL certificates
if exist "%~dp0System\server\certs\server.key" if exist "%~dp0System\server\certs\server.crt" (
    call :LogMessage "✅ SSL Certificates: OK" "INFO" "SUCCESS"
    set /a "HealthScore+=1"
) else (
    call :LogMessage "❌ SSL Certificates: MISSING" "ERROR" "ERROR"
)

REM Check ports
netstat -an | findstr ":3000" >nul 2>nul
if %errorlevel% neq 0 (
    call :LogMessage "✅ Port 3000: FREE" "INFO" "SUCCESS"
    set /a "HealthScore+=1"
) else (
    call :LogMessage "❌ Port 3000: IN USE" "ERROR" "ERROR"
)

netstat -an | findstr ":3443" >nul 2>nul
if %errorlevel% neq 0 (
    call :LogMessage "✅ Port 3443: FREE" "INFO" "SUCCESS"
    set /a "HealthScore+=1"
) else (
    call :LogMessage "❌ Port 3443: IN USE" "ERROR" "ERROR"
)

set /a "HealthPercentage=(HealthScore * 100) / TotalChecks"
call :LogMessage "📊 Health Score: !HealthPercentage!% (!HealthScore!/!TotalChecks!)" "INFO" "INFO"

goto :eof

REM Main recovery menu
:MainMenu
echo.
call :LogMessage "🔧 SYSTEM RECOVERY MENU" "INFO" "INFO"
echo.
echo 1. Kill all Node.js processes
echo 2. Clean up ports
echo 3. Reset Node.js installation
echo 4. Reinstall dependencies
echo 5. Regenerate SSL certificates
echo 6. Fix file permissions
echo 7. System health check
echo 8. Full recovery (all steps)
echo 9. Exit
echo.

set /p choice="Select option (1-9): "

if "%choice%"=="1" (
    call :KillAllNode
    goto :MainMenu
) else if "%choice%"=="2" (
    call :CleanPorts
    goto :MainMenu
) else if "%choice%"=="3" (
    call :ResetNode
    goto :MainMenu
) else if "%choice%"=="4" (
    call :ReinstallDeps
    goto :MainMenu
) else if "%choice%"=="5" (
    call :RegenerateCerts
    goto :MainMenu
) else if "%choice%"=="6" (
    call :FixPermissions
    goto :MainMenu
) else if "%choice%"=="7" (
    call :HealthCheck
    goto :MainMenu
) else if "%choice%"=="8" (
    call :LogMessage "🚀 Starting full recovery..." "PROCESS" "PROCESS"
    call :KillAllNode
    call :CleanPorts
    call :ResetNode
    call :ReinstallDeps
    call :RegenerateCerts
    call :FixPermissions
    call :HealthCheck
    call :LogMessage "🎉 Full recovery completed!" "INFO" "SUCCESS"
    goto :MainMenu
) else if "%choice%"=="9" (
    goto :Exit
) else (
    call :LogMessage "❌ Invalid option" "ERROR" "ERROR"
    goto :MainMenu
)

:Exit
echo.
call :LogMessage "📊 Recovery Summary:" "INFO" "INFO"
call :LogMessage "   Successful operations: %SuccessCount%" "INFO" "INFO"
call :LogMessage "📁 Log file: %RecoveryLog%" "INFO" "INFO"
echo.
call :LogMessage "🎉 Recovery tool completed!" "INFO" "SUCCESS"
pause
