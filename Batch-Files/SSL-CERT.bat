@echo off
title SSL Certificate Generator
color 0B

echo.
echo ========================================
echo   SSL Certificate Generator for HTTPS
echo ========================================
echo.

REM Check if OpenSSL is available
where openssl >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: OpenSSL not found in PATH
    echo.
    echo Please install OpenSSL first:
    echo 1. Download from: https://slproweb.com/products/Win32OpenSSL.html
    echo 2. Or install via Chocolatey: choco install openssl
    echo 3. Or use Git Bash (includes OpenSSL)
    echo.
    pause
    exit /b 1
)

echo OK OpenSSL found
echo.

REM Navigate to server directory and create certs directory
cd /d "%~dp0..\System\server"
if not exist "certs" mkdir certs

echo  Generating self-signed SSL certificate...
echo.

REM Generate private key
echo Generating private key...
openssl genrsa -out certs\server.key 2048
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate private key!
    pause
    exit /b 1
)

REM Generate certificate
echo Generating certificate...
openssl req -new -x509 -key certs\server.key -out certs\server.crt -days 365 -subj "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate certificate!
    pause
    exit /b 1
)

echo.
echo OK SSL certificate generated successfully!
echo.
echo Files created:
echo    System\server\certs\server.key  (Private Key)
echo    System\server\certs\server.crt  (Certificate)
echo.
echo  HTTPS will now be enabled when you restart the server
echo.
echo WARNING:  Note: This is a self-signed certificate
echo    - Browsers will show a security warning
echo    - Click "Advanced" and "Proceed to localhost" to continue
echo    - This is normal for development/testing
echo.
echo  To use HTTPS:
echo    1. Restart the server
echo    2. Access: https://localhost:3443
echo    3. Accept the security warning
echo.
pause
