# ========================================
# Student Lab System v2 - Simple Start
# ========================================
# All advanced options in a simple, easy-to-use format

param(
    [switch]$Help,
    [switch]$Force,
    [switch]$SkipChecks,
    [switch]$NoSSL,
    [switch]$AutoStart,
    [string]$CustomIP = ""
)

# Set console colors
$Host.UI.RawUI.WindowTitle = "Student Lab System v2 - Simple Start"
Clear-Host

# Global variables
$ServerPath = "System\server"
$HTTPPort = 3000
$HTTPSPort = 3443

# Function to print colored output
function Write-Status { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Function to get system IP (Enhanced)
function Get-SystemIP {
    try {
        if (-not [string]::IsNullOrEmpty($CustomIP)) { 
            Write-Status "Using custom IP: $CustomIP"
            return $CustomIP 
        }
        
        # Try multiple methods to get real IP
        $ip = $null
        
        # Method 1: Get-NetIPAddress (most reliable)
        try {
            $adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
                $_.IPAddress -notlike "127.*" -and 
                $_.IPAddress -notlike "169.254.*" -and
                $_.IPAddress -notlike "192.168.1.1" -and
                $_.IPAddress -notlike "10.0.0.1"
            } | Sort-Object InterfaceIndex
            
            if ($adapters) {
                $ip = $adapters[0].IPAddress
                Write-Status "Detected IP via Get-NetIPAddress: $ip"
            }
        } catch {
            Write-Warning "Get-NetIPAddress failed: $($_.Exception.Message)"
        }
        
        # Method 2: ipconfig (fallback)
        if (-not $ip) {
            try {
                $ipconfig = ipconfig | Select-String "IPv4.*: (\d+\.\d+\.\d+\.\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value }
                $validIPs = $ipconfig | Where-Object { 
                    $_ -notlike "127.*" -and $_ -notlike "169.254.*" -and $_ -notlike "192.168.1.1" -and $_ -notlike "10.0.0.1"
                }
                if ($validIPs) {
                    $ip = $validIPs[0]
                    Write-Status "Detected IP via ipconfig: $ip"
                }
            } catch {
                Write-Warning "ipconfig method failed: $($_.Exception.Message)"
            }
        }
        
        # Method 3: Network interfaces (last resort)
        if (-not $ip) {
            try {
                $interfaces = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()
                foreach ($interface in $interfaces) {
                    if ($interface.OperationalStatus -eq "Up" -and $interface.NetworkInterfaceType -ne "Loopback") {
                        $props = $interface.GetIPProperties()
                        foreach ($addr in $props.UnicastAddresses) {
                            if ($addr.Address.AddressFamily -eq "InterNetwork") {
                                $ipStr = $addr.Address.ToString()
                                if ($ipStr -notlike "127.*" -and $ipStr -notlike "169.254.*" -and $ipStr -notlike "192.168.1.1" -and $ipStr -notlike "10.0.0.1") {
                                    $ip = $ipStr
                                    Write-Status "Detected IP via NetworkInterface: $ip"
                                    break
                                }
                            }
                        }
                        if ($ip) { break }
                    }
                }
            } catch {
                Write-Warning "NetworkInterface method failed: $($_.Exception.Message)"
            }
        }
        
        if ($ip) {
            Write-Success "Real IP detected: $ip"
            return $ip
        } else {
            Write-Warning "Could not detect real IP, using localhost"
            return "localhost"
        }
    }
    catch { 
        Write-Warning "IP detection failed: $($_.Exception.Message), using localhost"
        return "localhost" 
    }
}

# Function to check if port is in use
function Test-PortInUse { param([int]$Port)
    try { return (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue) -ne $null }
    catch { return $false }
}

# Function to check system requirements
function Test-SystemRequirements {
    Write-Status "Checking system requirements..."
    
    # Check Node.js
    if (Get-Command "node" -ErrorAction SilentlyContinue) {
        Write-Success "Node.js found: $(node --version)"
    } else {
        Write-Error "Node.js not found! Install Node.js first."
        return $false
    }
    
    # Check server files
    if (-not (Test-Path $ServerPath)) {
        Write-Error "Server directory not found: $ServerPath"
        return $false
    }
    
    if (-not (Test-Path "$ServerPath\package.json")) {
        Write-Error "package.json not found"
        return $false
    }
    
    if (-not (Test-Path "$ServerPath\main-server.js")) {
        Write-Error "main-server.js not found"
        return $false
    }
    
    if (-not (Test-Path "$ServerPath\node_modules")) {
        Write-Warning "Dependencies not installed. Run 'npm install' first."
        return $false
    }
    
    Write-Success "System requirements OK"
    return $true
}

