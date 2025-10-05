# ========================================
# Student Lab System v2 - Enhanced Start Script
# ========================================
# This script provides intelligent system startup with auto-detection,
# comprehensive checks, and user-friendly interface

param(
    [switch]$Help,
    [switch]$Force,
    [switch]$SkipChecks,
    [switch]$NoSSL,
    [string]$CustomIP = ""
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "Student Lab System v2 - Enhanced Start"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Green"
Clear-Host

# Global variables
$script:ProjectName = "Student Lab System v2"
$script:ServerPath = "System\server"
$script:HTTPPort = 3000
$script:HTTPSPort = 3443
$script:WSPort = 3001
$script:WSSPort = 3444

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   $ProjectName - ENHANCED START" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\START.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help              Show this help message" -ForegroundColor White
    Write-Host "  -Force             Skip all prompts and start immediately" -ForegroundColor White
    Write-Host "  -SkipChecks        Skip system checks and start directly" -ForegroundColor White
    Write-Host "  -NoSSL             Force HTTP-only mode (disable HTTPS)" -ForegroundColor White
    Write-Host "  -CustomIP          Use custom IP address instead of auto-detection" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\START.ps1                        # Interactive start with checks" -ForegroundColor White
    Write-Host "  .\START.ps1 -Force                 # Start immediately without prompts" -ForegroundColor White
    Write-Host "  .\START.ps1 -SkipChecks            # Skip checks and start" -ForegroundColor White
    Write-Host "  .\START.ps1 -NoSSL                 # Force HTTP-only mode" -ForegroundColor White
    Write-Host "  .\START.ps1 -CustomIP '192.168.1.100' # Use specific IP" -ForegroundColor White
    Write-Host ""
}

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

# Function to wait for user input
function Wait-ForUser {
    if (-not $Force) {
        Write-Host ""
        Write-Host "Press Enter to continue..." -ForegroundColor Yellow
        Read-Host
    }
}

# Function to get user confirmation
function Get-UserConfirmation {
    param(
        [string]$Message,
        [string]$Default = "y"
    )
    
    if ($Force) {
        return $true
    }
    
    $response = Read-Host "$Message (y/n)"
    if ([string]::IsNullOrEmpty($response)) {
        $response = $Default
    }
    
    return ($response -eq "y" -or $response -eq "Y")
}

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# Function to get system IP address
function Get-SystemIP {
    try {
        if (-not [string]::IsNullOrEmpty($CustomIP)) {
            return $CustomIP
        }
        
        # Try to get the primary network interface IP
        $networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
            $_.IPAddress -notlike "127.*" -and 
            $_.IPAddress -notlike "169.254.*" -and
            $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"
        } | Sort-Object InterfaceIndex
        
        if ($networkAdapters) {
            return $networkAdapters[0].IPAddress
        }
        
        # Fallback to localhost
        return "localhost"
    }
    catch {
        return "localhost"
    }
}

# Function to check if port is in use
function Test-PortInUse {
    param([int]$Port)
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        return $connection -ne $null
    }
    catch {
        return $false
    }
}

# Function to check system requirements
function Test-SystemRequirements {
    Write-Status "Checking system requirements..."
    
    $allGood = $true
    
    # Check Node.js
    if (Test-Command "node") {
        $nodeVersion = & node --version 2>$null
        Write-Success "Node.js found: $nodeVersion"
    } else {
        Write-Error "Node.js not found! Please install Node.js first."
        $allGood = $false
    }
    
    # Check npm
    if (Test-Command "npm") {
        $npmVersion = & npm --version 2>$null
        Write-Success "npm found: $npmVersion"
    } else {
        Write-Error "npm not found! Please install npm first."
        $allGood = $false
    }
    
    # Check server directory
    if (Test-Path $script:ServerPath) {
        Write-Success "Server directory found: $script:ServerPath"
    } else {
        Write-Error "Server directory not found: $script:ServerPath"
        $allGood = $false
    }
    
    # Check package.json
    if (Test-Path "$script:ServerPath\package.json") {
        Write-Success "package.json found"
    } else {
        Write-Error "package.json not found in server directory"
        $allGood = $false
    }
    
    # Check main-server.js
    if (Test-Path "$script:ServerPath\main-server.js") {
        Write-Success "main-server.js found"
    } else {
        Write-Error "main-server.js not found in server directory"
        $allGood = $false
    }
    
    # Check node_modules
    if (Test-Path "$script:ServerPath\node_modules") {
        Write-Success "Dependencies installed (node_modules found)"
    } else {
        Write-Warning "Dependencies not installed (node_modules missing)"
        Write-Status "Run 'npm install' in the server directory first"
        $allGood = $false
    }
    
    # Check .env file
    if (Test-Path "$script:ServerPath\.env") {
        Write-Success "Environment configuration found (.env)"
    } else {
        Write-Warning "Environment configuration missing (.env)"
        Write-Status "Run the setup script first to create .env file"
    }
    
    return $allGood
}

