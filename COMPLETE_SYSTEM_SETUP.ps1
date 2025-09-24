# ========================================
#   COMPLETE STUDENT LAB SYSTEM SETUP
#   PowerShell Version - Enhanced Features
# ========================================

param(
    [switch]$Silent,
    [switch]$SkipNodeCheck,
    [switch]$ForceReinstall,
    [string]$LogLevel = "Info"
)

# Set execution policy for current session
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

# Enable better error handling
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

# Colors for output
$Colors = @{
    Green = "Green"
    Red = "Red"
    Yellow = "Yellow"
    Blue = "Cyan"
    Magenta = "Magenta"
    White = "White"
}

# Global variables
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $ProjectRoot "System\server"
$LogsDir = Join-Path $ProjectRoot "Logs"
$SetupLog = Join-Path $LogsDir "setup-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
$HealthScore = 0
$TotalChecks = 10

# Ensure logs directory exists
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "Info",
        [string]$Color = "White"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Write to console with color
    Write-Host $Message -ForegroundColor $Color
    
    # Write to log file
    Add-Content -Path $SetupLog -Value $logEntry -Encoding UTF8
}

# Progress tracking
function Update-Progress {
    param(
        [int]$CurrentStep,
        [int]$TotalSteps,
        [string]$Activity,
        [string]$Status
    )
    
    $percentComplete = ($CurrentStep / $TotalSteps) * 100
    Write-Progress -Activity $Activity -Status $Status -PercentComplete $percentComplete
}

# Header
function Show-Header {
    Clear-Host
    Write-Host @"

==========================================
   COMPLETE STUDENT LAB SYSTEM SETUP
   PowerShell Enhanced Version
==========================================

This script will:
  1. Check/Install Node.js and npm
  2. Verify system requirements  
  3. Install project dependencies
  4. Setup database and configuration
  5. Test the complete system
  6. Create startup shortcuts
  7. Perform comprehensive health checks
  8. Generate detailed reports

"@ -ForegroundColor $Colors.Blue

    Write-Log "Starting Student Lab System Setup" "Info" $Colors.Green
    Write-Log "Project Root: $ProjectRoot" "Info" $Colors.Blue
    Write-Log "Setup Log: $SetupLog" "Info" $Colors.Blue
}

# Check administrator privileges
function Test-AdminPrivileges {
    Write-Log "[STEP 1] Checking administrator privileges..." "Info" $Colors.Yellow
    Update-Progress 1 $TotalChecks "System Setup" "Checking administrator privileges"
    
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    $isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if ($isAdmin) {
        Write-Log "✅ Running as Administrator" "Success" $Colors.Green
        $script:HealthScore++
    } else {
        Write-Log "⚠️  Not running as Administrator" "Warning" $Colors.Yellow
        Write-Log "Some features may require admin privileges" "Warning" $Colors.Yellow
        Write-Log "Consider running as Administrator for full setup" "Warning" $Colors.Yellow
    }
    
    return $isAdmin
}

# Check Node.js installation
function Test-NodeJS {
    Write-Log "[STEP 2] Checking Node.js installation..." "Info" $Colors.Yellow
    Update-Progress 2 $TotalChecks "System Setup" "Checking Node.js installation"
    
    try {
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            Write-Log "✅ Node.js found: $nodeVersion" "Success" $Colors.Green
            $script:HealthScore++
        } else {
            throw "Node.js not found"
        }
    } catch {
        Write-Log "❌ Node.js not found!" "Error" $Colors.Red
        
        if (-not $SkipNodeCheck) {
            Write-Log "Attempting automatic Node.js installation..." "Info" $Colors.Blue
            
            # Try different installation methods
            $installMethods = @(
                @{ Name = "winget"; Command = "winget install OpenJS.NodeJS --accept-source-agreements --accept-package-agreements" },
                @{ Name = "chocolatey"; Command = "choco install nodejs -y" },
                @{ Name = "scoop"; Command = "scoop install nodejs" }
            )
            
            foreach ($method in $installMethods) {
                try {
                    Write-Log "Trying installation with $($method.Name)..." "Info" $Colors.Blue
                    Invoke-Expression $method.Command
                    
                    # Refresh environment variables
                    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
                    
                    # Test if Node.js is now available
                    $nodeVersion = & node --version 2>$null
                    if ($nodeVersion) {
                        Write-Log "✅ Node.js installed successfully: $nodeVersion" "Success" $Colors.Green
                        $script:HealthScore++
                        break
                    }
                } catch {
                    Write-Log "Failed to install with $($method.Name)" "Warning" $Colors.Yellow
                    continue
                }
            }
            
            if (-not $nodeVersion) {
                Write-Log "❌ All automatic installation attempts failed" "Error" $Colors.Red
                Write-Log "Please install Node.js manually from: https://nodejs.org/en/download/" "Error" $Colors.Red
                return $false
            }
        }
    }
    
    # Check npm
    try {
        $npmVersion = & npm --version 2>$null
        if ($npmVersion) {
            Write-Log "✅ npm found: $npmVersion" "Success" $Colors.Green
            $script:HealthScore++
        } else {
            throw "npm not found"
        }
    } catch {
        Write-Log "❌ npm not found!" "Error" $Colors.Red
        Write-Log "npm should come with Node.js. Please reinstall Node.js" "Error" $Colors.Red
        return $false
    }
    
    return $true
}

