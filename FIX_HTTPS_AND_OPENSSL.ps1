# ========================================
#   HTTPS & OpenSSL Auto-Fix Script
#   Student Lab System
# ========================================

param(
    [switch]$Force,
    [switch]$SkipOpenSSL,
    [switch]$SkipCertificates,
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Continue"

# Colors for output
$Colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Header = "Magenta"
}

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White",
        [string]$Prefix = ""
    )
    
    if ($Prefix) {
        Write-Host "$Prefix " -NoNewline -ForegroundColor $Color
    }
    Write-Host $Message -ForegroundColor $Color
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Install-OpenSSL {
    Write-ColorOutput "🔍 Checking OpenSSL installation..." -Color $Colors.Info
    
    # Check if OpenSSL is already available
    try {
        $opensslVersion = & openssl version 2>$null
        if ($opensslVersion) {
            Write-ColorOutput "✅ OpenSSL already installed: $opensslVersion" -Color $Colors.Success
            return $true
        }
    } catch {
        Write-ColorOutput "⚠️  OpenSSL not found in PATH" -Color $Colors.Warning
    }
    
    # Try to find OpenSSL in common locations
    $opensslPaths = @(
        "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
        "C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe",
        "C:\OpenSSL-Win64\bin\openssl.exe",
        "C:\Program Files\Git\usr\bin\openssl.exe"
    )
    
    foreach ($path in $opensslPaths) {
        if (Test-Path $path) {
            Write-ColorOutput "✅ Found OpenSSL at: $path" -Color $Colors.Success
            # Add to PATH for current session
            $env:PATH += ";$(Split-Path $path)"
            return $true
        }
    }
    
    Write-ColorOutput "📦 Installing OpenSSL..." -Color $Colors.Info
    
    # Try winget first
    try {
        Write-ColorOutput "   Trying winget..." -Color $Colors.Info
        $result = winget install OpenSSL --accept-package-agreements --accept-source-agreements 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✅ OpenSSL installed via winget" -Color $Colors.Success
            # Refresh PATH
            $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
            return $true
        }
    } catch {
        Write-ColorOutput "   winget failed, trying chocolatey..." -Color $Colors.Warning
    }
    
    # Try chocolatey
    try {
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-ColorOutput "   Trying chocolatey..." -Color $Colors.Info
            choco install openssl -y
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "✅ OpenSSL installed via chocolatey" -Color $Colors.Success
                return $true
            }
        }
    } catch {
        Write-ColorOutput "   chocolatey failed" -Color $Colors.Warning
    }
    
    # Manual download option
    Write-ColorOutput "❌ Automatic installation failed" -Color $Colors.Error
    Write-ColorOutput "📥 Please download OpenSSL manually:" -Color $Colors.Info
    Write-ColorOutput "   1. Go to: https://slproweb.com/products/Win32OpenSSL.html" -Color $Colors.Info
    Write-ColorOutput "   2. Download: Win64 OpenSSL v3.x.x" -Color $Colors.Info
    Write-ColorOutput "   3. Install with default settings" -Color $Colors.Info
    Write-ColorOutput "   4. Run this script again" -Color $Colors.Info
    
    return $false
}

