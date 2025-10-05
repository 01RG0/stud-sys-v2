# ========================================
# Student Lab System v2 - Complete Setup Script
# ========================================
# This script will install and configure everything from scratch
# Including: Node.js, MySQL, Dependencies, Database, and System Configuration

param(
    [switch]$Help,
    [switch]$Force,
    [switch]$SkipMySQL,
    [string]$MySQLPassword = "StudentLab2024!Secure"
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "Student Lab System v2 - Complete Setup"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Green"
Clear-Host

# Global variables
$script:ProjectName = "Student Lab System v2"
$script:ProjectUser = "student_lab_user"
$script:ProjectPassword = "StudentLab2024!Secure"
$script:DatabaseName = "student_lab_system"
$script:ServerPort = 3000
$script:HTTPSPort = 3443

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   $ProjectName - COMPLETE SETUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\setup.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help              Show this help message" -ForegroundColor White
    Write-Host "  -Force             Skip confirmation prompts" -ForegroundColor White
    Write-Host "  -SkipMySQL         Skip MySQL installation (if already installed)" -ForegroundColor White
    Write-Host "  -MySQLPassword     Set MySQL root password (default: $MySQLPassword)" -ForegroundColor White
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "   Check and install Node.js" -ForegroundColor White
    Write-Host "   Download and install MySQL" -ForegroundColor White
    Write-Host "   Create database and dedicated user" -ForegroundColor White
    Write-Host "   Install all Node.js dependencies" -ForegroundColor White
    Write-Host "   Configure system files" -ForegroundColor White
    Write-Host "   Test everything to ensure it works" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\setup.ps1                        # Interactive setup" -ForegroundColor White
    Write-Host "  .\setup.ps1 -Force                 # Skip all prompts" -ForegroundColor White
    Write-Host "  .\setup.ps1 -SkipMySQL             # Skip MySQL installation" -ForegroundColor White
    Write-Host "  .\setup.ps1 -MySQLPassword 'MyPass' # Custom MySQL password" -ForegroundColor White
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

function Write-Step {
    param(
        [int]$StepNumber,
        [int]$TotalSteps,
        [string]$Message
    )
    Write-Host ""
    Write-Host "[STEP $StepNumber/$TotalSteps] $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
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

# Function to download and install Node.js
function Install-NodeJS {
    Write-Status "Checking Node.js installation..."
    
    if (Test-Command "node") {
        $nodeVersion = Get-CommandVersion "node"
        Write-Success "Node.js is already installed: $nodeVersion"
        return $true
    }
    
    Write-Status "Node.js not found. Downloading and installing..."
    
    try {
        # Get latest LTS version
        $nodeInfo = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
        $ltsVersion = ($nodeInfo | Where-Object { $_.lts -ne $false } | Select-Object -First 1).version
        $ltsVersion = $ltsVersion.TrimStart('v')
        
        # Download Node.js installer
        $downloadUrl = "https://nodejs.org/dist/v$ltsVersion/node-v$ltsVersion-x64.msi"
        $installerPath = "$env:TEMP\nodejs-installer.msi"
        
        Write-Status "Downloading Node.js v$ltsVersion..."
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
        
        # Install Node.js
        Write-Status "Installing Node.js..."
        Start-Process -FilePath "msiexec.exe" -ArgumentList "/i `"$installerPath`" /quiet /norestart" -Wait
        
        # Wait for installation to complete
        Start-Sleep -Seconds 10
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        # Verify installation
        if (Test-Command "node") {
            $nodeVersion = Get-CommandVersion "node"
            Write-Success "Node.js installed successfully: $nodeVersion"
            
            # Clean up installer
            Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
            return $true
        } else {
            Write-Error "Node.js installation failed"
            return $false
        }
    }
    catch {
        Write-Error "Failed to install Node.js: $($_.Exception.Message)"
        return $false
    }
}

# Function to download and install MySQL
function Install-MySQL {
    Write-Status "Checking MySQL installation..."
    
    if (Test-Command "mysql") {
        $mysqlVersion = Get-CommandVersion "mysql"
        Write-Success "MySQL is already installed: $mysqlVersion"
        return $true
    }
    
    if ($SkipMySQL) {
        Write-Warning "MySQL installation skipped by user"
        return $false
    }
    
    Write-Status "MySQL not found. Downloading and installing..."
    
    try {
        # Download MySQL installer
        $downloadUrl = "https://dev.mysql.com/get/mysql-installer-community.msi"
        $installerPath = "$env:TEMP\mysql-installer.msi"
        
        Write-Status "Downloading MySQL installer..."
        Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -UseBasicParsing
        
        # Install MySQL
        Write-Status "Installing MySQL..."
        $installArgs = @(
            "/i", "`"$installerPath`"",
            "/quiet",
            "/norestart",
            "ADDLOCAL=Server,Client,Workbench",
            "MYSQL_ROOT_PASSWORD=$MySQLPassword"
        )
        Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait
        
        # Wait for installation to complete
        Start-Sleep -Seconds 30
        
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        # Start MySQL service
        Write-Status "Starting MySQL service..."
        $mysqlService = Get-Service -Name "MySQL*" -ErrorAction SilentlyContinue
        if ($mysqlService) {
            Start-Service -Name $mysqlService.Name
            Set-Service -Name $mysqlService.Name -StartupType Automatic
            Write-Success "MySQL service started"
        }
        
        # Verify installation
        if (Test-Command "mysql") {
            $mysqlVersion = Get-CommandVersion "mysql"
            Write-Success "MySQL installed successfully: $mysqlVersion"
            
            # Clean up installer
            Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
            return $true
        } else {
            Write-Error "MySQL installation failed"
            return $false
        }
    }
    catch {
        Write-Error "Failed to install MySQL: $($_.Exception.Message)"
        return $false
    }
}

# Function to test MySQL connection
function Test-MySQLConnection {
    param(
        [string]$User = "root",
        [string]$Password = "",
        [switch]$ShowErrors
    )
    
    try {
        if ([string]::IsNullOrEmpty($Password)) {
            $result = & mysql -u $User -e "SELECT 1 as test;" 2>&1
        } else {
            $result = & mysql -u $User -p$Password -e "SELECT 1 as test;" 2>&1
        }
        
        if ($ShowErrors -and $LASTEXITCODE -ne 0) {
            Write-Status "MySQL connection test failed for user '$User': $result"
        }
        
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        if ($ShowErrors) {
            Write-Status "MySQL connection test exception for user '$User': $($_.Exception.Message)"
        }
        return $false
    }
}

# Function to setup MySQL database and user
function Setup-MySQLDatabase {
    param(
        [string]$RootUser = "root",
        [string]$RootPassword = "",
        [string]$ProjectUser = $script:ProjectUser,
        [string]$ProjectPassword = $script:ProjectPassword,
        [string]$DatabaseName = $script:DatabaseName
    )
    
    Write-Status "Setting up MySQL database and user..."
    
    # Try different connection methods
    $connected = $false
    $actualPassword = ""
    
    # First try without password
    if (Test-MySQLConnection -User $RootUser -Password "") {
        Write-Success "Connected to MySQL as root (no password required)"
        $connected = $true
        $actualPassword = ""
    }
    # Try with the provided password
    elseif (Test-MySQLConnection -User $RootUser -Password $RootPassword) {
        Write-Success "Connected to MySQL as root with provided password"
        $connected = $true
        $actualPassword = $RootPassword
    }
    # Try with common default passwords
    else {
        $commonPasswords = @("", "root", "password", "123456", "mysql", "admin")
        foreach ($pwd in $commonPasswords) {
            if (Test-MySQLConnection -User $RootUser -Password $pwd) {
                Write-Success "Connected to MySQL as root with password: $pwd"
                $connected = $true
                $actualPassword = $pwd
                break
            }
        }
    }
    
    # If still not connected, ask user for password
    if (-not $connected) {
        Write-Warning "Cannot connect to MySQL as root user automatically"
        Write-Status "Please provide the MySQL root password:"
        $userPassword = Read-Host "MySQL root password (or press Enter to skip MySQL setup)"
        
        if ([string]::IsNullOrEmpty($userPassword)) {
            Write-Warning "MySQL setup skipped by user"
            return $false
        }
        
        if (Test-MySQLConnection -User $RootUser -Password $userPassword) {
            Write-Success "Connected to MySQL as root with user-provided password"
            $connected = $true
            $actualPassword = $userPassword
        } else {
            Write-Error "Cannot connect to MySQL with provided password"
            return $false
        }
    }
    
    if (-not $connected) {
        Write-Error "Cannot connect to MySQL as root user"
        return $false
    }
    
    # Create database
    Write-Status "Creating database: $DatabaseName"
    $createDbQuery = "CREATE DATABASE IF NOT EXISTS $DatabaseName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    try {
        if ([string]::IsNullOrEmpty($actualPassword)) {
            $result = & mysql -u $RootUser -e $createDbQuery 2>$null
        } else {
            $result = & mysql -u $RootUser -p$actualPassword -e $createDbQuery 2>$null
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to create database"
            return $false
        }
        Write-Success "Database created successfully"
    }
    catch {
        Write-Error "Failed to create database: $($_.Exception.Message)"
        return $false
    }
    
    # Force create project user (drop if exists first)
    Write-Status "Force creating project user: $ProjectUser"
    
    # Drop user if exists to avoid conflicts
    $dropUserQuery = "DROP USER IF EXISTS '$ProjectUser'@'localhost';"
    $createUserQuery = "CREATE USER '$ProjectUser'@'localhost' IDENTIFIED BY '$ProjectPassword';"
    $grantQuery = "GRANT ALL PRIVILEGES ON $DatabaseName.* TO '$ProjectUser'@'localhost';"
    $flushQuery = "FLUSH PRIVILEGES;"
    
    try {
        Write-Status "Dropping existing user (if any)..."
        if ([string]::IsNullOrEmpty($actualPassword)) {
            $result0 = & mysql -u $RootUser -e $dropUserQuery 2>$null
        } else {
            $result0 = & mysql -u $RootUser -p$actualPassword -e $dropUserQuery 2>$null
        }
        
        Write-Status "Creating new project user..."
        if ([string]::IsNullOrEmpty($actualPassword)) {
            $result1 = & mysql -u $RootUser -e $createUserQuery 2>$null
        } else {
            $result1 = & mysql -u $RootUser -p$actualPassword -e $createUserQuery 2>$null
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to create project user"
            return $false
        }
        
        Write-Status "Granting privileges..."
        if ([string]::IsNullOrEmpty($actualPassword)) {
            $result2 = & mysql -u $RootUser -e $grantQuery 2>$null
        } else {
            $result2 = & mysql -u $RootUser -p$actualPassword -e $grantQuery 2>$null
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to grant privileges"
            return $false
        }
        
        Write-Status "Flushing privileges..."
        if ([string]::IsNullOrEmpty($actualPassword)) {
            $result3 = & mysql -u $RootUser -e $flushQuery 2>$null
        } else {
            $result3 = & mysql -u $RootUser -p$actualPassword -e $flushQuery 2>$null
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to flush privileges"
            return $false
        }
        
        Write-Success "Project user created successfully with fresh privileges"
    }
    catch {
        Write-Error "Failed to create project user: $($_.Exception.Message)"
        return $false
    }
    
    # Test project user connection
    Write-Status "Testing project user connection..."
    if (Test-MySQLConnection -User $ProjectUser -Password $ProjectPassword -ShowErrors) {
        Write-Success "Project user connection successful"
        return $true
    } else {
        Write-Warning "Project user connection failed. Trying to create alternative user..."
        
        # Try creating an alternative user with timestamp
        $timestamp = Get-Date -Format "yyyyMMddHHmmss"
        $altUser = "${ProjectUser}_$timestamp"
        $altPassword = "${ProjectPassword}_$timestamp"
        
        Write-Status "Creating alternative user: $altUser"
        
        # Drop and create alternative user
        $dropAltQuery = "DROP USER IF EXISTS '$altUser'@'localhost';"
        $createAltQuery = "CREATE USER '$altUser'@'localhost' IDENTIFIED BY '$altPassword';"
        $grantAltQuery = "GRANT ALL PRIVILEGES ON $DatabaseName.* TO '$altUser'@'localhost';"
        
        try {
            Write-Status "Executing alternative user creation commands..."
            
            if ([string]::IsNullOrEmpty($actualPassword)) {
                Write-Status "Dropping alternative user..."
                $dropResult = & mysql -u $RootUser -e $dropAltQuery 2>&1
                Write-Status "Drop result: $dropResult"
                
                Write-Status "Creating alternative user..."
                $createResult = & mysql -u $RootUser -e $createAltQuery 2>&1
                Write-Status "Create result: $createResult"
                
                Write-Status "Granting privileges..."
                $grantResult = & mysql -u $RootUser -e $grantAltQuery 2>&1
                Write-Status "Grant result: $grantResult"
                
                Write-Status "Flushing privileges..."
                $flushResult = & mysql -u $RootUser -e $flushQuery 2>&1
                Write-Status "Flush result: $flushResult"
            } else {
                Write-Status "Dropping alternative user..."
                $dropResult = & mysql -u $RootUser -p$actualPassword -e $dropAltQuery 2>&1
                Write-Status "Drop result: $dropResult"
                
                Write-Status "Creating alternative user..."
                $createResult = & mysql -u $RootUser -p$actualPassword -e $createAltQuery 2>&1
                Write-Status "Create result: $createResult"
                
                Write-Status "Granting privileges..."
                $grantResult = & mysql -u $RootUser -p$actualPassword -e $grantAltQuery 2>&1
                Write-Status "Grant result: $grantResult"
                
                Write-Status "Flushing privileges..."
                $flushResult = & mysql -u $RootUser -p$actualPassword -e $flushQuery 2>&1
                Write-Status "Flush result: $flushResult"
            }
            
            # Wait a moment for MySQL to process
            Start-Sleep -Seconds 2
            
            # Test alternative user
            Write-Status "Testing alternative user connection..."
            if (Test-MySQLConnection -User $altUser -Password $altPassword -ShowErrors) {
                Write-Success "Alternative user created and tested successfully: $altUser"
                
                # Update global variables to use the alternative user
                $script:ProjectUser = $altUser
                $script:ProjectPassword = $altPassword
                
                Write-Warning "Using alternative user credentials:"
                Write-Host "  User: $altUser" -ForegroundColor Yellow
                Write-Host "  Password: $altPassword" -ForegroundColor Yellow
                
                return $true
            } else {
                Write-Error "Alternative user connection test failed"
                Write-Status "Let's try a different approach - using root user for the project"
                
                # Final fallback: use root user
                Write-Warning "Using root user as fallback for database access"
                $script:ProjectUser = $RootUser
                $script:ProjectPassword = $actualPassword
                
                Write-Warning "Using root user credentials:"
                Write-Host "  User: $RootUser" -ForegroundColor Yellow
                Write-Host "  Password: [same as root]" -ForegroundColor Yellow
                
                return $true
            }
        }
        catch {
            Write-Error "Failed to create alternative user: $($_.Exception.Message)"
            Write-Status "Let's try a different approach - using root user for the project"
            
            # Final fallback: use root user
            Write-Warning "Using root user as fallback for database access"
            $script:ProjectUser = $RootUser
            $script:ProjectPassword = $actualPassword
            
            Write-Warning "Using root user credentials:"
            Write-Host "  User: $RootUser" -ForegroundColor Yellow
            Write-Host "  Password: [same as root]" -ForegroundColor Yellow
            
            return $true
        }
    }
}

