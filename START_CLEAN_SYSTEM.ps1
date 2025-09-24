# Student Lab System - Auto-Detect (PowerShell Version)
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Student Lab System - Auto-Detect" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to the server directory
Set-Location "C:\Users\hamad\Desktop\stud-sys-v2\System\server"

Write-Host "Checking system..." -ForegroundColor Yellow

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: package.json not found!" -ForegroundColor Red
    Write-Host "Make sure you're in the System\server directory" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if main-server.js exists
if (-not (Test-Path "main-server.js")) {
    Write-Host "ERROR: main-server.js not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "✅ Files found, starting system with auto-detection..." -ForegroundColor Green
Write-Host ""

# Check for SSL certificates
if ((Test-Path "certs\server.key") -and (Test-Path "certs\server.crt")) {
    Write-Host "🔒 SSL certificates found - HTTPS will be enabled" -ForegroundColor Green
    Write-Host ""
    Write-Host "The system will start with:" -ForegroundColor White
    Write-Host "  • HTTP server on port 3000" -ForegroundColor White
    Write-Host "  • HTTPS server on port 3443 (for phone camera access)" -ForegroundColor White
    Write-Host "  • WebSocket attached to HTTP/HTTPS servers" -ForegroundColor White
    Write-Host "  • Clean organized structure" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server when done." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Access URLs:" -ForegroundColor Cyan
    Write-Host "  HTTP URLs:" -ForegroundColor White
    Write-Host "    Entry Scanner:  http://localhost:3000/entry-scanner" -ForegroundColor White
    Write-Host "    Exit Validator: http://localhost:3000/exit-validator" -ForegroundColor White
    Write-Host "    Admin Dashboard: http://localhost:3000/admin-dashboard" -ForegroundColor White
    Write-Host ""
    Write-Host "  HTTPS URLs (for phone camera):" -ForegroundColor White
    Write-Host "    Entry Scanner:  https://localhost:3443/entry-scanner" -ForegroundColor White
    Write-Host "    Exit Validator: https://localhost:3443/exit-validator" -ForegroundColor White
    Write-Host "    Admin Dashboard: https://localhost:3443/admin-dashboard" -ForegroundColor White
    Write-Host ""
    Write-Host "  For phone access, use your computer's IP:" -ForegroundColor White
    Write-Host "    https://YOUR_IP:3443/entry-scanner" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "⚠️  SSL certificates not found!" -ForegroundColor Yellow
    Write-Host "    certs\server.key or certs\server.crt missing" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "HTTPS will be disabled. Only HTTP will work." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To enable HTTPS, run: generate-ssl-cert.ps1" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "The system will start with:" -ForegroundColor White
    Write-Host "  • HTTP server on port 3000 only" -ForegroundColor White
    Write-Host "  • WebSocket attached to HTTP server" -ForegroundColor White
    Write-Host "  • Clean organized structure" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server when done." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Access URLs:" -ForegroundColor Cyan
    Write-Host "  Entry Scanner:  http://localhost:3000/entry-scanner" -ForegroundColor White
    Write-Host "  Exit Validator: http://localhost:3000/exit-validator" -ForegroundColor White
    Write-Host "  Admin Dashboard: http://localhost:3000/admin-dashboard" -ForegroundColor White
    Write-Host ""
}

Write-Host "Starting server..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

# Start the server
npm run dev-simple

Write-Host ""
Write-Host "System stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"