# Verify project structure
function Test-ProjectStructure {
    Write-Log "[STEP 3] Verifying project structure..." "Info" $Colors.Yellow
    Update-Progress 3 $TotalChecks "System Setup" "Verifying project structure"
    
    $requiredPaths = @(
        @{ Path = "System"; Type = "Directory"; Critical = $true },
        @{ Path = "System\server"; Type = "Directory"; Critical = $true },
        @{ Path = "System\web-interface"; Type = "Directory"; Critical = $true },
        @{ Path = "System\server\package.json"; Type = "File"; Critical = $true },
        @{ Path = "System\server\main-server.js"; Type = "File"; Critical = $true },
        @{ Path = "Student-Data"; Type = "Directory"; Critical = $false },
        @{ Path = "Logs"; Type = "Directory"; Critical = $false },
        @{ Path = "Documentation"; Type = "Directory"; Critical = $false }
    )
    
    $structureValid = $true
    
    foreach ($item in $requiredPaths) {
        $fullPath = Join-Path $ProjectRoot $item.Path
        
        if ($item.Type -eq "Directory") {
            if (Test-Path $fullPath -PathType Container) {
                Write-Log "✅ Directory found: $($item.Path)" "Success" $Colors.Green
            } else {
                if ($item.Critical) {
                    Write-Log "❌ Critical directory missing: $($item.Path)" "Error" $Colors.Red
                    $structureValid = $false
                } else {
                    Write-Log "⚠️  Creating directory: $($item.Path)" "Warning" $Colors.Yellow
                    New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
                    Write-Log "✅ Directory created: $($item.Path)" "Success" $Colors.Green
                }
            }
        } else {
            if (Test-Path $fullPath -PathType Leaf) {
                Write-Log "✅ File found: $($item.Path)" "Success" $Colors.Green
            } else {
                if ($item.Critical) {
                    Write-Log "❌ Critical file missing: $($item.Path)" "Error" $Colors.Red
                    $structureValid = $false
                } else {
                    Write-Log "⚠️  Optional file missing: $($item.Path)" "Warning" $Colors.Yellow
                }
            }
        }
    }
    
    if ($structureValid) {
        Write-Log "✅ Project structure verified" "Success" $Colors.Green
        $script:HealthScore++
    }
    
    return $structureValid
}