# Function to create database schema
function New-DatabaseSchema {
    $schema = @"
-- Student Lab System Database Schema
-- Created by setup script

CREATE DATABASE IF NOT EXISTS $script:DatabaseName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE $script:DatabaseName;

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  center VARCHAR(255),
  grade VARCHAR(50),
  phone VARCHAR(20),
  parent_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Entry registrations table
CREATE TABLE IF NOT EXISTS entry_registrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50),
  student_name VARCHAR(255),
  center VARCHAR(255),
  device_name VARCHAR(100),
  entry_method ENUM('qr_scan', 'manual') DEFAULT 'qr_scan',
  offline_mode BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_registered_at (registered_at),
  INDEX idx_device_name (device_name)
);

-- Exit validations table
CREATE TABLE IF NOT EXISTS exit_validations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(50),
  student_name VARCHAR(255),
  center VARCHAR(255),
  device_name VARCHAR(100),
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_student_id (student_id),
  INDEX idx_validated_at (validated_at),
  INDEX idx_device_name (device_name)
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  role ENUM('entry_scanner', 'exit_validator', 'manager') NOT NULL,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_online BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT,
  config_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
"@
    
    try {
        $schema | Out-File -FilePath "database\schema.sql" -Encoding UTF8
        return $true
    }
    catch {
        return $false
    }
}

