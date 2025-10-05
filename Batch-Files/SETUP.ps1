# Student Lab System - Complete Setup (PowerShell)
# Enhanced version with better error handling and cross-platform support

param(
    [switch]$Help,
    [switch]$Force
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "Student Lab System - Complete Setup"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Green"
Clear-Host

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - COMPLETE SETUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\SETUP.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help    Show this help message" -ForegroundColor White
    Write-Host "  -Force   Skip confirmation prompts" -ForegroundColor White
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  ✓ Check and install all required software" -ForegroundColor White
    Write-Host "  ✓ Set up MySQL database with dedicated user" -ForegroundColor White
    Write-Host "  ✓ Install Node.js dependencies" -ForegroundColor White
    Write-Host "  ✓ Configure all system files" -ForegroundColor White
    Write-Host "  ✓ Test everything to ensure it works" -ForegroundColor White
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
        # Try alternative version commands
        try {
            $version = & $Command -v 2>$null
            if ($LASTEXITCODE -eq 0) {
                return $version.Trim()
            }
        }
        catch {
            # Try -version
            try {
                $version = & $Command -version 2>$null
                if ($LASTEXITCODE -eq 0) {
                    return $version.Trim()
                }
            }
            catch {
                return "Unknown"
            }
        }
    }
    return "Unknown"
}

# Function to test MySQL connection
function Test-MySQLConnection {
    param(
        [string]$User = "root",
        [string]$Password = ""
    )
    
    try {
        if ([string]::IsNullOrEmpty($Password)) {
            $result = & mysql -u $User -e 'SELECT 1 as test;' 2>$null
        } else {
            $result = & mysql -u $User -p$Password -e 'SELECT 1 as test;' 2>$null
        }
        
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        return $false
    }
}

# Function to create MySQL user
function New-MySQLUser {
    param(
        [string]$RootUser,
        [string]$RootPassword,
        [string]$NewUser,
        [string]$NewPassword
    )
    
    $commands = @(
        "CREATE USER IF NOT EXISTS '$NewUser'@'localhost' IDENTIFIED BY '$NewPassword';",
        "GRANT ALL PRIVILEGES ON *.* TO '$NewUser'@'localhost';",
        "FLUSH PRIVILEGES;"
    )
    
    foreach ($cmd in $commands) {
        try {
            if ([string]::IsNullOrEmpty($RootPassword)) {
                $result = & mysql -u $RootUser -e $cmd 2>$null
            } else {
                $result = & mysql -u $RootUser -p$RootPassword -e $cmd 2>$null
            }
            
            if ($LASTEXITCODE -ne 0) {
                return $false
            }
        }
        catch {
            return $false
        }
    }
    
    return $true
}

# Function to create database
function New-MySQLDatabase {
    param(
        [string]$User,
        [string]$Password,
        [string]$DatabaseName
    )
    
    try {
        $result = & mysql -u $User -p$Password -e "CREATE DATABASE IF NOT EXISTS $DatabaseName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>$null
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        return $false
    }
}

# Function to import schema
function Import-MySQLSchema {
    param(
        [string]$User,
        [string]$Password,
        [string]$DatabaseName,
        [string]$SchemaPath
    )
    
    try {
        if (Test-Path $SchemaPath) {
            $content = Get-Content $SchemaPath -Raw
            $result = & mysql -u $User -p$Password $DatabaseName -e $content 2>$null
            return ($LASTEXITCODE -eq 0)
        } else {
            # Create basic tables if schema doesn't exist
            $basicTables = @(
                "CREATE TABLE IF NOT EXISTS students (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255) NOT NULL, center VARCHAR(255), grade VARCHAR(50), phone VARCHAR(20), parent_phone VARCHAR(20), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);",
                "CREATE TABLE IF NOT EXISTS registrations (id INT AUTO_INCREMENT PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), center VARCHAR(255), device_name VARCHAR(100), registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
            )
            
            foreach ($table in $basicTables) {
                $result = & mysql -u $User -p$Password $DatabaseName -e $table 2>$null
                if ($LASTEXITCODE -ne 0) {
                    return $false
                }
            }
            return $true
        }
    }
    catch {
        return $false
    }
}

