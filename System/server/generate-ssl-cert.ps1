# SSL Certificate Generator for HTTPS
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SSL Certificate Generator for HTTPS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if OpenSSL is available
try {
    $opensslVersion = & openssl version 2>$null
    Write-Host "✅ OpenSSL found: $opensslVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ OpenSSL not found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install OpenSSL first:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor White
    Write-Host "2. Or install via Chocolatey: choco install openssl" -ForegroundColor White
    Write-Host "3. Or use Git Bash (includes OpenSSL)" -ForegroundColor White
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Create certs directory if it doesn't exist
if (!(Test-Path "certs")) {
    New-Item -ItemType Directory -Path "certs" | Out-Null
    Write-Host "📁 Created certs directory" -ForegroundColor Green
}

Write-Host "🔐 Generating self-signed SSL certificate..." -ForegroundColor Yellow
Write-Host ""

# Generate private key
Write-Host "Generating private key..." -ForegroundColor White
& openssl genrsa -out "certs\server.key" 2048

# Generate certificate
Write-Host "Generating certificate..." -ForegroundColor White
& openssl req -new -x509 -key "certs\server.key" -out "certs\server.crt" -days 365 -subj "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"

Write-Host ""
Write-Host "✅ SSL certificate generated successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Files created:" -ForegroundColor Cyan
Write-Host "  📁 certs\server.key  (Private Key)" -ForegroundColor White
Write-Host "  📁 certs\server.crt  (Certificate)" -ForegroundColor White
Write-Host ""
Write-Host "🔒 HTTPS will now be enabled when you restart the server" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  Note: This is a self-signed certificate" -ForegroundColor Yellow
Write-Host "   - Browsers will show a security warning" -ForegroundColor White
Write-Host "   - Click 'Advanced' and 'Proceed to localhost' to continue" -ForegroundColor White
Write-Host "   - This is normal for development/testing" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to continue"