function New-SSLCertificate {
    param(
        [string]$CertDir = "System\server\certs",
        [string]$KeyFile = "server.key",
        [string]$CertFile = "server.crt"
    )
    
    Write-ColorOutput "🔐 Generating SSL certificates..." -Color $Colors.Info
    
    # Create certificate directory
    if (!(Test-Path $CertDir)) {
        New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
        Write-ColorOutput "📁 Created certificate directory: $CertDir" -Color $Colors.Success
    }
    
    $keyPath = Join-Path $CertDir $KeyFile
    $certPath = Join-Path $CertDir $CertFile
    
    # Check if certificates already exist
    if ((Test-Path $keyPath) -and (Test-Path $certPath) -and !$Force) {
        Write-ColorOutput "✅ SSL certificates already exist" -Color $Colors.Success
        Write-ColorOutput "   📁 $keyPath" -Color $Colors.Info
        Write-ColorOutput "   📁 $certPath" -Color $Colors.Info
        return $true
    }
    
    # Find OpenSSL executable
    $opensslExe = $null
    try {
        $opensslExe = Get-Command openssl -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Source
    } catch {
        # Try common paths
        $opensslPaths = @(
            "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
            "C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe",
            "C:\OpenSSL-Win64\bin\openssl.exe",
            "C:\Program Files\Git\usr\bin\openssl.exe"
        )
        
        foreach ($path in $opensslPaths) {
            if (Test-Path $path) {
                $opensslExe = $path
                break
            }
        }
    }
    
    if (!$opensslExe) {
        Write-ColorOutput "❌ OpenSSL executable not found" -Color $Colors.Error
        return $false
    }
    
    Write-ColorOutput "   Using OpenSSL: $opensslExe" -Color $Colors.Info
    
    try {
        # Generate private key
        Write-ColorOutput "   Generating private key..." -Color $Colors.Info
        & $opensslExe genrsa -out $keyPath 2048
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to generate private key"
        }
        
        # Generate certificate
        Write-ColorOutput "   Generating certificate..." -Color $Colors.Info
        $subject = "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"
        & $opensslExe req -new -x509 -key $keyPath -out $certPath -days 365 -subj $subject
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to generate certificate"
        }
        
        Write-ColorOutput "✅ SSL certificates generated successfully!" -Color $Colors.Success
        Write-ColorOutput "   📁 Private Key: $keyPath" -Color $Colors.Info
        Write-ColorOutput "   📁 Certificate: $certPath" -Color $Colors.Info
        
        return $true
        
    } catch {
        Write-ColorOutput "❌ Failed to generate certificates: $($_.Exception.Message)" -Color $Colors.Error
        return $false
    }
}

function Test-SystemHealth {
    Write-ColorOutput "🔍 Testing system health..." -Color $Colors.Info
    
    $issues = @()
    
    # Check Node.js
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-ColorOutput "✅ Node.js: $nodeVersion" -Color $Colors.Success
        } else {
            $issues += "Node.js not found"
        }
    } catch {
        $issues += "Node.js not found"
    }
    
    # Check npm
    try {
        $npmVersion = npm --version 2>$null
        if ($npmVersion) {
            Write-ColorOutput "✅ npm: $npmVersion" -Color $Colors.Success
        } else {
            $issues += "npm not found"
        }
    } catch {
        $issues += "npm not found"
    }
    
    # Check OpenSSL
    try {
        $opensslVersion = & openssl version 2>$null
        if ($opensslVersion) {
            Write-ColorOutput "✅ OpenSSL: $opensslVersion" -Color $Colors.Success
        } else {
            $issues += "OpenSSL not found"
        }
    } catch {
        $issues += "OpenSSL not found"
    }
    
    # Check certificates
    $certDir = "System\server\certs"
    $keyPath = Join-Path $certDir "server.key"
    $certPath = Join-Path $certDir "server.crt"
    
    if ((Test-Path $keyPath) -and (Test-Path $certPath)) {
        Write-ColorOutput "✅ SSL certificates: Present" -Color $Colors.Success
    } else {
        $issues += "SSL certificates missing"
    }
    
    # Check main server file
    if (Test-Path "System\server\main-server.js") {
        Write-ColorOutput "✅ Main server: Present" -Color $Colors.Success
    } else {
        $issues += "Main server file missing"
    }
    
    # Check package.json
    if (Test-Path "System\server\package.json") {
        Write-ColorOutput "✅ Package.json: Present" -Color $Colors.Success
    } else {
        $issues += "Package.json missing"
    }
    
    if ($issues.Count -gt 0) {
        Write-ColorOutput "⚠️  Issues found:" -Color $Colors.Warning
        foreach ($issue in $issues) {
            Write-ColorOutput "   • $issue" -Color $Colors.Warning
        }
        return $false
    } else {
        Write-ColorOutput "🎉 All systems healthy!" -Color $Colors.Success
        return $true
    }
}