# Function to check SSL certificates
function Test-SSLCertificates {
    $keyPath = "$ServerPath\certs\server.key"
    $crtPath = "$ServerPath\certs\server.crt"
    
    if ((Test-Path $keyPath) -and (Test-Path $crtPath)) {
        Write-Success "SSL certificates found - HTTPS enabled"
        return $true
    } else {
        Write-Warning "SSL certificates not found - HTTPS disabled"
        return $false
    }
}

# Function to check port availability
function Test-PortAvailability {
    Write-Status "Checking port availability..."
    
    $portsInUse = @()
    if (Test-PortInUse $HTTPPort) { $portsInUse += $HTTPPort; Write-Warning "Port $HTTPPort in use" }
    else { Write-Success "Port $HTTPPort available" }
    
    if (Test-PortInUse $HTTPSPort) { $portsInUse += $HTTPSPort; Write-Warning "Port $HTTPSPort in use" }
    else { Write-Success "Port $HTTPSPort available" }
    
    return $portsInUse
}

# Function to display access URLs
function Show-AccessURLs { param([string]$SystemIP, [bool]$SSLEnabled)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   ACCESS URLs - Your IP: $SystemIP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($SSLEnabled) {
        Write-Host "HTTPS URLs (Recommended for phones):" -ForegroundColor Green
        Write-Host "   Entry Scanner:  https://$SystemIP`:$HTTPSPort/entry-scanner" -ForegroundColor White
        Write-Host "   Exit Validator: https://$SystemIP`:$HTTPSPort/exit-validator" -ForegroundColor White
        Write-Host "   Admin Dashboard: https://$SystemIP`:$HTTPSPort/admin-dashboard" -ForegroundColor White
        Write-Host ""
        Write-Host "HTTP URLs (For local computers):" -ForegroundColor Yellow
        Write-Host "   Entry Scanner:  http://$SystemIP`:$HTTPPort/entry-scanner" -ForegroundColor White
        Write-Host "   Exit Validator: http://$SystemIP`:$HTTPPort/exit-validator" -ForegroundColor White
        Write-Host "   Admin Dashboard: http://$SystemIP`:$HTTPPort/admin-dashboard" -ForegroundColor White
    } else {
        Write-Host "HTTP URLs (Only option without SSL):" -ForegroundColor Yellow
        Write-Host "   Entry Scanner:  http://$SystemIP`:$HTTPPort/entry-scanner" -ForegroundColor White
        Write-Host "   Exit Validator: http://$SystemIP`:$HTTPPort/exit-validator" -ForegroundColor White
        Write-Host "   Admin Dashboard: http://$SystemIP`:$HTTPPort/admin-dashboard" -ForegroundColor White
        Write-Host ""
        Write-Host "Note: Phone cameras require HTTPS. Run SSL-CERT.ps1 first." -ForegroundColor Red
    }
    Write-Host ""
}

# Function to start the server
function Start-Server { param([bool]$SSLEnabled)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STARTING SERVER WITH LIVE LOGS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if ($SSLEnabled) {
        Write-Status "Starting with SSL support (HTTP + HTTPS)"
    } else {
        Write-Status "Starting in HTTP-only mode"
    }
    
    Write-Host ""
    Write-Host "LIVE SERVER OUTPUT:" -ForegroundColor Red
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    
    # Change to server directory and start with live output
    Set-Location $ServerPath
    try {
        # Start server with live output - this will show real-time logs
        Write-Host "Starting server... (Live logs will appear below)" -ForegroundColor Green
        Write-Host ""
        
        # Run npm command directly to show live output
        & npm run dev-simple
    }
    catch {
        Write-Error "Failed to start server: $($_.Exception.Message)"
        return $false
    }
    finally {
        Set-Location $PSScriptRoot
    }
    
    return $true
}

