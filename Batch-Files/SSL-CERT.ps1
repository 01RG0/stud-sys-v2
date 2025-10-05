# Student Lab System - SSL Certificate Generator (PowerShell)
# Enhanced version with better error handling and cross-platform support

param(
    [switch]$Help,
    [switch]$Force
)

# Set console title and colors
$Host.UI.RawUI.WindowTitle = "SSL Certificate Generator"
$Host.UI.RawUI.BackgroundColor = "Black"
$Host.UI.RawUI.ForegroundColor = "Cyan"
Clear-Host

# Function to display help
function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   SSL Certificate Generator for HTTPS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\SSL-CERT.ps1 [options]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Help    Show this help message" -ForegroundColor White
    Write-Host "  -Force   Skip confirmation prompts" -ForegroundColor White
    Write-Host ""
    Write-Host "This script will:" -ForegroundColor Yellow
    Write-Host "  ✓ Check for OpenSSL installation" -ForegroundColor White
    Write-Host "  ✓ Generate self-signed SSL certificate" -ForegroundColor White
    Write-Host "  ✓ Create private key and certificate files" -ForegroundColor White
    Write-Host "  ✓ Enable HTTPS for the server" -ForegroundColor White
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

# Function to run OpenSSL command with error handling
function Invoke-OpenSSLCommand {
    param(
        [string]$Arguments,
        [string]$WorkingDirectory = (Get-Location)
    )
    
    try {
        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = "openssl"
        $processInfo.Arguments = $Arguments
        $processInfo.WorkingDirectory = $WorkingDirectory
        $processInfo.UseShellExecute = $false
        $processInfo.RedirectStandardOutput = $true
        $processInfo.RedirectStandardError = $true
        $processInfo.CreateNoWindow = $true
        
        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $processInfo
        $process.Start() | Out-Null
        
        $output = $process.StandardOutput.ReadToEnd()
        $error = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        
        return @{
            ExitCode = $process.ExitCode
            Output = $output
            Error = $error
        }
    }
    catch {
        return @{
            ExitCode = -1
            Output = ""
            Error = $_.Exception.Message
        }
    }
}

# Function to generate private key
function New-PrivateKey {
    param(
        [string]$OutputPath,
        [int]$KeySize = 2048
    )
    
    Write-Host "Generating private key..." -ForegroundColor Green
    $arguments = "genrsa -out `"$OutputPath`" $KeySize"
    $result = Invoke-OpenSSLCommand -Arguments $arguments
    
    if ($result.ExitCode -eq 0) {
        Write-Host "OK Private key generated successfully" -ForegroundColor Green
        return $true
    } else {
        Write-Host "ERROR: Failed to generate private key!" -ForegroundColor Red
        Write-Host "Error: $($result.Error)" -ForegroundColor Red
        return $false
    }
}

# Function to generate certificate
function New-Certificate {
    param(
        [string]$KeyPath,
        [string]$OutputPath,
        [int]$Days = 365
    )
    
    Write-Host "Generating certificate..." -ForegroundColor Green
    $subject = "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"
    $arguments = "req -new -x509 -key `"$KeyPath`" -out `"$OutputPath`" -days $Days -subj `"$subject`""
    $result = Invoke-OpenSSLCommand -Arguments $arguments
    
    if ($result.ExitCode -eq 0) {
        Write-Host "OK Certificate generated successfully" -ForegroundColor Green
        return $true
    } else {
        Write-Host "ERROR: Failed to generate certificate!" -ForegroundColor Red
        Write-Host "Error: $($result.Error)" -ForegroundColor Red
        return $false
    }
}

# Function to verify certificate files
function Test-CertificateFiles {
    param(
        [string]$KeyPath,
        [string]$CertPath
    )
    
    $keyExists = Test-Path $KeyPath
    $certExists = Test-Path $CertPath
    
    if ($keyExists -and $certExists) {
        Write-Host "OK Certificate files verified" -ForegroundColor Green
        
        # Get file sizes
        $keySize = (Get-Item $KeyPath).Length
        $certSize = (Get-Item $CertPath).Length
        
        Write-Host "Private key size: $keySize bytes" -ForegroundColor Gray
        Write-Host "Certificate size: $certSize bytes" -ForegroundColor Gray
        
        return $true
    } else {
        Write-Host "ERROR: Certificate files verification failed!" -ForegroundColor Red
        if (-not $keyExists) {
            Write-Host "Private key file not found: $KeyPath" -ForegroundColor Red
        }
        if (-not $certExists) {
            Write-Host "Certificate file not found: $CertPath" -ForegroundColor Red
        }
        return $false
    }
}

# Function to display certificate information
function Show-CertificateInfo {
    param(
        [string]$CertPath
    )
    
    Write-Host ""
    Write-Host "Certificate Information:" -ForegroundColor Yellow
    Write-Host "========================" -ForegroundColor Yellow
    
    $arguments = "x509 -in `"$CertPath`" -text -noout"
    $result = Invoke-OpenSSLCommand -Arguments $arguments
    
    if ($result.ExitCode -eq 0) {
        # Extract key information from the output
        $lines = $result.Output -split "`n"
        $subject = $lines | Where-Object { $_ -match "Subject:" }
        $issuer = $lines | Where-Object { $_ -match "Issuer:" }
        $notBefore = $lines | Where-Object { $_ -match "Not Before:" }
        $notAfter = $lines | Where-Object { $_ -match "Not After:" }
        
        if ($subject) { Write-Host $subject -ForegroundColor White }
        if ($issuer) { Write-Host $issuer -ForegroundColor White }
        if ($notBefore) { Write-Host $notBefore -ForegroundColor White }
        if ($notAfter) { Write-Host $notAfter -ForegroundColor White }
    } else {
        Write-Host "Could not retrieve certificate information" -ForegroundColor Yellow
    }
}