# Install dependencies
function Install-Dependencies {
    Write-Log "[STEP 4] Installing project dependencies..." "Info" $Colors.Yellow
    Update-Progress 4 $TotalChecks "System Setup" "Installing project dependencies"
    
    Push-Location $ServerDir
    
    try {
        # Clear npm cache
        Write-Log "Clearing npm cache..." "Info" $Colors.Blue
        & npm cache clean --force 2>$null
        
        if ($ForceReinstall -and (Test-Path "node_modules")) {
            Write-Log "Force reinstall: Removing existing node_modules..." "Info" $Colors.Blue
            Remove-Item "node_modules" -Recurse -Force
        }
        
        # Install dependencies with progress
        Write-Log "Installing dependencies..." "Info" $Colors.Blue
        
        $npmProcess = Start-Process -FilePath "npm" -ArgumentList "install" -NoNewWindow -PassThru -RedirectStandardOutput "npm-output.log" -RedirectStandardError "npm-error.log"
        
        # Monitor npm process
        do {
            Start-Sleep -Seconds 2
            Write-Host "." -NoNewline -ForegroundColor $Colors.Blue
        } while (-not $npmProcess.HasExited)
        
        Write-Host ""
        
        if ($npmProcess.ExitCode -eq 0) {
            Write-Log "✅ Dependencies installed successfully" "Success" $Colors.Green
            $script:HealthScore++
        } else {
            $errorContent = Get-Content "npm-error.log" -Raw -ErrorAction SilentlyContinue
            Write-Log "❌ Failed to install dependencies" "Error" $Colors.Red
            Write-Log "Error: $errorContent" "Error" $Colors.Red
            
            # Try alternative installation
            Write-Log "Trying alternative installation methods..." "Info" $Colors.Blue
            
            $alternatives = @("--force", "--legacy-peer-deps", "--no-optional")
            foreach ($alt in $alternatives) {
                Write-Log "Trying: npm install $alt" "Info" $Colors.Blue
                $result = Start-Process -FilePath "npm" -ArgumentList "install", $alt -NoNewWindow -Wait -PassThru
                
                if ($result.ExitCode -eq 0) {
                    Write-Log "✅ Alternative installation succeeded with: $alt" "Success" $Colors.Green
                    $script:HealthScore++
                    break
                }
            }
        }
        
        # Clean up log files
        Remove-Item "npm-output.log", "npm-error.log" -ErrorAction SilentlyContinue
        
    } catch {
        Write-Log "❌ Exception during dependency installation: $($_.Exception.Message)" "Error" $Colors.Red
        return $false
    } finally {
        Pop-Location
    }
    
    return $true
}

# Verify installed packages
function Test-Dependencies {
    Write-Log "[STEP 5] Verifying installed packages..." "Info" $Colors.Yellow
    Update-Progress 5 $TotalChecks "System Setup" "Verifying installed packages"
    
    Push-Location $ServerDir
    
    $requiredPackages = @("express", "ws", "xlsx", "cors", "nodemon")
    $packageStatus = @{}
    
    foreach ($package in $requiredPackages) {
        try {
            $result = & npm list $package 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Log "✅ Package verified: $package" "Success" $Colors.Green
                $packageStatus[$package] = $true
            } else {
                Write-Log "❌ Package missing: $package" "Error" $Colors.Red
                Write-Log "Installing missing package: $package" "Info" $Colors.Blue
                & npm install $package
                $packageStatus[$package] = ($LASTEXITCODE -eq 0)
            }
        } catch {
            Write-Log "❌ Error checking package: $package" "Error" $Colors.Red
            $packageStatus[$package] = $false
        }
    }
    
    Pop-Location
    
    $allPackagesInstalled = ($packageStatus.Values -notcontains $false)
    if ($allPackagesInstalled) {
        $script:HealthScore++
    }
    
    return $allPackagesInstalled
}

# Setup database
function Initialize-Database {
    Write-Log "[STEP 6] Setting up student database..." "Info" $Colors.Yellow
    Update-Progress 6 $TotalChecks "System Setup" "Setting up student database"
    
    $excelFile = Join-Path $ProjectRoot "Student-Data\students-database.xlsx"
    
    if (Test-Path $excelFile) {
        Write-Log "✅ Excel database found: $excelFile" "Success" $Colors.Green
        
        # Validate Excel file
        try {
            $fileInfo = Get-Item $excelFile
            Write-Log "Database file size: $([math]::Round($fileInfo.Length / 1KB, 2)) KB" "Info" $Colors.Blue
            Write-Log "Last modified: $($fileInfo.LastWriteTime)" "Info" $Colors.Blue
            $script:HealthScore++
        } catch {
            Write-Log "⚠️  Could not read database file details" "Warning" $Colors.Yellow
        }
    } else {
        Write-Log "⚠️  Excel database not found" "Warning" $Colors.Yellow
        Write-Log "Creating sample database structure..." "Info" $Colors.Blue
        
        # Create sample data info
        $sampleInfo = @"
NOTE: Sample data will be used for testing
Place your students-database.xlsx in Student-Data folder

Required Excel format:
- Column A: ID (Student ID)
- Column B: Name (Full Name)
- Column C: Center (Study Center)
- Column D: Subject (Subject Name)
- Column E: Grade (Grade Level)
- Column F: Fees (Fee Amount)
- Column G: Phone (Student Phone)
- Column H: Parent_Phone (Parent Phone)
"@
        
        $sampleFile = Join-Path $ProjectRoot "Student-Data\DATABASE_FORMAT.txt"
        Set-Content -Path $sampleFile -Value $sampleInfo
        Write-Log "✅ Database format guide created: DATABASE_FORMAT.txt" "Success" $Colors.Green
    }
}

