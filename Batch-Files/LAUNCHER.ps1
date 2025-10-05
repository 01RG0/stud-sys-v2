# Student Lab System - Main Launcher (PowerShell)
# Enhanced version with better error handling and cross-platform support

param(
    [switch]$Help
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "Student Lab System - Main Launcher"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Green"
Clear-Host

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - MAIN LAUNCHER" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\LAUNCHER.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help    Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Interactive Mode:" -ForegroundColor Yellow
    Write-Host "  Run without parameters to enter interactive menu" -ForegroundColor White
    Write-Host ""
    Write-Host "Direct Execution:" -ForegroundColor Yellow
    Write-Host "  .\LAUNCHER.ps1 -Start     # Quick Start" -ForegroundColor White
    Write-Host "  .\LAUNCHER.ps1 -Stop      # Quick Stop" -ForegroundColor White
    Write-Host "  .\LAUNCHER.ps1 -Setup     # Complete Setup" -ForegroundColor White
    Write-Host "  .\LAUNCHER.ps1 -Packages  # Package Manager" -ForegroundColor White
    Write-Host "  .\LAUNCHER.ps1 -Servers   # Server Control" -ForegroundColor White
    Write-Host "  .\LAUNCHER.ps1 -SSL       # Generate SSL Certificate" -ForegroundColor White
    Write-Host ""
}

# Function to display main menu
function Show-MainMenu {
    Clear-Host
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   STUDENT LAB SYSTEM - MAIN LAUNCHER" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Welcome to Student Lab System v2" -ForegroundColor Green
    Write-Host ""
    Write-Host "Please select an option:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "[1]  Quick Start (Start Server)" -ForegroundColor White
    Write-Host "[2]  Quick Stop (Stop Server)" -ForegroundColor White
    Write-Host "[3]  Complete Setup (First Time)" -ForegroundColor White
    Write-Host "[4]  Package Manager (Install Dependencies)" -ForegroundColor White
    Write-Host "[5]  Server Control (Advanced)" -ForegroundColor White
    Write-Host "[6]  Generate SSL Certificate" -ForegroundColor White
    Write-Host "[7]  Exit" -ForegroundColor White
    Write-Host ""
}

# Function to execute PowerShell script
function Invoke-Script {
    param(
        [string]$ScriptName,
        [string]$Description
    )
    
    $scriptPath = "Batch-Files\$ScriptName.ps1"
    
    Write-Host ""
    Write-Host "$Description..." -ForegroundColor Green
    Write-Host ""
    
    if (Test-Path $scriptPath) {
        try {
            & $scriptPath
        }
        catch {
            Write-Host "ERROR: Failed to execute $ScriptName.ps1" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
            Read-Host "Press Enter to continue"
        }
    } else {
        Write-Host "ERROR: $ScriptName.ps1 not found in Batch-Files directory!" -ForegroundColor Red
        Write-Host "Please ensure all files are properly installed." -ForegroundColor Red
        Read-Host "Press Enter to continue"
    }
}

# Function to get user choice with timeout
function Get-UserChoice {
    param(
        [int]$TimeoutSeconds = 30
    )
    
    $choice = Read-Host "Enter your choice (1-7)"
    
    if ([string]::IsNullOrEmpty($choice)) {
        Write-Host ""
        Write-Host "No input received. Returning to menu..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        return $null
    }
    
    return $choice
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
            "1" {
                Write-Host ""
                Write-Host "Starting Student Lab System..." -ForegroundColor Green
                Write-Host ""
                if (Test-Path "Batch-Files\START.bat") {
                    & "Batch-Files\START.bat"
                } else {
                    Write-Host "ERROR: START.bat not found in Batch-Files directory!" -ForegroundColor Red
                    Write-Host "Please ensure all files are properly installed." -ForegroundColor Yellow
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "2" {
                Write-Host ""
                Write-Host "Stopping Student Lab System..." -ForegroundColor Green
                Write-Host ""
                if (Test-Path "Batch-Files\STOP.bat") {
                    & "Batch-Files\STOP.bat"
                } else {
                    Write-Host "ERROR: STOP.bat not found in Batch-Files directory!" -ForegroundColor Red
                    Write-Host "Please ensure all files are properly installed." -ForegroundColor Yellow
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "3" {
                Invoke-Script -ScriptName "SETUP-SIMPLE" -Description "Running complete setup"
                break
            }
            "4" {
                Write-Host ""
                Write-Host "Running package manager..." -ForegroundColor Green
                Write-Host ""
                if (Test-Path "Batch-Files\PACKAGES.bat") {
                    & "Batch-Files\PACKAGES.bat"
                } else {
                    Write-Host "ERROR: PACKAGES.bat not found in Batch-Files directory!" -ForegroundColor Red
                    Write-Host "Please ensure all files are properly installed." -ForegroundColor Yellow
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "5" {
                Write-Host ""
                Write-Host "Opening server control..." -ForegroundColor Green
                Write-Host ""
                if (Test-Path "Batch-Files\SERVERS.bat") {
                    & "Batch-Files\SERVERS.bat"
                } else {
                    Write-Host "ERROR: SERVERS.bat not found in Batch-Files directory!" -ForegroundColor Red
                    Write-Host "Please ensure all files are properly installed." -ForegroundColor Yellow
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "6" {
                Write-Host ""
                Write-Host "Generating SSL Certificate..." -ForegroundColor Green
                Write-Host ""
                if (Test-Path "Batch-Files\SSL-CERT.bat") {
                    & "Batch-Files\SSL-CERT.bat"
                } else {
                    Write-Host "ERROR: SSL-CERT.bat not found in Batch-Files directory!" -ForegroundColor Red
                    Write-Host "Please ensure all files are properly installed." -ForegroundColor Yellow
                    Read-Host "Press Enter to continue"
                }
                break
            }
            "7" {
                Write-Host ""
                Write-Host "Goodbye! Thank you for using Student Lab System v2" -ForegroundColor Green
                Write-Host ""
                Start-Sleep -Seconds 2
                exit 0
            }
            default {
                Write-Host ""
                Write-Host "ERROR: Invalid choice. Please select 1-7." -ForegroundColor Red
                Write-Host ""
                Write-Host "Press any key to return to main menu..." -ForegroundColor Yellow
                Read-Host
            }
        }
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Press any key to return to main menu..." -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Read-Host
    }
}

# Handle help parameter
if ($Help) {
    Show-Help
    exit 0
}

# Check if Batch-Files directory exists
if (-not (Test-Path "Batch-Files")) {
    Write-Host "ERROR: Batch-Files directory not found!" -ForegroundColor Red
    Write-Host "Please ensure the project is properly installed." -ForegroundColor Red
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