# Main execution
function Start-System {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Student Lab System v2 - Simple Start" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Get system IP
    $systemIP = Get-SystemIP
    Write-Status "System IP: $systemIP"
    
    # Check system requirements
    if (-not $SkipChecks) {
        if (-not (Test-SystemRequirements)) {
            Write-Error "System requirements not met. Fix issues above."
            if (-not $Force) { Read-Host "Press Enter to exit"; exit 1 }
        }
    }
    
    # Check SSL certificates
    $sslEnabled = $false
    if (-not $NoSSL) {
        $sslEnabled = Test-SSLCertificates
    }
    
    # Check port availability
    $portsInUse = Test-PortAvailability
    if ($portsInUse.Count -gt 0 -and -not $Force -and -not $AutoStart) {
        $response = Read-Host "Some ports are in use. Continue anyway? (y/n)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "Start cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
    
    # Show access URLs
    Show-AccessURLs -SystemIP $systemIP -SSLEnabled $sslEnabled
    
    # Ask for confirmation (only if not Force or AutoStart)
    if (-not $Force -and -not $AutoStart) {
        $response = Read-Host "Start the server now? (y/n)"
        if ($response -ne "y" -and $response -ne "Y") {
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
    Write-Status "Thank you for using Student Lab System v2"
    Write-Host ""
}

# Handle help parameter
if ($Help) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Student Lab System v2 - Simple Start" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\START-SIMPLE.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help              Show this help message" -ForegroundColor White
    Write-Host "  -Force             Skip all prompts and start immediately" -ForegroundColor White
    Write-Host "  -AutoStart         Auto-start with live logs (no prompts)" -ForegroundColor White
    Write-Host "  -SkipChecks        Skip system checks and start directly" -ForegroundColor White
    Write-Host "  -NoSSL             Force HTTP-only mode (disable HTTPS)" -ForegroundColor White
    Write-Host "  -CustomIP          Use custom IP address instead of auto-detection" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\START-SIMPLE.ps1                        # Interactive start" -ForegroundColor White
    Write-Host "  .\START-SIMPLE.ps1 -Force                 # Start immediately" -ForegroundColor White
    Write-Host "  .\START-SIMPLE.ps1 -AutoStart             # Auto-start with live logs" -ForegroundColor White
    Write-Host "  .\START-SIMPLE.ps1 -SkipChecks            # Skip checks" -ForegroundColor White
    Write-Host "  .\START-SIMPLE.ps1 -NoSSL                 # HTTP-only mode" -ForegroundColor White
    Write-Host "  .\START-SIMPLE.ps1 -CustomIP '192.168.1.100' # Custom IP" -ForegroundColor White
    Write-Host ""
    exit 0
}

# Start the system - inline execution instead of function call
try {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   Student Lab System v2 - Simple Start" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Get system IP
    $systemIP = Get-SystemIP
    Write-Status "System IP: $systemIP"
    
    # Check system requirements
    if (-not $SkipChecks) {
        if (-not (Test-SystemRequirements)) {
            Write-Error "System requirements not met. Fix issues above."
            if (-not $Force) { Read-Host "Press Enter to exit"; exit 1 }
        }
    }
    
    # Check SSL certificates
    $sslEnabled = $false
    if (-not $NoSSL) {
        $sslEnabled = Test-SSLCertificates
    }
    
    # Check port availability
    $portsInUse = Test-PortAvailability
    if ($portsInUse.Count -gt 0 -and -not $Force -and -not $AutoStart) {
        $response = Read-Host "Some ports are in use. Continue anyway? (y/n)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "Start cancelled." -ForegroundColor Yellow
            exit 0
        }
    }
    
    # Show access URLs
    Show-AccessURLs -SystemIP $systemIP -SSLEnabled $sslEnabled
    
    # Ask for confirmation (only if not Force or AutoStart)
    if (-not $Force -and -not $AutoStart) {
        $response = Read-Host "Start the server now? (y/n)"
        if ($response -ne "y" -and $response -ne "Y") {
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
    Write-Status "Thank you for using Student Lab System v2"
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    Read-Host "Press Enter to exit"
    exit 1
}