function Start-System {
    Write-ColorOutput "🚀 Starting Student Lab System..." -Color $Colors.Info
    
    $serverDir = "System\server"
    if (!(Test-Path $serverDir)) {
        Write-ColorOutput "❌ Server directory not found: $serverDir" -Color $Colors.Error
        return $false
    }
    
    Push-Location $serverDir
    
    try {
        # Install dependencies if needed
        if (!(Test-Path "node_modules")) {
            Write-ColorOutput "📦 Installing dependencies..." -Color $Colors.Info
            npm install
        }
        
        # Start the server
        Write-ColorOutput "🎯 Starting server..." -Color $Colors.Info
        Write-ColorOutput "   Press Ctrl+C to stop" -Color $Colors.Warning
        Write-ColorOutput "" -Color $Colors.Info
        
        node main-server.js
        
    } catch {
        Write-ColorOutput "❌ Failed to start server: $($_.Exception.Message)" -Color $Colors.Error
        return $false
    } finally {
        Pop-Location
    }
    
    return $true
}

# Main execution
Write-ColorOutput "========================================" -Color $Colors.Header
Write-ColorOutput "   HTTPS & OpenSSL Auto-Fix Script" -Color $Colors.Header
Write-ColorOutput "   Student Lab System" -Color $Colors.Header
Write-ColorOutput "========================================" -Color $Colors.Header
Write-ColorOutput ""

# Check if running as administrator
if (!(Test-Administrator)) {
    Write-ColorOutput "⚠️  Not running as administrator" -Color $Colors.Warning
    Write-ColorOutput "   Some operations may require elevated privileges" -Color $Colors.Warning
    Write-ColorOutput ""
}

# Install OpenSSL if needed
if (!$SkipOpenSSL) {
    $opensslInstalled = Install-OpenSSL
    if (!$opensslInstalled) {
        Write-ColorOutput "❌ Cannot proceed without OpenSSL" -Color $Colors.Error
        exit 1
    }
    Write-ColorOutput ""
}

# Generate certificates if needed
if (!$SkipCertificates) {
    $certsGenerated = New-SSLCertificate
    if (!$certsGenerated) {
        Write-ColorOutput "❌ Cannot proceed without SSL certificates" -Color $Colors.Error
        exit 1
    }
    Write-ColorOutput ""
}

# Test system health
$systemHealthy = Test-SystemHealth
Write-ColorOutput ""

if (!$systemHealthy) {
    Write-ColorOutput "⚠️  System has issues. Fix them before starting." -Color $Colors.Warning
    Write-ColorOutput "   Run with -Force to regenerate certificates" -Color $Colors.Info
    Write-ColorOutput "   Run with -SkipOpenSSL to skip OpenSSL installation" -Color $Colors.Info
    Write-ColorOutput "   Run with -SkipCertificates to skip certificate generation" -Color $Colors.Info
    exit 1
}

# Ask if user wants to start the system
Write-ColorOutput "🎯 System is ready!" -Color $Colors.Success
Write-ColorOutput ""
Write-ColorOutput "Available startup options:" -Color $Colors.Info
Write-ColorOutput "   • START_CLEAN_SYSTEM.bat (Auto-detect)" -Color $Colors.Info
Write-ColorOutput "   • START_CLEAN_SYSTEM_HTTPS.bat (HTTPS enabled)" -Color $Colors.Info
Write-ColorOutput "   • START_CLEAN_SYSTEM_HTTP_ONLY.bat (HTTP only)" -Color $Colors.Info
Write-ColorOutput ""

$startNow = Read-Host "Start the system now? (y/N)"
if ($startNow -eq "y" -or $startNow -eq "Y") {
    Start-System
} else {
    Write-ColorOutput "✅ Setup complete! Run any of the startup scripts when ready." -Color $Colors.Success
}

Write-ColorOutput ""
Write-ColorOutput "🎉 HTTPS & OpenSSL setup complete!" -Color $Colors.Success