# Main SSL certificate generation function
function Start-SSLCertificateGeneration {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   SSL Certificate Generator for HTTPS" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check if OpenSSL is available
    Write-Host "Checking for OpenSSL..." -ForegroundColor Green
    if (-not (Test-Command "openssl")) {
        Write-Host "ERROR: OpenSSL not found in PATH" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please install OpenSSL first:" -ForegroundColor Yellow
        Write-Host "1. Download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor White
        Write-Host "2. Or install via Chocolatey: choco install openssl" -ForegroundColor White
        Write-Host "3. Or use Git Bash (includes OpenSSL)" -ForegroundColor White
        Write-Host "4. Or install via WSL: sudo apt-get install openssl" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Write-Host "OK OpenSSL found" -ForegroundColor Green
    Write-Host ""
    
    # Navigate to server directory and create certs directory
    $serverPath = "..\System\server"
    if (-not (Test-Path $serverPath)) {
        Write-Host "ERROR: Server directory not found!" -ForegroundColor Red
        Write-Host "Please ensure the project is properly installed." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    Set-Location $serverPath
    
    $certsPath = "certs"
    if (-not (Test-Path $certsPath)) {
        Write-Host "Creating certs directory..." -ForegroundColor Green
        New-Item -ItemType Directory -Path $certsPath -Force | Out-Null
        Write-Host "OK Certs directory created" -ForegroundColor Green
    } else {
        Write-Host "OK Certs directory exists" -ForegroundColor Green
    }
    
    # Check if certificates already exist
    $keyPath = "$certsPath\server.key"
    $certPath = "$certsPath\server.crt"
    
    if ((Test-Path $keyPath) -or (Test-Path $certPath)) {
        Write-Host ""
        Write-Host "WARNING: SSL certificate files already exist!" -ForegroundColor Yellow
        Write-Host "Key file: $keyPath" -ForegroundColor White
        Write-Host "Cert file: $certPath" -ForegroundColor White
        Write-Host ""
        
        if (-not (Get-UserConfirmation "Overwrite existing certificate files?")) {
            Write-Host "Certificate generation cancelled." -ForegroundColor Yellow
            Read-Host "Press Enter to exit"
            exit 0
        }
        
        # Backup existing files
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        if (Test-Path $keyPath) {
            $backupKey = "$keyPath.backup.$timestamp"
            Copy-Item $keyPath $backupKey
            Write-Host "Backed up existing key to: $backupKey" -ForegroundColor Gray
        }
        if (Test-Path $certPath) {
            $backupCert = "$certPath.backup.$timestamp"
            Copy-Item $certPath $backupCert
            Write-Host "Backed up existing certificate to: $backupCert" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "Generating self-signed SSL certificate..." -ForegroundColor Green
    Write-Host ""
    
    # Generate private key
    if (-not (New-PrivateKey -OutputPath $keyPath)) {
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Generate certificate
    if (-not (New-Certificate -KeyPath $keyPath -OutputPath $certPath)) {
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Verify certificate files
    if (-not (Test-CertificateFiles -KeyPath $keyPath -CertPath $certPath)) {
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Display certificate information
    Show-CertificateInfo -CertPath $certPath
    
    # Success message
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   SSL CERTIFICATE GENERATED SUCCESSFULLY!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Files created:" -ForegroundColor Yellow
    Write-Host "  System\server\certs\server.key  (Private Key)" -ForegroundColor White
    Write-Host "  System\server\certs\server.crt  (Certificate)" -ForegroundColor White
    Write-Host ""
    Write-Host "HTTPS will now be enabled when you restart the server" -ForegroundColor Green
    Write-Host ""
    Write-Host "WARNING: Note: This is a self-signed certificate" -ForegroundColor Yellow
    Write-Host "  - Browsers will show a security warning" -ForegroundColor White
    Write-Host "  - Click 'Advanced' and 'Proceed to localhost' to continue" -ForegroundColor White
    Write-Host "  - This is normal for development/testing" -ForegroundColor White
    Write-Host ""
    Write-Host "To use HTTPS:" -ForegroundColor Yellow
    Write-Host "  1. Restart the server" -ForegroundColor White
    Write-Host "  2. Access: https://localhost:3443" -ForegroundColor White
    Write-Host "  3. Accept the security warning" -ForegroundColor White
    Write-Host ""
    Write-Host "Security Notes:" -ForegroundColor Yellow
    Write-Host "  - This certificate is valid for 365 days" -ForegroundColor White
    Write-Host "  - It's only valid for 'localhost' domain" -ForegroundColor White
    Write-Host "  - For production, use a proper SSL certificate from a CA" -ForegroundColor White
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

# Start SSL certificate generation
try {
    Start-SSLCertificateGeneration
}
catch {
    Write-Host ""
    Write-Host "ERROR: An unexpected error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to continue"