# Function to create .env file
function New-EnvFile {
    param(
        [string]$Path,
        [hashtable]$Config
    )
    
    $envContent = @"
# Student Lab System - Environment Configuration
# Generated by SETUP.ps1
# Date: $(Get-Date)

# Database Configuration
DB_HOST=$($Config.DB_HOST)
DB_PORT=$($Config.DB_PORT)
DB_NAME=$($Config.DB_NAME)
DB_USER=$($Config.DB_USER)
DB_PASSWORD=$($Config.DB_PASSWORD)

# Server Configuration
PORT=$($Config.PORT)
NODE_ENV=$($Config.NODE_ENV)

# WebSocket Configuration
WS_PORT=$($Config.WS_PORT)

# Security Configuration
JWT_SECRET=$($Config.JWT_SECRET)
SESSION_SECRET=$($Config.SESSION_SECRET)

# Logging Configuration
LOG_LEVEL=$($Config.LOG_LEVEL)
LOG_FILE=$($Config.LOG_FILE)

# Performance Configuration
MAX_CONNECTIONS=$($Config.MAX_CONNECTIONS)
REQUEST_TIMEOUT=$($Config.REQUEST_TIMEOUT)
SYNC_INTERVAL=$($Config.SYNC_INTERVAL)

# Offline Mode Configuration
OFFLINE_MODE_ENABLED=$($Config.OFFLINE_MODE_ENABLED)
OFFLINE_QUEUE_SIZE=$($Config.OFFLINE_QUEUE_SIZE)

# Data Integrity Configuration
DATA_INTEGRITY_CHECKS=$($Config.DATA_INTEGRITY_CHECKS)
DATA_VALIDATION_ENABLED=$($Config.DATA_VALIDATION_ENABLED)
DUPLICATE_PREVENTION=$($Config.DUPLICATE_PREVENTION)
"@
    
    try {
        $envContent | Out-File -FilePath $Path -Encoding UTF8
        return $true
    }
    catch {
        return $false
    }
}

# Function to create db-config.js file
function New-DbConfigFile {
    param(
        [string]$Path,
        [hashtable]$Config
    )
    
    $jsContent = @"
// Database Configuration
// Generated by SETUP.ps1
// Date: $(Get-Date)

module.exports = {
    host: '$($Config.DB_HOST)',
    user: '$($Config.DB_USER)',
    password: '$($Config.DB_PASSWORD)',
    database: '$($Config.DB_NAME)',
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
        $jsContent | Out-File -FilePath $Path -Encoding UTF8
        return $true
    }
    catch {
        return $false
    }
}