# Function to check SSL certificates
function Test-SSLCertificates {
    $keyPath = "$script:ServerPath\certs\server.key"
    $crtPath = "$script:ServerPath\certs\server.crt"
    
    if ((Test-Path $keyPath) -and (Test-Path $crtPath)) {
        Write-Success "SSL certificates found"
        return $true
    } else {
        Write-Warning "SSL certificates not found"
        Write-Status "HTTPS will be disabled. Run SSL-CERT.ps1 to generate certificates"
        return $false
    }
}

# Function to check port availability
function Test-PortAvailability {
    Write-Status "Checking port availability..."
    
    $portsInUse = @()
    
    if (Test-PortInUse $script:HTTPPort) {
        $portsInUse += $script:HTTPPort
        Write-Warning "Port $script:HTTPPort is already in use"
    } else {
        Write-Success "Port $script:HTTPPort is available"
    }
    
    if (Test-PortInUse $script:HTTPSPort) {
        $portsInUse += $script:HTTPSPort
        Write-Warning "Port $script:HTTPSPort is already in use"
    } else {
        Write-Success "Port $script:HTTPSPort is available"
    }
    
    if (Test-PortInUse $script:WSPort) {
        $portsInUse += $script:WSPort
        Write-Warning "Port $script:WSPort is already in use"
    } else {
        Write-Success "Port $script:WSPort is available"
    }
    
    if (Test-PortInUse $script:WSSPort) {
        $portsInUse += $script:WSSPort
        Write-Warning "Port $script:WSSPort is already in use"
    } else {
        Write-Success "Port $script:WSSPort is available"
    }
    
    return $portsInUse
}

# Function to display system information
function Show-SystemInfo {
    param(
        [string]$SystemIP,
        [bool]$SSLEnabled
    )
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   SYSTEM INFORMATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Info "System IP: $SystemIP"
    Write-Info "HTTP Port: $script:HTTPPort"
    Write-Info "HTTPS Port: $script:HTTPSPort"
    Write-Info "WebSocket Port: $script:WSPort"
    Write-Info "Secure WebSocket Port: $script:WSSPort"
    Write-Info "SSL Enabled: $SSLEnabled"
    Write-Host ""
}

# Function to display access URLs
function Show-AccessURLs {
    param(
        [string]$SystemIP,
        [bool]$SSLEnabled
    )
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   ACCESS URLs - Your IP: $SystemIP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($SSLEnabled) {
        Write-Host "HTTPS URLs (Recommended for phones):" -ForegroundColor Green
        Write-Host "   Entry Scanner:  https://$SystemIP`:$script:HTTPSPort/entry-scanner" -ForegroundColor White
        Write-Host "   Exit Validator: https://$SystemIP`:$script:HTTPSPort/exit-validator" -ForegroundColor White
        Write-Host "   Admin Dashboard: https://$SystemIP`:$script:HTTPSPort/admin-dashboard" -ForegroundColor White
        Write-Host ""
        Write-Host "HTTP URLs (For local computers):" -ForegroundColor Yellow
        Write-Host "   Entry Scanner:  http://$SystemIP`:$script:HTTPPort/entry-scanner" -ForegroundColor White
        Write-Host "   Exit Validator: http://$SystemIP`:$script:HTTPPort/exit-validator" -ForegroundColor White
        Write-Host "   Admin Dashboard: http://$SystemIP`:$script:HTTPPort/admin-dashboard" -ForegroundColor White
        Write-Host ""
        Write-Host "For phone camera access, use HTTPS URLs above" -ForegroundColor Green
    } else {
        Write-Host "HTTP URLs (Only option without SSL):" -ForegroundColor Yellow
        Write-Host "   Entry Scanner:  http://$SystemIP`:$script:HTTPPort/entry-scanner" -ForegroundColor White
        Write-Host "   Exit Validator: http://$SystemIP`:$script:HTTPPort/exit-validator" -ForegroundColor White
        Write-Host "   Admin Dashboard: http://$SystemIP`:$script:HTTPPort/admin-dashboard" -ForegroundColor White
        Write-Host ""
        Write-Host "Note: Phone cameras require HTTPS. Run SSL-CERT.ps1 first." -ForegroundColor Red
    }
    Write-Host ""
}