# Test system components
function Test-SystemComponents {
    Write-Log "[STEP 7] Testing system components..." "Info" $Colors.Yellow
    Update-Progress 7 $TotalChecks "System Setup" "Testing system components"
    
    Push-Location $ServerDir
    
    try {
        # Start server in background
        Write-Log "Starting test server..." "Info" $Colors.Blue
        $serverProcess = Start-Process -FilePath "node" -ArgumentList "main-server.js" -NoNewWindow -PassThru
        
        # Wait for server startup
        Start-Sleep -Seconds 8
        
        # Test API endpoints
        $testEndpoints = @(
            @{ Url = "http://localhost:3000/api/student-cache"; Name = "Student Cache API" },
            @{ Url = "http://localhost:3000/entry-scanner"; Name = "Entry Scanner Page" },
            @{ Url = "http://localhost:3000/exit-validator"; Name = "Exit Validator Page" },
            @{ Url = "http://localhost:3000/admin-dashboard"; Name = "Admin Dashboard Page" }
        )
        
        $testResults = @{}
        
        foreach ($endpoint in $testEndpoints) {
            try {
                $response = Invoke-WebRequest -Uri $endpoint.Url -UseBasicParsing -TimeoutSec 5
                if ($response.StatusCode -eq 200) {
                    Write-Log "✅ $($endpoint.Name): SUCCESS" "Success" $Colors.Green
                    $testResults[$endpoint.Name] = $true
                } else {
                    Write-Log "❌ $($endpoint.Name): FAILED (Status: $($response.StatusCode))" "Error" $Colors.Red
                    $testResults[$endpoint.Name] = $false
                }
            } catch {
                Write-Log "❌ $($endpoint.Name): FAILED ($($_.Exception.Message))" "Error" $Colors.Red
                $testResults[$endpoint.Name] = $false
            }
        }
        
        # Stop test server
        if (-not $serverProcess.HasExited) {
            $serverProcess | Stop-Process -Force
            Start-Sleep -Seconds 2
        }
        
        $successfulTests = ($testResults.Values | Where-Object { $_ -eq $true }).Count
        $totalTests = $testResults.Count
        
        Write-Log "Test Results: $successfulTests/$totalTests endpoints working" "Info" $Colors.Blue
        
        if ($successfulTests -ge ($totalTests * 0.75)) {
            Write-Log "✅ System component tests passed" "Success" $Colors.Green
            $script:HealthScore++
        } else {
            Write-Log "⚠️  Some system components failed testing" "Warning" $Colors.Yellow
        }
        
    } catch {
        Write-Log "❌ System component testing failed: $($_.Exception.Message)" "Error" $Colors.Red
    } finally {
        # Ensure no orphaned processes
        Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -eq "" } | Stop-Process -Force -ErrorAction SilentlyContinue
        Pop-Location
    }
}