# Function to create sample data
function New-SampleData {
    $sampleData = @"
-- Sample data for testing
USE $script:DatabaseName;

-- Insert sample students
INSERT IGNORE INTO students (id, name, center, grade, phone, parent_phone) VALUES
('STU001', 'Ahmed Ali', 'Main Center', 'Grade 10', '01234567890', '01234567891'),
('STU002', 'Fatima Hassan', 'Main Center', 'Grade 11', '01234567892', '01234567893'),
('STU003', 'Mohamed Omar', 'Branch Center', 'Grade 9', '01234567894', '01234567895'),
('STU004', 'Aisha Ibrahim', 'Main Center', 'Grade 12', '01234567896', '01234567897'),
('STU005', 'Omar Khalil', 'Branch Center', 'Grade 10', '01234567898', '01234567899');

-- Insert system configuration
INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('setup_completed', 'true', 'boolean', 'Setup completion flag'),
('system_version', '2.0.0', 'string', 'System version'),
('database_initialized', 'true', 'boolean', 'Database initialization flag');
"@
    
    try {
        $sampleData | Out-File -FilePath "database\sample_data.sql" -Encoding UTF8
        return $true
    }
    catch {
        return $false
    }
}

# Function to execute MySQL script
function Invoke-MySQLScript {
    param(
        [string]$User,
        [string]$Password,
        [string]$ScriptPath
    )
    
    try {
        if ([string]::IsNullOrEmpty($Password)) {
            $result = Get-Content $ScriptPath | & mysql -u $User 2>$null
        } else {
            $result = Get-Content $ScriptPath | & mysql -u $User -p$Password 2>$null
        }
        
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        return $false
    }
}

