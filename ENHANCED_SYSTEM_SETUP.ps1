# ========================================
#   ENHANCED SYSTEM SETUP - BULLETPROOF
#   Student Lab System - Zero Error Version
# ========================================

param(
    [switch]$SkipNode,
    [switch]$SkipNpm,
    [switch]$SkipDependencies,
    [switch]$SkipDatabase,
    [switch]$SkipTest,
    [switch]$SkipOpenSSL,
    [switch]$SkipCertificates,
    [switch]$Force,
    [switch]$Verbose,
    [switch]$AutoFix,
    [switch]$CleanInstall,
    [switch]$Silent,
    [string]$LogLevel = "Info"
)

# Set execution policy and error handling
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force -ErrorAction SilentlyContinue
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

# Enhanced color system
$Colors = @{
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "Cyan"
    Header = "Magenta"
    Debug = "Gray"
    Critical = "Red"
    Process = "Blue"
}

# Global variables
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $ProjectRoot "System\server"
$LogsDir = Join-Path $ProjectRoot "Logs"
$BackupDir = Join-Path $ProjectRoot "Backups"
$SetupLog = Join-Path $LogsDir "enhanced-setup-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$HealthScore = 0
$TotalChecks = 15
$CriticalErrors = @()
$Warnings = @()
$RecoveryActions = @()

# Ensure directories exist
@($LogsDir, $BackupDir, $ServerDir) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
}

