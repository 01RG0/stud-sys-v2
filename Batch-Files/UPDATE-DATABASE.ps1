# ========================================
# Student Lab System v2 - Database Update
# ========================================
# Updates existing database with offline sync functionality

param(
    [switch]$Help,
    [switch]$Force
)

# Set console colors
$Host.UI.RawUI.WindowTitle = "Student Lab System v2 - Database Update"
Clear-Host

# Function to print colored output
function Write-Status { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Blue }
function Write-Success { param([string]$Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   DATABASE UPDATE UTILITY" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\UPDATE-DATABASE.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help      Show this help message" -ForegroundColor White
    Write-Host "  -Force     Skip confirmation prompts" -ForegroundColor White
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  Update existing database with offline sync fields" -ForegroundColor White
    Write-Host "  Add new indexes for better performance" -ForegroundColor White
    Write-Host "  Update system configuration" -ForegroundColor White
    Write-Host ""
}

# Function to test MySQL connection
function Test-MySQLConnection {
    param(
        [string]$User = "root",
        [string]$Password = ""
    )
    
    try {
        if ([string]::IsNullOrEmpty($Password)) {
            $result = & mysql -u $User -e "SELECT 1 as test;" 2>$null
        } else {
            $result = & mysql -u $User -p$Password -e "SELECT 1 as test;" 2>$null
        }
        return ($LASTEXITCODE -eq 0)
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

# Main update function
function Start-DatabaseUpdate {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   DATABASE UPDATE UTILITY" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if migration script exists
    if (-not (Test-Path "database\migration_offline_sync.sql")) {
        Write-Error "Migration script not found: database\migration_offline_sync.sql"
        return $false
    }
    
    # Get MySQL credentials
    Write-Status "Testing MySQL connection..."
    
    $connected = $false
    $mysqlUser = "root"
    $mysqlPassword = ""
    
    # Try without password first
    if (Test-MySQLConnection -User $mysqlUser -Password "") {
        Write-Success "Connected to MySQL as root (no password required)"
        $connected = $true
        $mysqlPassword = ""
    }
    # Try with common passwords
    else {
        $commonPasswords = @("", "root", "password", "123456", "mysql", "admin")
        foreach ($pwd in $commonPasswords) {
            if (Test-MySQLConnection -User $mysqlUser -Password $pwd) {
                Write-Success "Connected to MySQL as root with password: $pwd"
                $connected = $true
                $mysqlPassword = $pwd
                break
            }
        }
    }
    
    # If still not connected, ask user
    if (-not $connected) {
        Write-Warning "Cannot connect to MySQL automatically"
        $userPassword = Read-Host "Enter MySQL root password (or press Enter to skip)"
        
        if ([string]::IsNullOrEmpty($userPassword)) {
            Write-Warning "Database update skipped by user"
            return $false
        }
        
        if (Test-MySQLConnection -User $mysqlUser -Password $userPassword) {
            Write-Success "Connected to MySQL with user-provided password"
            $connected = $true
            $mysqlPassword = $userPassword
        } else {
            Write-Error "Cannot connect to MySQL with provided password"
            return $false
        }
    }
    
    if (-not $connected) {
        Write-Error "Cannot connect to MySQL"
        return $false
    }
    
    # Confirm update
    if (-not $Force) {
        Write-Host ""
        Write-Warning "This will update your existing database with offline sync functionality."
        $confirm = Read-Host "Continue? (y/n)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "Update cancelled." -ForegroundColor Yellow
            return $false
        }
    }
    
    # Run migration
    Write-Status "Running database migration..."
    if (Invoke-MySQLScript -User $mysqlUser -Password $mysqlPassword -ScriptPath "database\migration_offline_sync.sql") {
        Write-Success "Database migration completed successfully"
        
        # Show migration results
        Write-Status "Migration Results:"
        try {
            if ([string]::IsNullOrEmpty($mysqlPassword)) {
                $result = & mysql -u $mysqlUser -e "USE student_lab_system; SELECT COUNT(*) as total_registrations FROM entry_registrations; SELECT COUNT(*) as offline_registrations FROM entry_registrations WHERE offline_mode = TRUE;" 2>$null
            } else {
                $result = & mysql -u $mysqlUser -p$mysqlPassword -e "USE student_lab_system; SELECT COUNT(*) as total_registrations FROM entry_registrations; SELECT COUNT(*) as offline_registrations FROM entry_registrations WHERE offline_mode = TRUE;" 2>$null
            }
            Write-Host $result
        }
        catch {
            Write-Warning "Could not retrieve migration statistics"
        }
        
        return $true
    } else {
        Write-Error "Database migration failed"
        return $false
    }
}

# Handle help parameter
if ($Help) {
    Show-Help
    exit 0
}

# Start update
try {
    if (Start-DatabaseUpdate) {
        Write-Host ""
        Write-Success "Database update completed successfully!"
        Write-Host ""
        Write-Host "Your database now supports:" -ForegroundColor Yellow
        Write-Host "  ✓ Offline sync functionality" -ForegroundColor Green
        Write-Host "  ✓ Enhanced performance indexes" -ForegroundColor Green
        Write-Host "  ✓ Updated system configuration" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now use the offline sync features!" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Error "Database update failed or was cancelled"
    }
}
catch {
    Write-Host ""
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
}

Write-Host ""
Read-Host "Press Enter to exit"