# Function to start the server
function Start-Server {
    param(
        [bool]$SSLEnabled
    )
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STARTING SERVER" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($SSLEnabled) {
        Write-Status "Starting server with SSL support..."
        Write-Info "• HTTP server on port $script:HTTPPort"
        Write-Info "• HTTPS server on port $script:HTTPSPort"
        Write-Info "• WebSocket on port $script:WSPort"
        Write-Info "• Secure WebSocket on port $script:WSSPort"
    } else {
        Write-Status "Starting server in HTTP-only mode..."
        Write-Info "• HTTP server on port $script:HTTPPort"
        Write-Info "• WebSocket on port $script:WSPort"
    }
    
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server when done." -ForegroundColor Yellow
    Write-Host ""
    
    # Change to server directory
    Set-Location $script:ServerPath
    
    try {
        # Start the server
        if ($SSLEnabled) {
            & npm run dev-simple
        } else {
            & npm run dev-simple
        }
    }
    catch {
        Write-Error "Failed to start server: $($_.Exception.Message)"
        return $false
    }
    finally {
        # Return to original directory
        Set-Location $PSScriptRoot
    }
    
    return $true
}

# Main execution function
function Start-System {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   $ProjectName - ENHANCED START" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Get system IP
    $systemIP = Get-SystemIP
    Write-Status "Detected system IP: $systemIP"
    
    # Check system requirements
    if (-not $SkipChecks) {
        if (-not (Test-SystemRequirements)) {
            Write-Error "System requirements not met. Please fix the issues above."
            Wait-ForUser
            exit 1
        }
    } else {
        Write-Warning "System checks skipped by user"
    }
    
    # Check SSL certificates
    $sslEnabled = $false
    if (-not $NoSSL) {
        $sslEnabled = Test-SSLCertificates
    } else {
        Write-Warning "SSL disabled by user"
    }
    
    # Check port availability
    $portsInUse = Test-PortAvailability
    if ($portsInUse.Count -gt 0) {
        Write-Warning "Some ports are in use. The server may not start properly."
        if (-not $Force) {
            if (-not (Get-UserConfirmation "Continue anyway?")) {
                Write-Host "Start cancelled." -ForegroundColor Yellow
                exit 0
            }
        }
    }
    
    # Show system information
    Show-SystemInfo -SystemIP $systemIP -SSLEnabled $sslEnabled
    
    # Show access URLs
    Show-AccessURLs -SystemIP $systemIP -SSLEnabled $sslEnabled
    
    # Ask for confirmation
    if (-not $Force) {
        if (-not (Get-UserConfirmation "Start the server now?")) {
            Write-Host "Start cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
    
    # Start the server
    if (Start-Server -SSLEnabled $sslEnabled) {
        Write-Host ""
        Write-Success "Server stopped successfully"
    } else {
        Write-Host ""
        Write-Error "Server encountered an error"
    }
    
    Write-Host ""
    Write-Status "Thank you for using $ProjectName"
    Write-Host ""
}

# Handle help parameter
if ($Help) {
    Show-Help
    exit 0
}

# Start the system
try {
    Start-System
}
catch {
    Write-Host ""
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    Read-Host "Press Enter to exit"
    exit 1
}