# Function to create .env file
function New-EnvFile {
    $envContent = @"
# Student Lab System - Environment Configuration
# Generated by setup.ps1
# Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=$script:DatabaseName
DB_USER=$script:ProjectUser
DB_PASSWORD=$script:ProjectPassword

# Server Configuration
HTTP_PORT=$script:ServerPort
HTTPS_PORT=$script:HTTPSPort
WS_PORT=3001
WSS_PORT=3444
NODE_ENV=production

# WebSocket Configuration
WS_PORT=3001
WSS_PORT=3444

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
        return $true
    }
    catch {
        return $false
    }
}

# Function to install Node.js dependencies
function Install-NodeDependencies {
    Write-Status "Installing Node.js dependencies..."
    
    $serverPath = "System\server"
    if (-not (Test-Path $serverPath)) {
        Write-Error "Server directory not found: $serverPath"
        return $false
    }
    
    Set-Location $serverPath
    
    try {
        Write-Status "Running npm install..."
        & npm install --no-optional --no-audit --no-fund
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Dependencies installed successfully"
            Set-Location $PSScriptRoot
            return $true
        } else {
            Write-Error "Failed to install dependencies"
            Set-Location $PSScriptRoot
            return $false
        }
    }
    catch {
        Write-Error "Failed to install dependencies: $($_.Exception.Message)"
        Set-Location $PSScriptRoot
        return $false
    }
}