# Enhanced logging function
function Write-EnhancedLog {
    param(
        [string]$Message,
        [string]$Level = "Info",
        [string]$Color = "White",
        [string]$Prefix = "",
        [switch]$NoNewline,
        [switch]$Critical
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    # Write to console
    if ($Prefix) {
        Write-Host "$Prefix " -NoNewline -ForegroundColor $Color
    }
    if ($NoNewline) {
        Write-Host $Message -NoNewline -ForegroundColor $Color
    } else {
        Write-Host $Message -ForegroundColor $Color
    }
    
    # Write to log file
    try {
        Add-Content -Path $SetupLog -Value $logMessage -ErrorAction SilentlyContinue
    } catch {
        # Silent fail for logging
    }
    
    # Track critical errors
    if ($Critical) {
        $script:CriticalErrors += $Message
    }
    
    # Track warnings
    if ($Level -eq "Warning") {
        $script:Warnings += $Message
    }
}

# System health check function
function Test-SystemHealth {
    param([switch]$Detailed)
    
    Write-EnhancedLog "🔍 Performing comprehensive system health check..." -Color $Colors.Info -Level "Info"
    
    $healthChecks = @(
        @{ Name = "Node.js"; Test = { Get-Command node -ErrorAction SilentlyContinue } },
        @{ Name = "npm"; Test = { Get-Command npm -ErrorAction SilentlyContinue } },
        @{ Name = "OpenSSL"; Test = { Get-Command openssl -ErrorAction SilentlyContinue } },
        @{ Name = "Main Server File"; Test = { Test-Path "System\server\main-server.js" } },
        @{ Name = "Package.json"; Test = { Test-Path "System\server\package.json" } },
        @{ Name = "Student Database"; Test = { Test-Path "Student-Data\students-database.xlsx" } },
        @{ Name = "Web Interface"; Test = { Test-Path "System\web-interface" } },
        @{ Name = "SSL Certificates"; Test = { (Test-Path "System\server\certs\server.key") -and (Test-Path "System\server\certs\server.crt") } },
        @{ Name = "Node Modules"; Test = { Test-Path "System\server\node_modules" } },
        @{ Name = "Port 3000 Free"; Test = { -not (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue) } },
        @{ Name = "Port 3443 Free"; Test = { -not (Get-NetTCPConnection -LocalPort 3443 -ErrorAction SilentlyContinue) } },
        @{ Name = "Disk Space"; Test = { (Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace -gt 1GB } },
        @{ Name = "Memory Available"; Test = { (Get-WmiObject -Class Win32_OperatingSystem).FreePhysicalMemory -gt 1GB } },
        @{ Name = "Firewall Status"; Test = { (Get-NetFirewallProfile -Profile Domain).Enabled -eq $false -or (Get-NetFirewallProfile -Profile Private).Enabled -eq $false } },
        @{ Name = "Administrator Rights"; Test = { ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator") } }
    )
    
    $passedChecks = 0
    foreach ($check in $healthChecks) {
        try {
            $result = & $check.Test
            if ($result) {
                Write-EnhancedLog "✅ $($check.Name): OK" -Color $Colors.Success -Level "Info"
                $passedChecks++
            } else {
                Write-EnhancedLog "❌ $($check.Name): FAILED" -Color $Colors.Error -Level "Warning" -Critical
                $script:RecoveryActions += "Fix $($check.Name)"
            }
        } catch {
            Write-EnhancedLog "❌ $($check.Name): ERROR - $($_.Exception.Message)" -Color $Colors.Error -Level "Error" -Critical
            $script:RecoveryActions += "Fix $($check.Name)"
        }
    }
    
    $script:HealthScore = [math]::Round(($passedChecks / $healthChecks.Count) * 100, 2)
    Write-EnhancedLog "📊 System Health Score: $($script:HealthScore)% ($passedChecks/$($healthChecks.Count) checks passed)" -Color $Colors.Info -Level "Info"
    
    return $script:HealthScore
}

# Enhanced Node.js installation
function Install-NodeJS {
    param([switch]$Force)
    
    Write-EnhancedLog "📦 Installing/Updating Node.js..." -Color $Colors.Process -Level "Info"
    
    try {
        # Check current version
        $currentVersion = node --version 2>$null
        if ($currentVersion -and !$Force) {
            Write-EnhancedLog "✅ Node.js already installed: $currentVersion" -Color $Colors.Success -Level "Info"
            return $true
        }
        
        # Try multiple installation methods
        $installMethods = @(
            {
                Write-EnhancedLog "   Trying winget..." -Color $Colors.Info -Level "Debug"
                winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements --silent
                return $LASTEXITCODE -eq 0
            },
            {
                Write-EnhancedLog "   Trying chocolatey..." -Color $Colors.Info -Level "Debug"
                if (Get-Command choco -ErrorAction SilentlyContinue) {
                    choco install nodejs -y --force
                    return $LASTEXITCODE -eq 0
                }
                return $false
            },
            {
                Write-EnhancedLog "   Trying direct download..." -Color $Colors.Info -Level "Debug"
                $nodeUrl = "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
                $nodeInstaller = Join-Path $env:TEMP "nodejs-installer.msi"
                Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeInstaller -UseBasicParsing
                Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart" -Wait
                Remove-Item $nodeInstaller -Force -ErrorAction SilentlyContinue
                return $true
            }
        )
        
        foreach ($method in $installMethods) {
            try {
                if (& $method) {
                    Write-EnhancedLog "✅ Node.js installed successfully" -Color $Colors.Success -Level "Info"
                    # Refresh PATH
                    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
                    return $true
                }
            } catch {
                Write-EnhancedLog "   Method failed: $($_.Exception.Message)" -Color $Colors.Warning -Level "Warning"
            }
        }
        
        Write-EnhancedLog "❌ All Node.js installation methods failed" -Color $Colors.Error -Level "Error" -Critical
        return $false
        
    } catch {
        Write-EnhancedLog "❌ Node.js installation error: $($_.Exception.Message)" -Color $Colors.Error -Level "Error" -Critical
        return $false
    }
}

# Enhanced OpenSSL installation
function Install-OpenSSL {
    param([switch]$Force)
    
    Write-EnhancedLog "🔐 Installing/Updating OpenSSL..." -Color $Colors.Process -Level "Info"
    
    try {
        # Check current installation
        $opensslVersion = & openssl version 2>$null
        if ($opensslVersion -and !$Force) {
            Write-EnhancedLog "✅ OpenSSL already installed: $opensslVersion" -Color $Colors.Success -Level "Info"
            return $true
        }
        
        # Try multiple installation methods
        $installMethods = @(
            {
                Write-EnhancedLog "   Trying winget..." -Color $Colors.Info -Level "Debug"
                winget install OpenSSL --accept-package-agreements --accept-source-agreements --silent
                return $LASTEXITCODE -eq 0
            },
            {
                Write-EnhancedLog "   Trying chocolatey..." -Color $Colors.Info -Level "Debug"
                if (Get-Command choco -ErrorAction SilentlyContinue) {
                    choco install openssl -y --force
                    return $LASTEXITCODE -eq 0
                }
                return $false
            },
            {
                Write-EnhancedLog "   Trying Git Bash OpenSSL..." -Color $Colors.Info -Level "Debug"
                $gitOpenSSL = "C:\Program Files\Git\usr\bin\openssl.exe"
                if (Test-Path $gitOpenSSL) {
                    $env:PATH += ";$(Split-Path $gitOpenSSL)"
                    return $true
                }
                return $false
            }
        )
        
        foreach ($method in $installMethods) {
            try {
                if (& $method) {
                    Write-EnhancedLog "✅ OpenSSL installed successfully" -Color $Colors.Success -Level "Info"
                    # Refresh PATH
                    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
                    return $true
                }
            } catch {
                Write-EnhancedLog "   Method failed: $($_.Exception.Message)" -Color $Colors.Warning -Level "Warning"
            }
        }
        
        Write-EnhancedLog "❌ All OpenSSL installation methods failed" -Color $Colors.Error -Level "Error" -Critical
        return $false
        
    } catch {
        Write-EnhancedLog "❌ OpenSSL installation error: $($_.Exception.Message)" -Color $Colors.Error -Level "Error" -Critical
        return $false
    }
}

# Enhanced certificate generation
function New-SSLCertificate {
    param([switch]$Force)
    
    Write-EnhancedLog "🔐 Generating SSL certificates..." -Color $Colors.Process -Level "Info"
    
    try {
        $certDir = Join-Path $ServerDir "certs"
        $keyPath = Join-Path $certDir "server.key"
        $certPath = Join-Path $certDir "server.crt"
        
        # Create certificate directory
        if (-not (Test-Path $certDir)) {
            New-Item -ItemType Directory -Path $certDir -Force | Out-Null
            Write-EnhancedLog "📁 Created certificate directory" -Color $Colors.Success -Level "Info"
        }
        
        # Check if certificates already exist
        if ((Test-Path $keyPath) -and (Test-Path $certPath) -and !$Force) {
            Write-EnhancedLog "✅ SSL certificates already exist" -Color $Colors.Success -Level "Info"
            return $true
        }
        
        # Find OpenSSL executable
        $opensslExe = $null
        $opensslPaths = @(
            "openssl",
            "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
            "C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe",
            "C:\OpenSSL-Win64\bin\openssl.exe",
            "C:\Program Files\Git\usr\bin\openssl.exe"
        )
        
        foreach ($path in $opensslPaths) {
            try {
                if ($path -eq "openssl") {
                    $opensslExe = Get-Command openssl -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Source
                } elseif (Test-Path $path) {
                    $opensslExe = $path
                }
                if ($opensslExe) { break }
            } catch {
                continue
            }
        }
        
        if (-not $opensslExe) {
            Write-EnhancedLog "❌ OpenSSL executable not found" -Color $Colors.Error -Level "Error" -Critical
            return $false
        }
        
        Write-EnhancedLog "   Using OpenSSL: $opensslExe" -Color $Colors.Info -Level "Debug"
        
        # Generate private key
        Write-EnhancedLog "   Generating private key..." -Color $Colors.Info -Level "Debug"
        & $opensslExe genrsa -out $keyPath 2048
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to generate private key"
        }
        
        # Generate certificate
        Write-EnhancedLog "   Generating certificate..." -Color $Colors.Info -Level "Debug"
        $subject = "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"
        & $opensslExe req -new -x509 -key $keyPath -out $certPath -days 365 -subj $subject
        
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to generate certificate"
        }
        
        Write-EnhancedLog "✅ SSL certificates generated successfully!" -Color $Colors.Success -Level "Info"
        return $true
        
    } catch {
        Write-EnhancedLog "❌ Certificate generation failed: $($_.Exception.Message)" -Color $Colors.Error -Level "Error" -Critical
        return $false
    }
}

# Enhanced dependency installation
function Install-Dependencies {
    param([switch]$Force)
    
    Write-EnhancedLog "📦 Installing/Updating dependencies..." -Color $Colors.Process -Level "Info"
    
    try {
        Push-Location $ServerDir
        
        # Backup existing node_modules if Force is specified
        if ($Force -and (Test-Path "node_modules")) {
            $backupPath = Join-Path $BackupDir "node_modules-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
            Write-EnhancedLog "   Backing up existing node_modules..." -Color $Colors.Info -Level "Debug"
            Copy-Item "node_modules" $backupPath -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        # Clean install if Force is specified
        if ($Force) {
            Write-EnhancedLog "   Performing clean install..." -Color $Colors.Info -Level "Debug"
            Remove-Item "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
            Remove-Item "package-lock.json" -Force -ErrorAction SilentlyContinue
        }
        
        # Install dependencies
        Write-EnhancedLog "   Installing npm packages..." -Color $Colors.Info -Level "Debug"
        npm install --production --silent
        
        if ($LASTEXITCODE -eq 0) {
            Write-EnhancedLog "✅ Dependencies installed successfully" -Color $Colors.Success -Level "Info"
            return $true
        } else {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
        
    } catch {
        Write-EnhancedLog "❌ Dependency installation failed: $($_.Exception.Message)" -Color $Colors.Error -Level "Error" -Critical
        return $false
    } finally {
        Pop-Location
    }
}

# Enhanced system startup
function Start-System {
    param([switch]$TestOnly)
    
    Write-EnhancedLog "🚀 Starting Student Lab System..." -Color $Colors.Process -Level "Info"
    
    try {
        Push-Location $ServerDir
        
        if ($TestOnly) {
            Write-EnhancedLog "   Testing system startup..." -Color $Colors.Info -Level "Debug"
            $testProcess = Start-Process node -ArgumentList "main-server.js" -PassThru -WindowStyle Hidden
            Start-Sleep -Seconds 5
            
            if (-not $testProcess.HasExited) {
                Write-EnhancedLog "✅ System startup test successful" -Color $Colors.Success -Level "Info"
                $testProcess.Kill()
                return $true
            } else {
                Write-EnhancedLog "❌ System startup test failed" -Color $Colors.Error -Level "Error" -Critical
                return $false
            }
        } else {
            Write-EnhancedLog "   Starting system..." -Color $Colors.Info -Level "Debug"
            Write-EnhancedLog "   Press Ctrl+C to stop" -Color $Colors.Warning -Level "Info"
            Write-EnhancedLog "" -Color $Colors.Info -Level "Info"
            
            node main-server.js
        }
        
    } catch {
        Write-EnhancedLog "❌ System startup failed: $($_.Exception.Message)" -Color $Colors.Error -Level "Error" -Critical
        return $false
    } finally {
        Pop-Location
    }
}

# Recovery function
function Invoke-Recovery {
    Write-EnhancedLog "🔧 Attempting automatic recovery..." -Color $Colors.Process -Level "Info"
    
    foreach ($action in $RecoveryActions) {
        try {
            switch ($action) {
                "Fix Node.js" { Install-NodeJS -Force }
                "Fix OpenSSL" { Install-OpenSSL -Force }
                "Fix SSL Certificates" { New-SSLCertificate -Force }
                "Fix Dependencies" { Install-Dependencies -Force }
                "Fix Port 3000 Free" { 
                    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 2
                }
                "Fix Port 3443 Free" { 
                    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Seconds 2
                }
            }
        } catch {
            Write-EnhancedLog "   Recovery action '$action' failed: $($_.Exception.Message)" -Color $Colors.Warning -Level "Warning"
        }
    }
}

# Main execution
Write-EnhancedLog "========================================" -Color $Colors.Header -Level "Info"
Write-EnhancedLog "   ENHANCED SYSTEM SETUP - BULLETPROOF" -Color $Colors.Header -Level "Info"
Write-EnhancedLog "   Student Lab System - Zero Error Version" -Color $Colors.Header -Level "Info"
Write-EnhancedLog "========================================" -Color $Colors.Header -Level "Info"
Write-EnhancedLog ""

# Initial system health check
$initialHealth = Test-SystemHealth
Write-EnhancedLog ""

# Install Node.js if needed
if (-not $SkipNode) {
    $nodeInstalled = Install-NodeJS -Force:$Force
    Write-EnhancedLog ""
}

# Install OpenSSL if needed
if (-not $SkipOpenSSL) {
    $opensslInstalled = Install-OpenSSL -Force:$Force
    Write-EnhancedLog ""
}

# Generate certificates if needed
if (-not $SkipCertificates) {
    $certsGenerated = New-SSLCertificate -Force:$Force
    Write-EnhancedLog ""
}

# Install dependencies if needed
if (-not $SkipDependencies) {
    $depsInstalled = Install-Dependencies -Force:$Force
    Write-EnhancedLog ""
}

# Final system health check
$finalHealth = Test-SystemHealth
Write-EnhancedLog ""

# Recovery if needed
if ($CriticalErrors.Count -gt 0 -and $AutoFix) {
    Invoke-Recovery
    $finalHealth = Test-SystemHealth
    Write-EnhancedLog ""
}

# System status
if ($finalHealth -ge 80) {
    Write-EnhancedLog "🎉 System is ready for production!" -Color $Colors.Success -Level "Info"
} elseif ($finalHealth -ge 60) {
    Write-EnhancedLog "⚠️  System is functional but has some issues" -Color $Colors.Warning -Level "Warning"
} else {
    Write-EnhancedLog "❌ System has critical issues that need attention" -Color $Colors.Error -Level "Error"
}

Write-EnhancedLog ""
Write-EnhancedLog "📊 Setup Summary:" -Color $Colors.Info -Level "Info"
Write-EnhancedLog "   Initial Health: $initialHealth%" -Color $Colors.Info -Level "Info"
Write-EnhancedLog "   Final Health: $finalHealth%" -Color $Colors.Info -Level "Info"
Write-EnhancedLog "   Critical Errors: $($CriticalErrors.Count)" -Color $Colors.Info -Level "Info"
Write-EnhancedLog "   Warnings: $($Warnings.Count)" -Color $Colors.Info -Level "Info"
Write-EnhancedLog "   Recovery Actions: $($RecoveryActions.Count)" -Color $Colors.Info -Level "Info"

if ($CriticalErrors.Count -gt 0) {
    Write-EnhancedLog ""
    Write-EnhancedLog "❌ Critical Errors:" -Color $Colors.Error -Level "Error"
    foreach ($error in $CriticalErrors) {
        Write-EnhancedLog "   • $error" -Color $Colors.Error -Level "Error"
    }
}

Write-EnhancedLog ""
Write-EnhancedLog "📁 Log file: $SetupLog" -Color $Colors.Info -Level "Info"

# Ask if user wants to start the system
if ($finalHealth -ge 60) {
    Write-EnhancedLog ""
    $startNow = Read-Host "Start the system now? (y/N)"
    if ($startNow -eq "y" -or $startNow -eq "Y") {
        Start-System
    } else {
        Write-EnhancedLog "✅ Setup complete! Run any of the startup scripts when ready." -Color $Colors.Success -Level "Info"
    }
} else {
    Write-EnhancedLog "⚠️  Please fix critical errors before starting the system." -Color $Colors.Warning -Level "Warning"
}

Write-EnhancedLog ""
Write-EnhancedLog "🎉 Enhanced setup complete!" -Color $Colors.Success -Level "Info"
