# Student Lab System - Server Control (PowerShell)
# Enhanced version with better error handling and cross-platform support

param(
    [switch]$Help,
    [switch]$Start,
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Status,
    [switch]$Logs,
    [switch]$KillAll
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "Student Lab System - Server Control"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Red"
Clear-Host

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - SERVER CONTROL" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\SERVERS.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help     Show this help message" -ForegroundColor White
    Write-Host "  -Start    Start the server" -ForegroundColor White
    Write-Host "  -Stop     Stop all servers" -ForegroundColor White
    Write-Host "  -Restart  Restart the server" -ForegroundColor White
    Write-Host "  -Status   Check server status" -ForegroundColor White
    Write-Host "  -Logs     View server logs" -ForegroundColor White
    Write-Host "  -KillAll  Kill all Node.js processes" -ForegroundColor White
    Write-Host ""
    Write-Host "Interactive Mode:" -ForegroundColor Yellow
    Write-Host "  Run without parameters to enter interactive menu" -ForegroundColor White
    Write-Host ""
}

# Function to display main menu
function Show-MainMenu {
    Clear-Host
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - SERVER CONTROL" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please select an action:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "[1] Start Server" -ForegroundColor White
    Write-Host "[2] Stop All Servers" -ForegroundColor White
    Write-Host "[3] Restart Server" -ForegroundColor White
    Write-Host "[4] Check Server Status" -ForegroundColor White
    Write-Host "[5] View Server Logs" -ForegroundColor White
    Write-Host "[6] Kill All Node Processes" -ForegroundColor White
    Write-Host "[7] Exit" -ForegroundColor White
    Write-Host ""
}

# Function to get user choice
function Get-UserChoice {
    $choice = Read-Host "Enter your choice (1-7)"
    
    if ([string]::IsNullOrEmpty($choice)) {
        Write-Host ""
        Write-Host "No input received. Returning to menu..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        return $null
    }
    
    return $choice
}

# Function to check if port is in use
function Test-PortInUse {
    param([int]$Port)
    
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        return $connection -ne $null
    }
    catch {
        return $false
    }
}

# Function to get Node.js processes
function Get-NodeProcesses {
    try {
        return Get-Process -Name "node" -ErrorAction SilentlyContinue
    }
    catch {
        return @()
    }
}