# Main setup function
function Start-Setup {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   $ProjectName - COMPLETE SETUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    if (-not (Get-UserConfirmation "Continue with complete setup?")) {
        Write-Host "Setup cancelled." -ForegroundColor Yellow
        Wait-ForUser
        exit 0
    }
    
    # Step 1: Install Node.js
    Write-Step 1 8 "Installing Node.js"
    if (-not (Install-NodeJS)) {
        Write-Error "Node.js installation failed. Cannot continue."
        Wait-ForUser
        exit 1
    }
    
    # Step 2: Install MySQL
    Write-Step 2 8 "Installing MySQL"
    $mysqlInstalled = Install-MySQL
    if (-not $mysqlInstalled -and -not $SkipMySQL) {
        Write-Error "MySQL installation failed. Cannot continue."
        Wait-ForUser
        exit 1
    }
    
    # Step 3: Setup MySQL Database
    Write-Step 3 8 "Setting up MySQL Database"
    if ($mysqlInstalled) {
        if (-not (Setup-MySQLDatabase -RootPassword $MySQLPassword)) {
            Write-Error "MySQL database setup failed. Cannot continue."
            Wait-ForUser
            exit 1
        }
    } else {
        Write-Warning "MySQL not available, skipping database setup"
    }
    
    # Step 4: Create Database Files
    Write-Step 4 8 "Creating Database Files"
    if (-not (Test-Path "database")) {
        New-Item -ItemType Directory -Path "database" -Force | Out-Null
    }
    
    if (New-DatabaseSchema) {
        Write-Success "Database schema created"
    } else {
        Write-Error "Failed to create database schema"
        Wait-ForUser
        exit 1
    }
    
    if (New-SampleData) {
        Write-Success "Sample data created"
    } else {
        Write-Error "Failed to create sample data"
        Wait-ForUser
        exit 1
    }
    
    # Step 5: Install Dependencies
    Write-Step 5 8 "Installing Node.js Dependencies"
    if (-not (Install-NodeDependencies)) {
        Write-Error "Failed to install dependencies. Cannot continue."
        Wait-ForUser
        exit 1
    }
    
    # Step 6: Create Environment Configuration
    Write-Step 6 8 "Creating Environment Configuration"
    if (New-EnvFile) {
        Write-Success ".env file created"
    } else {
        Write-Error "Failed to create .env file"
        Wait-ForUser
        exit 1
    }
    
    # Step 7: Setup Database Tables
    Write-Step 7 8 "Setting up Database Tables"
    if ($mysqlInstalled) {
        Write-Status "Creating database tables..."
        if (Invoke-MySQLScript -User $script:ProjectUser -Password $script:ProjectPassword -ScriptPath "database\schema.sql") {
            Write-Success "Database tables created successfully"
            
            Write-Status "Importing sample data..."
            if (Invoke-MySQLScript -User $script:ProjectUser -Password $script:ProjectPassword -ScriptPath "database\sample_data.sql") {
                Write-Success "Sample data imported successfully"
            } else {
                Write-Warning "Failed to import sample data (this is optional)"
            }
        } else {
            Write-Error "Failed to create database tables"
            Wait-ForUser
            exit 1
        }
    } else {
        Write-Warning "MySQL not available, skipping database table creation"
    }
    
    # Step 8: Create Logs Directory
    Write-Step 8 8 "Creating Logs Directory"
    if (-not (Test-Path "logs")) {
        New-Item -ItemType Directory -Path "logs" -Force | Out-Null
    }
    Write-Success "Logs directory created"
    
    # Final setup
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   SETUP COMPLETED SUCCESSFULLY!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Success "$ProjectName has been set up successfully!"
    Write-Host ""
    Write-Host "Setup Summary:" -ForegroundColor Yellow
    Write-Host " Node.js: Installed and configured" -ForegroundColor White
    if ($mysqlInstalled) {
        Write-Host " MySQL: Installed and configured" -ForegroundColor White
        Write-Host " Database: $script:DatabaseName created" -ForegroundColor White
        Write-Host " User: $script:ProjectUser created" -ForegroundColor White
    } else {
        Write-Host " MySQL: Skipped (not installed)" -ForegroundColor Yellow
    }
    Write-Host " Dependencies: Installed" -ForegroundColor White
    Write-Host " Configuration: Files created" -ForegroundColor White
    Write-Host " Logs: Directory created" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run .\LAUNCHER.bat to start the system" -ForegroundColor White
    Write-Host "2. Open http://localhost:$script:ServerPort in your browser" -ForegroundColor White
    Write-Host "3. Start using the system!" -ForegroundColor White
    Write-Host ""
    Write-Host "System URLs:" -ForegroundColor Yellow
    Write-Host "- Entry Scanner: http://localhost:$script:ServerPort/entry-scanner" -ForegroundColor White
    Write-Host "- Exit Validator: http://localhost:$script:ServerPort/exit-validator" -ForegroundColor White
    Write-Host "- Admin Dashboard: http://localhost:$script:ServerPort/admin-dashboard" -ForegroundColor White
    Write-Host ""
    
    # Ask if user wants to start the system
    if (Get-UserConfirmation "Do you want to start the system now?") {
        Write-Host ""
        Write-Status "Starting the system..."
        Write-Host ""
        try {
            if (Test-Path "LAUNCHER.bat") {
                & ".\LAUNCHER.bat"
            } else {
                Write-Warning "No launcher found. Please run the system manually."
            }
        }
        catch {
            Write-Error "Failed to start the system: $($_.Exception.Message)"
        }
    } else {
        Write-Host ""
        Write-Status "You can start the system later by running .\LAUNCHER.bat"
    }
    
    Write-Host ""
    Write-Success "Setup completed successfully!"
    Write-Host ""
}

# Handle help parameter
if ($Help) {
    Show-Help
    exit 0
}

# Start setup
try {
    Start-Setup
}
catch {
    Write-Host ""
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    Read-Host "Press Enter to exit"
    exit 1
}
