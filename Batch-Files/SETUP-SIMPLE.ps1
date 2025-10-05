# Student Lab System - Simple Setup (PowerShell)
# Simplified version with basic functionality

param(
    [switch]$Help
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "Student Lab System - Simple Setup"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Green"
Clear-Host

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - SIMPLE SETUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\SETUP-SIMPLE.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help    Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  - Check system requirements" -ForegroundColor White
    Write-Host "  - Install Node.js dependencies" -ForegroundColor White
    Write-Host "  - Create basic configuration files" -ForegroundColor White
    Write-Host "  - Test the setup" -ForegroundColor White
    Write-Host ""
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

# Function to get command version
function Get-CommandVersion {
    param([string]$Command)
    
    try {
        $version = & $Command --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            return $version.Trim()
        }
    }
    catch {
        return "Unknown"
    }
    return "Unknown"
}

# Main setup function
function Start-SimpleSetup {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - SIMPLE SETUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  - Check system requirements" -ForegroundColor White
    Write-Host "  - Install Node.js dependencies" -ForegroundColor White
    Write-Host "  - Create basic configuration files" -ForegroundColor White
    Write-Host "  - Test the setup" -ForegroundColor White
    Write-Host ""
    
    $continue = Read-Host "Continue with setup? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Setup cancelled." -ForegroundColor Yellow
        return
    }
    
    # Step 1: System Requirements Check
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 1: SYSTEM REQUIREMENTS CHECK" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Checking Windows version..." -ForegroundColor Green
    if ($env:OS -like "*Windows*") {
        Write-Host "OK Windows detected" -ForegroundColor Green
    } else {
        Write-Host "ERROR: This script requires Windows" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Check if running as administrator
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
    if ($isAdmin) {
        Write-Host "OK Running as administrator" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Not running as administrator" -ForegroundColor Yellow
        Write-Host "Some operations may require admin privileges" -ForegroundColor Yellow
    }
    
    # Step 2: Node.js Check
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 2: NODE.JS CHECK" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Checking Node.js installation..." -ForegroundColor Green
    
    if (Test-Command "node") {
        $nodeVersion = Get-CommandVersion "node"
        Write-Host "OK Node.js found: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Node.js not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
        Write-Host "Download the LTS version" -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    if (Test-Command "npm") {
        $npmVersion = Get-CommandVersion "npm"
        Write-Host "OK npm found: $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "ERROR: npm not found!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Step 3: Dependency Installation
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 3: DEPENDENCY INSTALLATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Green
    
    $serverPath = "System\server"
    if (-not (Test-Path $serverPath)) {
        Write-Host "ERROR: Server directory not found at: $serverPath" -ForegroundColor Red
        Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
        Write-Host "Available directories:" -ForegroundColor Yellow
        Get-ChildItem -Directory | ForEach-Object { Write-Host "  $($_.Name)" -ForegroundColor White }
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host "Changing to server directory: $serverPath" -ForegroundColor Green
    Set-Location $serverPath
    
    Write-Host "Installing server dependencies..." -ForegroundColor Green
    try {
        & npm install --no-optional --no-audit --no-fund
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Server dependencies installed" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to install server dependencies!" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
    catch {
        Write-Host "ERROR: Failed to install server dependencies!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Step 4: Configuration Files
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 4: CONFIGURATION FILES" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Creating configuration files..." -ForegroundColor Green
    
    # Create basic .env file
    $envContent = @"
# Student Lab System - Environment Configuration
# Generated by SETUP-SIMPLE.ps1
# Date: $(Get-Date)

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=student_lab_system
DB_USER=student_lab_user
DB_PASSWORD=StudentLab2024!Secure

# Server Configuration
PORT=3000
NODE_ENV=production

# WebSocket Configuration
WS_PORT=3000

# Security Configuration
JWT_SECRET=StudentLab2024!JWTSecret
SESSION_SECRET=StudentLab2024!SessionSecret

# Logging Configuration
LOG_LEVEL=INFO
LOG_FILE=./logs/server.log

# Performance Configuration
MAX_CONNECTIONS=100
REQUEST_TIMEOUT=30000
SYNC_INTERVAL=5000

# Offline Mode Configuration
OFFLINE_MODE_ENABLED=true
OFFLINE_QUEUE_SIZE=1000

# Data Integrity Configuration
DATA_INTEGRITY_CHECKS=true
DATA_VALIDATION_ENABLED=true
DUPLICATE_PREVENTION=true
"@
    
    try {
        $envContent | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "OK .env file created" -ForegroundColor Green
    }
    catch {
        Write-Host "ERROR: Failed to create .env file!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Create basic db-config.js file
    $jsContent = @"
// Database Configuration
// Generated by SETUP-SIMPLE.ps1
// Date: $(Get-Date)

module.exports = {
    host: 'localhost',
    user: 'student_lab_user',
    password: 'StudentLab2024!Secure',
    database: 'student_lab_system',
    charset: 'utf8mb4',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    multipleStatements: true,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true
};
"@
    
    try {
        $jsContent | Out-File -FilePath "db-config.js" -Encoding UTF8
        Write-Host "OK db-config.js file created" -ForegroundColor Green
    }
    catch {
        Write-Host "ERROR: Failed to create db-config.js file!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Step 5: Final Testing
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 5: FINAL TESTING" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Testing setup..." -ForegroundColor Green
    
    # Test Node.js
    Write-Host "Testing Node.js..." -ForegroundColor Green
    try {
        $result = & node -e "console.log('Node.js test successful')" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Node.js test successful" -ForegroundColor Green
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
    
    # Success message
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   SETUP COMPLETED SUCCESSFULLY!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Setup Summary:" -ForegroundColor Yellow
    Write-Host "OK Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "OK npm: $npmVersion" -ForegroundColor Green
    Write-Host "OK Dependencies: Installed" -ForegroundColor Green
    Write-Host "OK Configuration: Files created" -ForegroundColor Green
    Write-Host "OK Testing: All tests passed" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your Student Lab System is ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "To start the system:" -ForegroundColor Yellow
    Write-Host "1. Run: LAUNCHER.ps1 → Option 1 (Quick Start)" -ForegroundColor White
    Write-Host "2. Or manually: cd System\server && node main-server.js" -ForegroundColor White
    Write-Host "3. Open: http://localhost:3000" -ForegroundColor White
    Write-Host ""
    Write-Host "Note: You may need to set up MySQL database manually" -ForegroundColor Yellow
    Write-Host "See the original batch files for MySQL setup instructions" -ForegroundColor Yellow
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

# Start setup
try {
    Start-SimpleSetup
}
catch {
    Write-Host ""
    Write-Host "ERROR: An unexpected error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to continue"