# Create startup shortcuts and utilities
function New-StartupShortcuts {
    Write-Log "[STEP 8] Creating startup shortcuts and utilities..." "Info" $Colors.Yellow
    Update-Progress 8 $TotalChecks "System Setup" "Creating startup shortcuts"
    
    try {
        # Create PowerShell launcher script
        $psLauncher = @"
# Student Lab System - PowerShell Launcher
param([switch]`$OpenBrowser)

Set-Location "$ServerDir"

if (`$OpenBrowser) {
    Start-Process "http://localhost:3000/entry-scanner"
    Start-Process "http://localhost:3000/exit-validator"
    Start-Process "http://localhost:3000/admin-dashboard"
    Start-Sleep 2
}

Write-Host "Starting Student Lab System..." -ForegroundColor Green
node main-server.js
"@
        
        Set-Content -Path (Join-Path $ProjectRoot "START_SYSTEM.ps1") -Value $psLauncher
        
        # Create silent VBS launcher
        $vbsLauncher = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run chr(34) & "$ProjectRoot\START_CLEAN_SYSTEM.bat" & Chr(34), 0
Set WshShell = Nothing
"@
        
        Set-Content -Path (Join-Path $ProjectRoot "start_system_silent.vbs") -Value $vbsLauncher
        
        # Create quick start with all interfaces
        $quickStart = @"
@echo off
cd /d "$ServerDir"
start "" http://localhost:3000/entry-scanner
start "" http://localhost:3000/exit-validator
start "" http://localhost:3000/admin-dashboard
timeout /t 3 /nobreak >nul
node main-server.js
"@
        
        Set-Content -Path (Join-Path $ProjectRoot "QUICK_START.bat") -Value $quickStart
        
        # Create system status checker
        $statusChecker = @"
# System Status Checker
`$serverDir = "$ServerDir"
Push-Location `$serverDir

Write-Host "Student Lab System - Status Check" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check Node.js
try {
    `$nodeVersion = & node --version
    Write-Host "✅ Node.js: `$nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js: Not found" -ForegroundColor Red
}

# Check dependencies
if (Test-Path "node_modules") {
    Write-Host "✅ Dependencies: Installed" -ForegroundColor Green
} else {
    Write-Host "❌ Dependencies: Missing" -ForegroundColor Red
}

# Check server file
if (Test-Path "main-server.js") {
    Write-Host "✅ Server: Ready" -ForegroundColor Green
} else {
    Write-Host "❌ Server: Missing" -ForegroundColor Red
}

# Test server connection
try {
    `$response = Invoke-WebRequest -Uri "http://localhost:3000/api/student-cache" -UseBasicParsing -TimeoutSec 3
    Write-Host "✅ Server: Running (Status: `$(`$response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Server: Not running" -ForegroundColor Yellow
}

Pop-Location
Read-Host "Press Enter to continue"
"@
        
        Set-Content -Path (Join-Path $ProjectRoot "CHECK_STATUS.ps1") -Value $statusChecker
        
        Write-Log "✅ Startup utilities created" "Success" $Colors.Green
        $script:HealthScore++
        
    } catch {
        Write-Log "❌ Failed to create startup shortcuts: $($_.Exception.Message)" "Error" $Colors.Red
    }
}

# Performance and security checks
function Test-SystemHealth {
    Write-Log "[STEP 9] Performing comprehensive health checks..." "Info" $Colors.Yellow
    Update-Progress 9 $TotalChecks "System Setup" "Performing health checks"
    
    $healthReport = @{}
    
    # System resources
    try {
        $memory = Get-WmiObject -Class Win32_ComputerSystem
        $cpu = Get-WmiObject -Class Win32_Processor
        $disk = Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "C:" }
        
        $healthReport["System"] = @{
            "Total RAM" = "$([math]::Round($memory.TotalPhysicalMemory / 1GB, 2)) GB"
            "CPU" = $cpu.Name
            "Free Disk Space" = "$([math]::Round($disk.FreeSpace / 1GB, 2)) GB"
        }
        
        Write-Log "✅ System resources checked" "Success" $Colors.Green
    } catch {
        Write-Log "⚠️  Could not retrieve system information" "Warning" $Colors.Yellow
    }
    
    # Network connectivity
    try {
        $networkTest = Test-NetConnection -ComputerName "google.com" -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue
        $healthReport["Network"] = if ($networkTest) { "Connected" } else { "Limited" }
        Write-Log "✅ Network connectivity: $($healthReport['Network'])" "Success" $Colors.Green
    } catch {
        $healthReport["Network"] = "Unknown"
        Write-Log "⚠️  Network test inconclusive" "Warning" $Colors.Yellow
    }
    
    # Security settings
    try {
        $executionPolicy = Get-ExecutionPolicy
        $healthReport["Security"] = @{
            "Execution Policy" = $executionPolicy
            "Windows Defender" = if (Get-Service -Name "WinDefend" -ErrorAction SilentlyContinue) { "Active" } else { "Unknown" }
        }
        Write-Log "✅ Security settings checked" "Success" $Colors.Green
    } catch {
        Write-Log "⚠️  Could not check security settings" "Warning" $Colors.Yellow
    }
    
    # Project specific checks
    $projectSize = (Get-ChildItem -Path $ProjectRoot -Recurse -File | Measure-Object -Property Length -Sum).Sum
    $healthReport["Project"] = @{
        "Total Size" = "$([math]::Round($projectSize / 1MB, 2)) MB"
        "Node Modules" = if (Test-Path (Join-Path $ServerDir "node_modules")) { "Present" } else { "Missing" }
        "Log Files" = (Get-ChildItem -Path $LogsDir -File -ErrorAction SilentlyContinue).Count
    }
    
    $script:HealthScore++
    return $healthReport
}

# Generate final report
function New-SetupReport {
    Write-Log "[STEP 10] Generating setup report..." "Info" $Colors.Yellow
    Update-Progress 10 $TotalChecks "System Setup" "Generating final report"
    
    $reportPath = Join-Path $ProjectRoot "SETUP_REPORT_$(Get-Date -Format 'yyyyMMdd-HHmmss').html"
    
    $healthReport = Test-SystemHealth
    
    $htmlReport = @"
<!DOCTYPE html>
<html>
<head>
    <title>Student Lab System - Setup Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 20px; margin-bottom: 30px; }
        .success { color: #27ae60; }
        .warning { color: #f39c12; }
        .error { color: #e74c3c; }
        .info { color: #3498db; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #3498db; background-color: #f8f9fa; }
        .health-score { font-size: 24px; font-weight: bold; text-align: center; padding: 20px; border-radius: 5px; }
        .score-excellent { background-color: #d4edda; color: #155724; }
        .score-good { background-color: #fff3cd; color: #856404; }
        .score-poor { background-color: #f8d7da; color: #721c24; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #3498db; color: white; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎓 Student Lab System</h1>
            <h2>Setup Report</h2>
            <p>Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
        </div>
        
        <div class="health-score $(if($script:HealthScore -ge 8){'score-excellent'}elseif($script:HealthScore -ge 6){'score-good'}else{'score-poor'})">
            Health Score: $script:HealthScore/$TotalChecks
            $(if($script:HealthScore -ge 8){'🎉 Excellent!'}elseif($script:HealthScore -ge 6){'✅ Good'}else{'⚠️ Needs Attention'})
        </div>
        
        <div class="section">
            <h3>📊 System Information</h3>
            <table>
                <tr><th>Component</th><th>Status</th></tr>
                <tr><td>Node.js</td><td class="success">$(try{& node --version}catch{'Not Found'})</td></tr>
                <tr><td>npm</td><td class="success">$(try{& npm --version}catch{'Not Found'})</td></tr>
                <tr><td>Project Root</td><td class="info">$ProjectRoot</td></tr>
                <tr><td>Setup Time</td><td class="info">$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</td></tr>
            </table>
        </div>
        
        <div class="section">
            <h3>🚀 Quick Start Commands</h3>
            <ul>
                <li><strong>Standard Start:</strong> Double-click <code>START_CLEAN_SYSTEM.bat</code></li>
                <li><strong>PowerShell Start:</strong> <code>.\START_SYSTEM.ps1 -OpenBrowser</code></li>
                <li><strong>Quick Start:</strong> Double-click <code>QUICK_START.bat</code></li>
                <li><strong>Silent Start:</strong> Double-click <code>start_system_silent.vbs</code></li>
                <li><strong>Status Check:</strong> <code>.\CHECK_STATUS.ps1</code></li>
            </ul>
        </div>
        
        <div class="section">
            <h3>🌐 Access URLs</h3>
            <ul>
                <li><strong>Entry Scanner:</strong> <a href="http://localhost:3000/entry-scanner">http://localhost:3000/entry-scanner</a></li>
                <li><strong>Exit Validator:</strong> <a href="http://localhost:3000/exit-validator">http://localhost:3000/exit-validator</a></li>
                <li><strong>Admin Dashboard:</strong> <a href="http://localhost:3000/admin-dashboard">http://localhost:3000/admin-dashboard</a></li>
                <li><strong>Embedded Scanner:</strong> <a href="http://localhost:3000/entry-scanner-embedded">http://localhost:3000/entry-scanner-embedded</a></li>
            </ul>
        </div>
        
        <div class="section">
            <h3>📁 Important Files</h3>
            <ul>
                <li><strong>Server:</strong> System\server\main-server.js</li>
                <li><strong>Database:</strong> Student-Data\students-database.xlsx</li>
                <li><strong>Logs:</strong> Logs\</li>
                <li><strong>Setup Log:</strong> $SetupLog</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Student Lab System v1.0 - Setup completed successfully!</p>
            <p>For support and documentation, check the Documentation folder.</p>
        </div>
    </div>
</body>
</html>
"@
    
    Set-Content -Path $reportPath -Value $htmlReport -Encoding UTF8
    Write-Log "✅ Setup report generated: $reportPath" "Success" $Colors.Green
    
    return $reportPath
}

# Main execution flow
function Start-Setup {
    try {
        Show-Header
        
        # Execute setup steps
        $adminPrivileges = Test-AdminPrivileges
        
        if (-not (Test-NodeJS)) {
            throw "Node.js installation failed"
        }
        
        if (-not (Test-ProjectStructure)) {
            throw "Project structure validation failed"
        }
        
        if (-not (Install-Dependencies)) {
            throw "Dependency installation failed"
        }
        
        if (-not (Test-Dependencies)) {
            Write-Log "⚠️  Some dependencies may be missing, but continuing..." "Warning" $Colors.Yellow
        }
        
        Initialize-Database
        Test-SystemComponents
        New-StartupShortcuts
        
        # Generate final report
        $reportPath = New-SetupReport
        
        # Final summary
        Write-Progress -Activity "Setup Complete" -Completed
        Write-Host "`n" -NoNewline
        
        Write-Log "==========================================" "Info" $Colors.Green
        Write-Log "           SETUP COMPLETE!" "Info" $Colors.Green
        Write-Log "==========================================" "Info" $Colors.Green
        Write-Log "" "Info" $Colors.White
        Write-Log "🎉 Your Student Lab System is ready!" "Success" $Colors.Green
        Write-Log "" "Info" $Colors.White
        Write-Log "📊 Final Health Score: $script:HealthScore/$TotalChecks" "Info" $Colors.Blue
        
        if ($script:HealthScore -ge 8) {
            Write-Log "✅ Excellent! System is fully operational" "Success" $Colors.Green
        } elseif ($script:HealthScore -ge 6) {
            Write-Log "✅ Good! System should work with minor issues" "Success" $Colors.Yellow
        } else {
            Write-Log "⚠️  System may have issues. Check the setup log." "Warning" $Colors.Red
        }
        
        Write-Log "" "Info" $Colors.White
        Write-Log "📋 Setup Report: $reportPath" "Info" $Colors.Blue
        Write-Log "📝 Setup Log: $SetupLog" "Info" $Colors.Blue
        
        # Ask to start system
        if (-not $Silent) {
            Write-Host "`nWould you like to:" -ForegroundColor $Colors.Yellow
            Write-Host "1. Start the system now" -ForegroundColor $Colors.White
            Write-Host "2. Open the setup report" -ForegroundColor $Colors.White
            Write-Host "3. Exit" -ForegroundColor $Colors.White
            Write-Host "Enter choice (1-3): " -ForegroundColor $Colors.Yellow -NoNewline
            
            $choice = Read-Host
            
            switch ($choice) {
                "1" {
                    Write-Log "Starting Student Lab System..." "Info" $Colors.Blue
                    & (Join-Path $ProjectRoot "START_CLEAN_SYSTEM.bat")
                }
                "2" {
                    Write-Log "Opening setup report..." "Info" $Colors.Blue
                    Start-Process $reportPath
                }
                default {
                    Write-Log "Setup complete! Use the batch files to start the system when ready." "Success" $Colors.Green
                }
            }
        }
        
    } catch {
        Write-Log "❌ Setup failed: $($_.Exception.Message)" "Error" $Colors.Red
        Write-Log "Check the setup log for details: $SetupLog" "Error" $Colors.Red
        
        if (-not $Silent) {
            Read-Host "Press Enter to exit"
        }
        exit 1
    }
}

# Script entry point
if ($MyInvocation.InvocationName -ne '.') {
    Start-Setup
}