# Function to start server
function Start-Server {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STARTING SERVER" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Starting Student Lab System server..." -ForegroundColor Green
    Write-Host ""
    
    $serverPath = "..\System\server"
    if (-not (Test-Path $serverPath)) {
        Write-Host "ERROR: Server directory not found!" -ForegroundColor Red
        Read-Host "Press Enter to continue"
        return
    }
    
    Set-Location $serverPath
    
    # Check if server files exist
    if (-not (Test-Path "main-server.js")) {
        Write-Host "ERROR: Server file not found: main-server.js" -ForegroundColor Red
        Write-Host "Please run LAUNCHER.ps1 → Option 3 (Complete Setup) first" -ForegroundColor Yellow
        Read-Host "Press Enter to continue"
        return
    }
    
    # Check if dependencies are installed
    if (-not (Test-Path "node_modules")) {
        Write-Host "ERROR: Dependencies not installed" -ForegroundColor Red
        Write-Host "Please run LAUNCHER.ps1 → Option 4 (Package Manager) first" -ForegroundColor Yellow
        Read-Host "Press Enter to continue"
        return
    }
    
    # Check if configuration files exist
    if (-not (Test-Path ".env")) {
        Write-Host "ERROR: Configuration file not found: .env" -ForegroundColor Red
        Write-Host "Please run LAUNCHER.ps1 → Option 3 (Complete Setup) first" -ForegroundColor Yellow
        Read-Host "Press Enter to continue"
        return
    }
    
    # Check if server is already running
    if (Test-PortInUse -Port 3000) {
        Write-Host "WARNING: Server may already be running on port 3000" -ForegroundColor Yellow
        $nodeProcesses = Get-NodeProcesses
        if ($nodeProcesses.Count -gt 0) {
            Write-Host "Found existing Node.js processes:" -ForegroundColor Yellow
            $nodeProcesses | Format-Table -AutoSize
            Write-Host ""
            $killExisting = Read-Host "Kill existing processes and start new server? (y/n)"
            if ($killExisting -eq "y" -or $killExisting -eq "Y") {
                Write-Host "Stopping existing processes..." -ForegroundColor Green
                $nodeProcesses | Stop-Process -Force
                Start-Sleep -Seconds 2
            } else {
                Write-Host "Server start cancelled" -ForegroundColor Yellow
                Read-Host "Press Enter to continue"
                return
            }
        }
    }
    
    Write-Host "Starting server..." -ForegroundColor Green
    Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    
    try {
        # Start the server
        node main-server.js
    }
    catch {
        Write-Host "ERROR: Failed to start server: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Server stopped" -ForegroundColor Yellow
    Read-Host "Press Enter to continue"
}

# Function to stop servers
function Stop-Servers {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STOPPING ALL SERVERS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Stopping all servers and processes..." -ForegroundColor Green
    Write-Host ""
    
    # First, try graceful shutdown by sending SIGINT to Node.js processes
    Write-Host "Attempting graceful shutdown..." -ForegroundColor Green
    $nodeProcesses = Get-NodeProcesses
    if ($nodeProcesses.Count -gt 0) {
        Write-Host "Found Node.js processes, sending shutdown signal..." -ForegroundColor Green
        foreach ($process in $nodeProcesses) {
            Write-Host "Sending SIGINT to process $($process.Id)..." -ForegroundColor Green
            try {
                $process.CloseMainWindow()
            }
            catch {
                # If CloseMainWindow fails, try to stop the process
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
        Write-Host "Waiting for graceful shutdown..." -ForegroundColor Green
        Start-Sleep -Seconds 3
    }
    
    # Check if processes are still running
    $remainingProcesses = Get-NodeProcesses
    if ($remainingProcesses.Count -gt 0) {
        Write-Host "WARNING: Processes still running, forcing shutdown..." -ForegroundColor Yellow
        $remainingProcesses | Format-Table -AutoSize
        Write-Host ""
        $remainingProcesses | Stop-Process -Force
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK Node.js processes force-stopped" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to stop Node.js processes" -ForegroundColor Red
        }
    } else {
        Write-Host "OK All Node.js processes stopped gracefully" -ForegroundColor Green
    }
    
    # Stop MySQL service (optional)
    Write-Host ""
    $stopMysql = Read-Host "Stop MySQL service? (y/n)"
    if ($stopMysql -eq "y" -or $stopMysql -eq "Y") {
        Write-Host "Stopping MySQL service..." -ForegroundColor Green
        $mysqlServices = @("mysql", "mysql80", "mysql57")
        $mysqlService = $null
        
        foreach ($serviceName in $mysqlServices) {
            try {
                $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
                if ($service) {
                    $mysqlService = $serviceName
                    break
                }
            }
            catch {
                continue
            }
        }
        
        if ($mysqlService) {
            try {
                Stop-Service -Name $mysqlService -Force
                Write-Host "OK MySQL service stopped" -ForegroundColor Green
            }
            catch {
                Write-Host "ERROR: Failed to stop MySQL service" -ForegroundColor Red
            }
        } else {
            Write-Host "WARNING: MySQL service not found" -ForegroundColor Yellow
        }
    }
    
    # Check for other common server processes
    Write-Host ""
    Write-Host "Checking for other server processes..." -ForegroundColor Green
    if (Test-PortInUse -Port 3000) {
        Write-Host "WARNING: Port 3000 is still in use" -ForegroundColor Yellow
        Write-Host "You may need to manually stop the process using this port" -ForegroundColor Yellow
    } else {
        Write-Host "OK Port 3000 is free" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "OK All servers stopped" -ForegroundColor Green
    Read-Host "Press Enter to continue"
}

# Function to restart server
function Restart-Server {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   RESTARTING SERVER" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Restarting server..." -ForegroundColor Green
    Write-Host ""
    
    # Stop existing processes
    Write-Host "Stopping existing processes..." -ForegroundColor Green
    $nodeProcesses = Get-NodeProcesses
    if ($nodeProcesses.Count -gt 0) {
        $nodeProcesses | Stop-Process -Force
        Start-Sleep -Seconds 3
    }
    
    # Start server
    Write-Host "Starting server..." -ForegroundColor Green
    $serverPath = "..\System\server"
    Set-Location $serverPath
    
    try {
        node main-server.js
    }
    catch {
        Write-Host "ERROR: Failed to restart server: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Server restart completed" -ForegroundColor Green
    Read-Host "Press Enter to continue"
}

# Function to check server status
function Get-ServerStatus {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   SERVER STATUS CHECK" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Checking server status..." -ForegroundColor Green
    Write-Host ""
    
    # Check Node.js processes
    Write-Host "Checking Node.js processes..." -ForegroundColor Green
    $nodeProcesses = Get-NodeProcesses
    if ($nodeProcesses.Count -gt 0) {
        Write-Host "OK Node.js processes found:" -ForegroundColor Green
        $nodeProcesses | Format-Table -AutoSize
    } else {
        Write-Host "ERROR: No Node.js processes found" -ForegroundColor Red
    }
    
    # Check port 3000
    Write-Host ""
    Write-Host "Checking port 3000..." -ForegroundColor Green
    if (Test-PortInUse -Port 3000) {
        Write-Host "OK Port 3000 is in use" -ForegroundColor Green
        try {
            $connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
            $connections | Format-Table -AutoSize
        }
        catch {
            Write-Host "Could not get connection details" -ForegroundColor Yellow
        }
    } else {
        Write-Host "ERROR: Port 3000 is not in use" -ForegroundColor Red
    }
    
    # Check MySQL service
    Write-Host ""
    Write-Host "Checking MySQL service..." -ForegroundColor Green
    $mysqlServices = @("mysql", "mysql80", "mysql57")
    $mysqlService = $null
    
    foreach ($serviceName in $mysqlServices) {
        try {
            $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($service) {
                $mysqlService = $service
                break
            }
        }
        catch {
            continue
        }
    }
    
    if ($mysqlService) {
        if ($mysqlService.Status -eq "Running") {
            Write-Host "OK MySQL service is running" -ForegroundColor Green
        } else {
            Write-Host "ERROR: MySQL service is not running" -ForegroundColor Red
        }
    } else {
        Write-Host "ERROR: MySQL service not found" -ForegroundColor Red
    }
    
    # Check server files
    Write-Host ""
    Write-Host "Checking server files..." -ForegroundColor Green
    $serverPath = "..\System\server"
    
    if (Test-Path "$serverPath\main-server.js") {
        Write-Host "OK main-server.js exists" -ForegroundColor Green
    } else {
        Write-Host "ERROR: main-server.js not found" -ForegroundColor Red
    }
    
    if (Test-Path "$serverPath\node_modules") {
        Write-Host "OK node_modules exists" -ForegroundColor Green
    } else {
        Write-Host "ERROR: node_modules not found" -ForegroundColor Red
    }
    
    if (Test-Path "$serverPath\.env") {
        Write-Host "OK .env file exists" -ForegroundColor Green
    } else {
        Write-Host "ERROR: .env file not found" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Status check completed" -ForegroundColor Green
    Read-Host "Press Enter to continue"
}

# Function to view server logs
function Show-ServerLogs {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   VIEWING SERVER LOGS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "Server logs..." -ForegroundColor Green
    Write-Host ""
    
    $serverPath = "..\System\server"
    $logsPath = "$serverPath\logs"
    
    if (Test-Path $logsPath) {
        $logFiles = Get-ChildItem -Path $logsPath -Filter "*.log" -ErrorAction SilentlyContinue
        if ($logFiles.Count -gt 0) {
            Write-Host "Log files found:" -ForegroundColor Green
            $logFiles | Format-Table -AutoSize
            Write-Host ""
            $logFile = Read-Host "Enter log file name (or press Enter for latest)"
            
            if ([string]::IsNullOrEmpty($logFile)) {
                $latestLog = $logFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
                if ($latestLog) {
                    Write-Host "Showing latest log: $($latestLog.Name)" -ForegroundColor Green
                    Get-Content -Path $latestLog.FullName -Tail 50
                } else {
                    Write-Host "No log files found" -ForegroundColor Yellow
                }
            } else {
                $logPath = "$logsPath\$logFile"
                if (Test-Path $logPath) {
                    Get-Content -Path $logPath -Tail 50
                } else {
                    Write-Host "Log file not found: $logFile" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "No log files found in logs directory" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Logs directory not found" -ForegroundColor Yellow
        Write-Host "Logs will be created when the server runs" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Function to kill all Node.js processes
function Stop-AllNodeProcesses {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   KILL ALL NODE PROCESSES" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
    Write-Host "WARNING: This will kill ALL Node.js processes!" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "Are you sure? (y/n)"
    
    if ([string]::IsNullOrEmpty($confirm) -or ($confirm -ne "y" -and $confirm -ne "Y")) {
        Write-Host "Operation cancelled" -ForegroundColor Yellow
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-Host "Killing all Node.js processes..." -ForegroundColor Green
    $nodeProcesses = Get-NodeProcesses
    if ($nodeProcesses.Count -gt 0) {
        Write-Host "Found Node.js processes:" -ForegroundColor Green
        $nodeProcesses | Format-Table -AutoSize
        Write-Host ""
        $nodeProcesses | Stop-Process -Force
        if ($LASTEXITCODE -eq 0) {
            Write-Host "OK All Node.js processes killed" -ForegroundColor Green
        } else {
            Write-Host "ERROR: Failed to kill some processes" -ForegroundColor Red
        }
    } else {
        Write-Host "OK No Node.js processes found" -ForegroundColor Green
    }
    
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# Main execution logic
function Start-MainLoop {
    while ($true) {
        Show-MainMenu
        $choice = Get-UserChoice
        
        if ($choice -eq $null) {
            continue
        }
        
        switch ($choice) {
            "1" { Start-Server; break }
            "2" { Stop-Servers; break }
            "3" { Restart-Server; break }
            "4" { Get-ServerStatus; break }
            "5" { Show-ServerLogs; break }
            "6" { Stop-AllNodeProcesses; break }
            "7" { 
                Write-Host ""
                Write-Host "Goodbye!" -ForegroundColor Green
                exit 0
            }
            default {
                Write-Host ""
                Write-Host "ERROR: Invalid choice. Please select 1-7." -ForegroundColor Red
                Read-Host "Press any key to return to main menu"
            }
        }
    }
}

# Handle direct parameters
if ($Start) { Start-Server; exit 0 }
if ($Stop) { Stop-Servers; exit 0 }
if ($Restart) { Restart-Server; exit 0 }
if ($Status) { Get-ServerStatus; exit 0 }
if ($Logs) { Show-ServerLogs; exit 0 }
if ($KillAll) { Stop-AllNodeProcesses; exit 0 }

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

# Start main loop
try {
    Start-MainLoop
}
catch {
    Write-Host ""
    Write-Host "ERROR: An unexpected error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