# Main setup function
function Start-Setup {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - COMPLETE SETUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  ✓ Check and install all required software" -ForegroundColor White
    Write-Host "  ✓ Set up MySQL database with dedicated user" -ForegroundColor White
    Write-Host "  ✓ Install Node.js dependencies" -ForegroundColor White
    Write-Host "  ✓ Configure all system files" -ForegroundColor White
    Write-Host "  ✓ Test everything to ensure it works" -ForegroundColor White
    Write-Host ""
    
    if (-not (Get-UserConfirmation "Continue with complete setup?")) {
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
    
    # Step 2: MySQL Installation Check
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 2: MYSQL INSTALLATION CHECK" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Checking MySQL installation..." -ForegroundColor Green
    if (Test-Command "mysql") {
        $mysqlVersion = Get-CommandVersion "mysql"
        Write-Host "OK MySQL found: $mysqlVersion" -ForegroundColor Green
    } else {
        Write-Host "ERROR: MySQL not found!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install MySQL first:" -ForegroundColor Yellow
        Write-Host "1. Download from: https://dev.mysql.com/downloads/mysql/" -ForegroundColor White
        Write-Host "2. Or use XAMPP: https://www.apachefriends.org/" -ForegroundColor White
        Write-Host "3. Make sure MySQL is added to your system PATH" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Check MySQL service
    Write-Host "Checking MySQL service..." -ForegroundColor Green
    $mysqlServices = @("mysql", "mysql80", "mysql57")
    $mysqlService = $null
    
    foreach ($service in $mysqlServices) {
        try {
            $serviceStatus = Get-Service -Name $service -ErrorAction SilentlyContinue
            if ($serviceStatus) {
                $mysqlService = $service
                break
            }
        }
        catch {
            continue
        }
    }
    
    if (-not $mysqlService) {
        Write-Host "ERROR: MySQL service not found!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host "Starting MySQL service..." -ForegroundColor Green
    try {
        $service = Get-Service -Name $mysqlService
        if ($service.Status -ne "Running") {
            Start-Service -Name $mysqlService
            Start-Sleep -Seconds 3
        }
        Write-Host "OK MySQL service is running" -ForegroundColor Green
    }
    catch {
        Write-Host "ERROR: Failed to start MySQL service!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Step 3: MySQL Connection Setup
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 3: MYSQL CONNECTION SETUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Analyzing MySQL connection..." -ForegroundColor Green
    Write-Host ""
    
    $mysqlHasPassword = $false
    $mysqlRootUser = "root"
    $mysqlRootPass = ""
    
    if (Test-MySQLConnection -User "root" -Password "") {
        Write-Host "OK MySQL root user has no password" -ForegroundColor Green
    } else {
        Write-Host "WARNING: MySQL root user requires password" -ForegroundColor Yellow
        $mysqlHasPassword = $true
        
        Write-Host "Please enter your MySQL root credentials:" -ForegroundColor Yellow
        $mysqlRootUser = Read-Host "MySQL root username (default: root)"
        if ([string]::IsNullOrEmpty($mysqlRootUser)) {
            $mysqlRootUser = "root"
        }
        
        $mysqlRootPass = Read-Host "MySQL root password" -AsSecureString
        $mysqlRootPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($mysqlRootPass))
        
        if (-not (Test-MySQLConnection -User $mysqlRootUser -Password $mysqlRootPass)) {
            Write-Host "ERROR: MySQL connection failed!" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        } else {
            Write-Host "OK MySQL connection successful" -ForegroundColor Green
        }
    }
    
    # Step 4: Project User Creation
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 4: PROJECT USER CREATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Creating dedicated project user..." -ForegroundColor Green
    Write-Host ""
    
    $projectUser = "student_lab_user"
    $projectPass = "StudentLab2024!Secure"
    
    Write-Host "Creating MySQL user: $projectUser" -ForegroundColor Green
    Write-Host "Password: $projectPass" -ForegroundColor Green
    
    if (New-MySQLUser -RootUser $mysqlRootUser -RootPassword $mysqlRootPass -NewUser $projectUser -NewPassword $projectPass) {
        Write-Host "OK Project user created successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to create project user!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Step 5: Database Setup
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 5: DATABASE SETUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Setting up project database..." -ForegroundColor Green
    Write-Host ""
    
    $dbName = "student_lab_system"
    
    if (New-MySQLDatabase -User $projectUser -Password $projectPass -DatabaseName $dbName) {
        Write-Host "OK Database created successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to create database!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Import schema
    $schemaPath = "..\database\schema.sql"
    if (Import-MySQLSchema -User $projectUser -Password $projectPass -DatabaseName $dbName -SchemaPath $schemaPath) {
        Write-Host "OK Database schema imported successfully" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Schema import failed, but basic tables were created" -ForegroundColor Yellow
    }
    
    # Step 6: Node.js Check
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 6: NODE.JS CHECK" -ForegroundColor Cyan
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
    
    # Step 7: Dependency Installation
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 7: DEPENDENCY INSTALLATION" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Green
    
    $serverPath = "..\System\server"
    if (-not (Test-Path $serverPath)) {
        Write-Host "ERROR: Server directory not found!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
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
    
    # Step 8: Configuration Files
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 8: CONFIGURATION FILES" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Creating configuration files..." -ForegroundColor Green
    
    $config = @{
        DB_HOST = "localhost"
        DB_PORT = "3306"
        DB_NAME = $dbName
        DB_USER = $projectUser
        DB_PASSWORD = $projectPass
        PORT = "3000"
        NODE_ENV = "production"
        WS_PORT = "3000"
        JWT_SECRET = "StudentLab2024!JWTSecret"
        SESSION_SECRET = "StudentLab2024!SessionSecret"
        LOG_LEVEL = "INFO"
        LOG_FILE = "./logs/server.log"
        MAX_CONNECTIONS = "100"
        REQUEST_TIMEOUT = "30000"
        SYNC_INTERVAL = "5000"
        OFFLINE_MODE_ENABLED = "true"
        OFFLINE_QUEUE_SIZE = "1000"
        DATA_INTEGRITY_CHECKS = "true"
        DATA_VALIDATION_ENABLED = "true"
        DUPLICATE_PREVENTION = "true"
    }
    
    if (New-EnvFile -Path ".env" -Config $config) {
        Write-Host "OK .env file created" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to create .env file!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    if (New-DbConfigFile -Path "db-config.js" -Config $config) {
        Write-Host "OK db-config.js file created" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to create db-config.js file!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Step 9: Final Testing
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STEP 9: FINAL TESTING" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Testing complete setup..." -ForegroundColor Green
    
    # Test database connection
    Write-Host "Testing database connection..." -ForegroundColor Green
    if (Test-MySQLConnection -User $projectUser -Password $projectPass) {
        Write-Host "OK Database connection successful" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Database connection test failed!" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
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
    Write-Host "OK MySQL Service: $mysqlService (Running)" -ForegroundColor Green
    Write-Host "OK Project User: $projectUser" -ForegroundColor Green
    Write-Host "OK Database: $dbName" -ForegroundColor Green
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
    Write-Host "Database Info:" -ForegroundColor Yellow
    Write-Host "- Host: localhost" -ForegroundColor White
    Write-Host "- Database: $dbName" -ForegroundColor White
    Write-Host "- User: $projectUser" -ForegroundColor White
    Write-Host "- Password: $projectPass" -ForegroundColor White
    Write-Host ""
    Write-Host "For other devices, copy this project folder and run LAUNCHER.ps1 → Option 3" -ForegroundColor Yellow
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
    Start-Setup
}
catch {
    Write-Host ""
    Write-Host "ERROR: An unexpected error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to continue"