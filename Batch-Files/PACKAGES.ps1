# Student Lab System - Package Manager (PowerShell)
# Enhanced version with better error handling and cross-platform support

param(
    [switch]$Help,
    [switch]$Force
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "Student Lab System - Package Manager"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Cyan"
Clear-Host

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - PACKAGE MANAGER" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\PACKAGES.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help    Show this help message" -ForegroundColor White
    Write-Host "  -Force   Skip confirmation prompts" -ForegroundColor White
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  ✓ Check all required packages" -ForegroundColor White
    Write-Host "  ✓ Download and install missing packages" -ForegroundColor White
    Write-Host "  ✓ Update existing packages" -ForegroundColor White
    Write-Host "  ✓ Verify package compatibility" -ForegroundColor White
    Write-Host "  ✓ Clean up old/unused packages" -ForegroundColor White
    Write-Host ""
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

# Function to get command version with timeout
function Get-CommandVersion {
    param(
        [string]$Command,
        [int]$TimeoutSeconds = 10
    )
    
    try {
        $job = Start-Job -ScriptBlock {
            param($cmd)
            & $cmd --version 2>$null
        } -ArgumentList $Command
        
        if (Wait-Job -Job $job -Timeout $TimeoutSeconds) {
            $result = Receive-Job -Job $job
            Remove-Job -Job $job
            if ($LASTEXITCODE -eq 0 -and $result) {
                return $result.Trim()
            }
        } else {
            Remove-Job -Job $job -Force
        }
        
        # Try alternative version commands
        $job = Start-Job -ScriptBlock {
            param($cmd)
            & $cmd -v 2>$null
        } -ArgumentList $Command
        
        if (Wait-Job -Job $job -Timeout $TimeoutSeconds) {
            $result = Receive-Job -Job $job
            Remove-Job -Job $job
            if ($LASTEXITCODE -eq 0 -and $result) {
                return $result.Trim()
            }
        } else {
            Remove-Job -Job $job -Force
        }
        
        return "Unknown"
    }
    catch {
        return "Unknown"
    }
}

# Function to run npm command with timeout
function Invoke-NpmCommand {
    param(
        [string]$Command,
        [string]$Arguments = "",
        [int]$TimeoutSeconds = 300
    )
    
    try {
        $fullCommand = "npm $Command $Arguments"
        Write-Host "Executing: $fullCommand" -ForegroundColor Gray
        
        $job = Start-Job -ScriptBlock {
            param($cmd, $args)
            & npm $cmd $args.Split(' ')
        } -ArgumentList $Command, $Arguments
        
        if (Wait-Job -Job $job -Timeout $TimeoutSeconds) {
            $result = Receive-Job -Job $job
            Remove-Job -Job $job
            return $LASTEXITCODE -eq 0
        } else {
            Remove-Job -Job $job -Force
            Write-Host "WARNING: Command timed out after $TimeoutSeconds seconds" -ForegroundColor Yellow
            return $false
        }
    }
    catch {
        Write-Host "ERROR: Failed to execute npm command: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to check npm package
function Test-NpmPackage {
    param(
        [string]$PackageName,
        [int]$TimeoutSeconds = 10
    )
    
    try {
        $job = Start-Job -ScriptBlock {
            param($pkg)
            npm list $pkg --depth=0 2>$null
        } -ArgumentList $PackageName
        
        if (Wait-Job -Job $job -Timeout $TimeoutSeconds) {
            $result = Receive-Job -Job $job
            Remove-Job -Job $job
            return $LASTEXITCODE -eq 0
        } else {
            Remove-Job -Job $job -Force
            return $false
        }
    }
    catch {
        return $false
    }
}

# Main package management function
function Start-PackageManagement {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - PACKAGE MANAGER" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  ✓ Check all required packages" -ForegroundColor White
    Write-Host "  ✓ Download and install missing packages" -ForegroundColor White
    Write-Host "  ✓ Update existing packages" -ForegroundColor White
    Write-Host "  ✓ Verify package compatibility" -ForegroundColor White
    Write-Host "  ✓ Clean up old/unused packages" -ForegroundColor White
    Write-Host ""
    
    if (-not (Get-UserConfirmation "Continue with package management?")) {
        Write-Host "Package management cancelled." -ForegroundColor Yellow
        return
    }
    
    # Step 1: System Packages Check
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 1: SYSTEM PACKAGES CHECK" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Checking system packages..." -ForegroundColor Green
    
    # Check Node.js
    Write-Host "Checking Node.js..." -ForegroundColor Green
    if (Test-Command "node") {
        $nodeVersion = Get-CommandVersion "node"
        if ($nodeVersion -ne "Unknown") {
            Write-Host "OK Node.js: $nodeVersion" -ForegroundColor Green
            $nodeMissing = $false
        } else {
            Write-Host "ERROR: Node.js version check failed!" -ForegroundColor Red
            $nodeMissing = $true
        }
    } else {
        Write-Host "ERROR: Node.js not found!" -ForegroundColor Red
        $nodeMissing = $true
    }
    
    # Check npm
    Write-Host "Checking npm..." -ForegroundColor Green
    if (Test-Command "npm") {
        $npmVersion = Get-CommandVersion "npm"
        if ($npmVersion -ne "Unknown") {
            Write-Host "OK npm: $npmVersion" -ForegroundColor Green
            $npmMissing = $false
        } else {
            Write-Host "ERROR: npm version check failed!" -ForegroundColor Red
            $npmMissing = $true
        }
    } else {
        Write-Host "ERROR: npm not found!" -ForegroundColor Red
        $npmMissing = $true
    }
    
    # Check MySQL
    Write-Host "Checking MySQL..." -ForegroundColor Green
    if (Test-Command "mysql") {
        $mysqlVersion = Get-CommandVersion "mysql"
        if ($mysqlVersion -ne "Unknown") {
            Write-Host "OK MySQL: $mysqlVersion" -ForegroundColor Green
            $mysqlMissing = $false
        } else {
            Write-Host "ERROR: MySQL version check failed!" -ForegroundColor Red
            $mysqlMissing = $true
        }
    } else {
        Write-Host "ERROR: MySQL not found!" -ForegroundColor Red
        $mysqlMissing = $true
    }
    
    # Step 2: Missing Packages Installation
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 2: MISSING PACKAGES INSTALLATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    if ($nodeMissing) {
        Write-Host "Node.js is missing!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Node.js manually:" -ForegroundColor Yellow
        Write-Host "1. Go to: https://nodejs.org/" -ForegroundColor White
        Write-Host "2. Download the LTS version" -ForegroundColor White
        Write-Host "3. Run the installer" -ForegroundColor White
        Write-Host "4. Restart this script" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    if ($mysqlMissing) {
        Write-Host "MySQL is missing!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install MySQL manually:" -ForegroundColor Yellow
        Write-Host "1. Go to: https://dev.mysql.com/downloads/mysql/" -ForegroundColor White
        Write-Host "2. Download MySQL Community Server" -ForegroundColor White
        Write-Host "3. Run the installer" -ForegroundColor White
        Write-Host "4. Or use XAMPP: https://www.apachefriends.org/" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host "OK All system packages are available" -ForegroundColor Green
    
    # Step 3: Node.js Dependencies Check
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 3: NODE.JS DEPENDENCIES CHECK" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Checking Node.js dependencies..." -ForegroundColor Green
    
    $serverPath = "..\System\server"
    if (-not (Test-Path $serverPath)) {
        Write-Host "ERROR: Server directory not found!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Set-Location $serverPath
    
    if (-not (Test-Path "package.json")) {
        Write-Host "ERROR: package.json not found in server directory!" -ForegroundColor Red
        Write-Host "Please ensure the project files are complete" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host "OK package.json found" -ForegroundColor Green
    
    if (-not (Test-Path "node_modules")) {
        Write-Host "WARNING: node_modules not found - dependencies need to be installed" -ForegroundColor Yellow
        $dependenciesMissing = $true
    } else {
        Write-Host "OK node_modules directory exists" -ForegroundColor Green
        $dependenciesMissing = $false
    }
    
    # Step 4: Dependency Installation
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 4: DEPENDENCY INSTALLATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    if ($dependenciesMissing) {
        Write-Host "Installing Node.js dependencies..." -ForegroundColor Green
        Write-Host "This may take a few minutes..." -ForegroundColor Yellow
        Write-Host ""
        
        Write-Host "Starting npm install (this may take several minutes)..." -ForegroundColor Green
        Write-Host "If this appears to freeze, press Ctrl+C to cancel" -ForegroundColor Yellow
        
        if (Invoke-NpmCommand -Command "install" -Arguments "--no-optional --no-audit --no-fund") {
            Write-Host "OK Dependencies installed successfully" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to install dependencies!" -ForegroundColor Red
            Write-Host ""
            Write-Host "Common solutions:" -ForegroundColor Yellow
            Write-Host "1. Check internet connection" -ForegroundColor White
            Write-Host "2. Clear npm cache: npm cache clean --force" -ForegroundColor White
            Write-Host "3. Delete node_modules and package-lock.json, then try again" -ForegroundColor White
            Write-Host "4. Run as administrator" -ForegroundColor White
            Write-Host ""
            Read-Host "Press Enter to exit"
            exit 1
        }
    } else {
        Write-Host "Updating existing dependencies..." -ForegroundColor Green
        Write-Host ""
        
        Write-Host "Starting npm update..." -ForegroundColor Green
        if (Invoke-NpmCommand -Command "update" -Arguments "--no-optional --no-audit --no-fund") {
            Write-Host "OK Dependencies updated successfully" -ForegroundColor Green
        } else {
            Write-Host "WARNING: Some packages could not be updated" -ForegroundColor Yellow
        }
    }
    
    # Step 5: Package Verification
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 5: PACKAGE VERIFICATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Verifying installed packages..." -ForegroundColor Green
    
    $criticalPackages = @("express", "mysql2", "cors", "multer", "xlsx", "ws", "dotenv")
    $packageError = $false
    
    foreach ($package in $criticalPackages) {
        Write-Host "Checking $package..." -ForegroundColor Green
        if (Test-NpmPackage -PackageName $package) {
            Write-Host "OK $package is installed" -ForegroundColor Green
        } else {
            Write-Host "ERROR: $package is missing or not properly installed" -ForegroundColor Red
            $packageError = $true
        }
    }
    
    if ($packageError) {
        Write-Host ""
        Write-Host "ERROR: Some critical packages are missing!" -ForegroundColor Red
        Write-Host "Attempting to reinstall..." -ForegroundColor Yellow
        
        Write-Host "Reinstalling packages..." -ForegroundColor Green
        if (Invoke-NpmCommand -Command "install" -Arguments "--no-optional --no-audit --no-fund") {
            Write-Host "OK Packages reinstalled successfully" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Reinstallation failed!" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
    
    # Step 6: Package Cleanup
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 6: PACKAGE CLEANUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Cleaning up packages..." -ForegroundColor Green
    
    # Clear npm cache
    Write-Host "Clearing npm cache..." -ForegroundColor Green
    if (Invoke-NpmCommand -Command "cache" -Arguments "clean --force") {
        Write-Host "OK npm cache cleared" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Failed to clear npm cache" -ForegroundColor Yellow
    }
    
    # Check for outdated packages
    Write-Host "Checking for outdated packages..." -ForegroundColor Green
    if (Invoke-NpmCommand -Command "outdated" -Arguments "--depth=0") {
        Write-Host "WARNING: Some packages are outdated" -ForegroundColor Yellow
        Write-Host "Run 'npm update' to update them" -ForegroundColor White
    } else {
        Write-Host "OK All packages are up to date" -ForegroundColor Green
    }
    
    # Check for vulnerabilities
    Write-Host "Checking for security vulnerabilities..." -ForegroundColor Green
    if (Invoke-NpmCommand -Command "audit" -Arguments "--audit-level=moderate") {
        Write-Host "WARNING: Some security vulnerabilities found" -ForegroundColor Yellow
        Write-Host "Run 'npm audit fix' to fix them" -ForegroundColor White
    } else {
        Write-Host "OK No security vulnerabilities found" -ForegroundColor Green
    }
    
    # Step 7: Compatibility Check
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 7: COMPATIBILITY CHECK" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Checking package compatibility..." -ForegroundColor Green
    
    # Check Node.js version compatibility
    Write-Host "Checking Node.js version compatibility..." -ForegroundColor Green
    if ($nodeVersion -match "v(\d+)") {
        $nodeMajor = [int]$matches[1]
        if ($nodeMajor -lt 16) {
            Write-Host "WARNING: Node.js version $nodeVersion may not be fully compatible" -ForegroundColor Yellow
            Write-Host "Recommended: Node.js 16 or higher" -ForegroundColor White
        } else {
            Write-Host "OK Node.js version is compatible" -ForegroundColor Green
        }
    }
    
    # Check npm version
    Write-Host "Checking npm version compatibility..." -ForegroundColor Green
    if ($npmVersion -match "(\d+)") {
        $npmMajor = [int]$matches[1]
        if ($npmMajor -lt 8) {
            Write-Host "WARNING: npm version $npmVersion may not be fully compatible" -ForegroundColor Yellow
            Write-Host "Recommended: npm 8 or higher" -ForegroundColor White
        } else {
            Write-Host "OK npm version is compatible" -ForegroundColor Green
        }
    }
    
    # Step 8: Final Verification
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 8: FINAL VERIFICATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Final package verification..." -ForegroundColor Green
    
    # Test Node.js
    Write-Host "Testing Node.js..." -ForegroundColor Green
    try {
        $result = node -e "console.log('Node.js test: OK')" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Node.js test passed" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Node.js test failed!" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
    catch {
        Write-Host "ERROR: Node.js test failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Test npm
    Write-Host "Testing npm..." -ForegroundColor Green
    try {
        $result = npm --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK npm test passed" -ForegroundColor Green
        } else {
            Write-Host "ERROR: npm test failed!" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
    catch {
        Write-Host "ERROR: npm test failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Test critical modules
    Write-Host "Testing critical modules..." -ForegroundColor Green
    try {
        $result = node -e "require('express'); console.log('Express: OK')" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Express module test passed" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Express module test failed!" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
    catch {
        Write-Host "ERROR: Express module test failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    try {
        $result = node -e "require('mysql2'); console.log('MySQL2: OK')" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK MySQL2 module test passed" -ForegroundColor Green
        } else {
            Write-Host "ERROR: MySQL2 module test failed!" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
    catch {
        Write-Host "ERROR: MySQL2 module test failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Success message
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   PACKAGE MANAGEMENT COMPLETED!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Package Summary:" -ForegroundColor Yellow
    Write-Host "OK Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "OK npm: $npmVersion" -ForegroundColor Green
    Write-Host "OK MySQL: $mysqlVersion" -ForegroundColor Green
    Write-Host "OK Dependencies: Installed and verified" -ForegroundColor Green
    Write-Host "OK Compatibility: Checked" -ForegroundColor Green
    Write-Host "OK Security: Audited" -ForegroundColor Green
    Write-Host ""
    Write-Host "All packages are ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run SETUP.ps1 to configure the system" -ForegroundColor White
    Write-Host "2. Run START.ps1 to start the server" -ForegroundColor White
    Write-Host ""
    Write-Host "For troubleshooting:" -ForegroundColor Yellow
    Write-Host "- Check internet connection" -ForegroundColor White
    Write-Host "- Run as administrator" -ForegroundColor White
    Write-Host "- Clear npm cache: npm cache clean --force" -ForegroundColor White
    Write-Host ""
}

# Handle help parameter
if ($Help) {
    Show-Help
    exit 0
}

# Check if we're in the right directory
if (-not (Test-Path "Batch-Files")) {
    Write-Host "ERROR: Please run this script from the project root directory!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start package management
try {
    Start-PackageManagement
}
catch {
    Write-Host ""
    Write-Host "ERROR: An unexpected error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to continue"
