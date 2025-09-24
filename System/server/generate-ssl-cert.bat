@echo off
echo ========================================
echo   SSL Certificate Generator for HTTPS
echo ========================================
echo.

REM Check if OpenSSL is available
where openssl >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ OpenSSL not found in PATH
    echo.
    echo Please install OpenSSL first:
    echo 1. Download from: https://slproweb.com/products/Win32OpenSSL.html
    echo 2. Or install via Chocolatey: choco install openssl
    echo 3. Or use Git Bash (includes OpenSSL)
    echo.
    pause
    exit /b 1
)

echo ✅ OpenSSL found
echo.

REM Create certs directory if it doesn't exist
if not exist "certs" mkdir certs

echo 🔐 Generating self-signed SSL certificate...
echo.

REM Generate private key
echo Generating private key...
openssl genrsa -out certs\server.key 2048

REM Generate certificate
echo Generating certificate...
openssl req -new -x509 -key certs\server.key -out certs\server.crt -days 365 -subj "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"

echo.
echo ✅ SSL certificate generated successfully!
echo.
echo Files created:
echo   📁 certs\server.key  (Private Key)
echo   📁 certs\server.crt  (Certificate)
echo.
echo 🔒 HTTPS will now be enabled when you restart the server
echo.
echo ⚠️  Note: This is a self-signed certificate
echo    - Browsers will show a security warning
echo    - Click "Advanced" and "Proceed to localhost" to continue
echo    - This is normal for development/testing
echo.
pause
