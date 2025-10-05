# Student Lab System - Server Cleanup (PowerShell)
# Enhanced version with comprehensive server stopping and port cleanup

param(
    [switch]$Help,
    [switch]$Force
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "Student Lab System - Server Cleanup"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Red"
Clear-Host

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - SERVER CLEANUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\STOP.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help    Show this help message" -ForegroundColor White
    Write-Host "  -Force   Skip confirmation prompts" -ForegroundColor White
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  ✓ Stop all Node.js processes" -ForegroundColor White
    Write-Host "  ✓ Kill processes using ports 3000, 3443, 3001, 3444" -ForegroundColor White
    Write-Host "  ✓ Verify all ports are free" -ForegroundColor White
    Write-Host "  ✓ Clean up any remaining processes" -ForegroundColor White
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

# Function to kill processes on specific port
function Stop-ProcessOnPort {
    param([int]$Port)
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($connection in $connections) {
                $processId = $connection.OwningProcess
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process) {
                    Write-Status "Stopping process on port $Port (PID: $processId, Name: $($process.ProcessName))"
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    Write-Success "Process on port $Port stopped (PID: $processId)"
                }
            }
        } else {
            Write-Status "No processes found on port $Port"
        }
    }
    catch {
        Write-Warning "Could not check port $Port : $($_.Exception.Message)"
    }
}

# Function to check if port is free
function Test-PortFree {
    param([int]$Port)
    
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return $connections -eq $null
    }
    catch {
        return $true
    }
}

# Main execution function
function Start-ServerCleanup {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - SERVER CLEANUP" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if user wants to proceed
    if (-not (Get-UserConfirmation "Stop all servers and clean up ports?")) {
        Write-Host "Cleanup operation cancelled." -ForegroundColor Yellow
        return
    }
    
    Write-Host ""
    Write-Host "Stopping servers using ports 3000, 3443, 3001, and 3444..." -ForegroundColor Yellow
    Write-Host ""
    
    # Step 1: Stop Node.js processes
    Write-Host "[1/4] Stopping Node.js processes..." -ForegroundColor Blue
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcesses) {
        foreach ($process in $nodeProcesses) {
            Write-Status "Stopping Node.js process (PID: $($process.Id))"
            try {
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
                Write-Success "Node.js process stopped (PID: $($process.Id))"
            }
            catch {
                Write-Warning "Could not stop Node.js process (PID: $($process.Id))"
            }
        }
    } else {
        Write-Status "No Node.js processes found"
    }
    
    # Step 2: Stop processes on port 3000
    Write-Host ""
    Write-Host "[2/4] Stopping processes on port 3000..." -ForegroundColor Blue
    Stop-ProcessOnPort -Port 3000
    
    # Step 3: Stop processes on port 3443
    Write-Host ""
    Write-Host "[3/4] Stopping processes on port 3443..." -ForegroundColor Blue
    Stop-ProcessOnPort -Port 3443
    
    # Step 4: Stop processes on WebSocket ports
    Write-Host ""
    Write-Host "[4/4] Stopping processes on WebSocket ports..." -ForegroundColor Blue
    Stop-ProcessOnPort -Port 3001
    Stop-ProcessOnPort -Port 3444
    
    # Wait for ports to be released
    Write-Host ""
    Write-Status "Waiting 3 seconds for ports to be released..."
    Start-Sleep -Seconds 3
    
    # Check port status
    Write-Host ""
    Write-Status "Checking port status..."
    $portsInUse = @()
    
    if (-not (Test-PortFree -Port 3000)) { $portsInUse += "3000" }
    if (-not (Test-PortFree -Port 3443)) { $portsInUse += "3443" }
    if (-not (Test-PortFree -Port 3001)) { $portsInUse += "3001" }
    if (-not (Test-PortFree -Port 3444)) { $portsInUse += "3444" }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    if ($portsInUse.Count -eq 0) {
        Write-Host "   SERVER CLEANUP COMPLETED!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Success "All servers stopped successfully"
        Write-Success "Ports 3000, 3443, 3001, and 3444 are now free"
        Write-Success "System is ready for restart"
    } else {
        Write-Host "   CLEANUP COMPLETED WITH WARNINGS" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Warning "Some ports may still be in use: $($portsInUse -join ', ')"
        Write-Warning "You may need to wait a moment before starting the server"
        Write-Warning "Or restart your computer if the issue persists"
    }
    
    Write-Host ""
    Write-Host "You can now run the START script to restart the system" -ForegroundColor Green
    Write-Host ""
}

# Handle help parameter
if ($Help) {
    Show-Help
    exit 0
}

# Start server cleanup
try {
    Start-ServerCleanup
}
catch {
    Write-Host ""
    Write-Error "An unexpected error occurred: $($_.Exception.Message)"
    Read-Host "Press Enter to exit"
    exit 1
}