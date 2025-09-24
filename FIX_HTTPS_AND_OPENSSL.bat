@echo off
echo ========================================
echo   HTTPS ^& OpenSSL Auto-Fix Script
echo   Student Lab System
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ⚠️  Not running as administrator
    echo    Some operations may require elevated privileges
    echo.
)

echo 🔍 Checking OpenSSL installation...

REM Check if OpenSSL is available
where openssl >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ OpenSSL found
    openssl version
    goto :check_certs
)

echo ⚠️  OpenSSL not found in PATH
echo.

REM Try to find OpenSSL in common locations
if exist "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" (
    echo ✅ Found OpenSSL at: C:\Program Files\OpenSSL-Win64\bin\openssl.exe
    set "PATH=%PATH%;C:\Program Files\OpenSSL-Win64\bin"
    goto :check_certs
)

if exist "C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe" (
    echo ✅ Found OpenSSL at: C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe
    set "PATH=%PATH%;C:\Program Files (x86)\OpenSSL-Win64\bin"
    goto :check_certs
)

if exist "C:\Program Files\Git\usr\bin\openssl.exe" (
    echo ✅ Found OpenSSL at: C:\Program Files\Git\usr\bin\openssl.exe
    set "PATH=%PATH%;C:\Program Files\Git\usr\bin"
    goto :check_certs
)

echo 📦 Installing OpenSSL...

REM Try winget
echo    Trying winget...
winget install OpenSSL --accept-package-agreements --accept-source-agreements >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ OpenSSL installed via winget
    goto :check_certs
)

REM Try chocolatey
echo    Trying chocolatey...
where choco >nul 2>nul
if %errorlevel% equ 0 (
    choco install openssl -y >nul 2>&1
    if %errorlevel% equ 0 (
        echo ✅ OpenSSL installed via chocolatey
        goto :check_certs
    )
)

echo ❌ Automatic installation failed
echo.
echo 📥 Please download OpenSSL manually:
echo    1. Go to: https://slproweb.com/products/Win32OpenSSL.html
echo    2. Download: Win64 OpenSSL v3.x.x
echo    3. Install with default settings
echo    4. Run this script again
echo.
pause
exit /b 1

:check_certs
echo.
echo 🔐 Checking SSL certificates...

if not exist "%~dp0System\server\certs" mkdir "%~dp0System\server\certs"

if exist "%~dp0System\server\certs\server.key" if exist "%~dp0System\server\certs\server.crt" (
    echo ✅ SSL certificates already exist
    goto :test_system
)

echo 📦 Generating SSL certificates...

REM Generate private key
echo    Generating private key...
openssl genrsa -out "%~dp0System\server\certs\server.key" 2048
if %errorlevel% neq 0 (
    echo ❌ Failed to generate private key
    pause
    exit /b 1
)

REM Generate certificate
echo    Generating certificate...
openssl req -new -x509 -key "%~dp0System\server\certs\server.key" -out "%~dp0System\server\certs\server.crt" -days 365 -subj "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"
if %errorlevel% neq 0 (
    echo ❌ Failed to generate certificate
    pause
    exit /b 1
)

echo ✅ SSL certificates generated successfully!
echo    📁 System\server\certs\server.key
echo    📁 System\server\certs\server.crt

:test_system
echo.
echo 🔍 Testing system health...

REM Check Node.js
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Node.js: 
    node --version
) else (
    echo ❌ Node.js not found
    set "issues=1"
)

REM Check npm
where npm >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ npm: 
    npm --version
) else (
    echo ❌ npm not found
    set "issues=1"
)

REM Check OpenSSL
where openssl >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ OpenSSL: 
    openssl version
) else (
    echo ❌ OpenSSL not found
    set "issues=1"
)

REM Check certificates
if exist "System\server\certs\server.key" if exist "System\server\certs\server.crt" (
    echo ✅ SSL certificates: Present
) else (
    echo ❌ SSL certificates missing
    set "issues=1"
)

REM Check main server file
if exist "%~dp0System\server\main-server.js" (
    echo ✅ Main server: Present
) else (
    echo ❌ Main server file missing
    set "issues=1"
)

REM Check package.json
if exist "%~dp0System\server\package.json" (
    echo ✅ Package.json: Present
) else (
    echo ❌ Package.json missing
    set "issues=1"
)

if defined issues (
    echo.
    echo ⚠️  System has issues. Fix them before starting.
    pause
    exit /b 1
)

echo.
echo 🎉 All systems healthy!
echo.
echo 🎯 System is ready!
echo.
echo Available startup options:
echo    • START_CLEAN_SYSTEM.bat (Auto-detect)
echo    • START_CLEAN_SYSTEM_HTTPS.bat (HTTPS enabled)
echo    • START_CLEAN_SYSTEM_HTTP_ONLY.bat (HTTP only)
echo.

set /p startNow="Start the system now? (y/N): "
if /i "%startNow%"=="y" (
    echo.
    echo 🚀 Starting Student Lab System...
    echo    Press Ctrl+C to stop
    echo.
    
    cd /d "%~dp0System\server"
    
    REM Install dependencies if needed
    if not exist "node_modules" (
        echo 📦 Installing dependencies...
        npm install
    )
    
    REM Start the server
    node main-server.js
) else (
    echo.
    echo ✅ Setup complete! Run any of the startup scripts when ready.
)

echo.
echo 🎉 HTTPS ^& OpenSSL setup complete!
pause
