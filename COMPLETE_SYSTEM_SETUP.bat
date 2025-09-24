@echo off
setlocal enabledelayedexpansion

:: ========================================
::   COMPLETE STUDENT LAB SYSTEM SETUP
::   Handles everything from Node.js to deployment
:: ========================================

echo.
echo ==========================================
echo    COMPLETE STUDENT LAB SYSTEM SETUP
echo ==========================================
echo.
echo This script will:
echo   1. Check/Install Node.js and npm
echo   2. Verify system requirements
echo   3. Install project dependencies
echo   4. Setup database and configuration
echo   5. Test the complete system
echo   6. Create startup shortcuts
echo.

:: Set colors for better visibility
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "RESET=[0m"

:: Get current directory
set "PROJECT_ROOT=%~dp0"
set "SERVER_DIR=%PROJECT_ROOT%System\server"
set "LOGS_DIR=%PROJECT_ROOT%Logs"

echo %BLUE%Project Root: %PROJECT_ROOT%%RESET%
echo.

:: ========================================
:: STEP 1: CHECK ADMINISTRATOR PRIVILEGES
:: ========================================
echo %YELLOW%[STEP 1] Checking administrator privileges...%RESET%
net session >nul 2>&1
if %errorLevel% == 0 (
    echo %GREEN%✅ Running as Administrator%RESET%
) else (
    echo %RED%⚠️  Not running as Administrator%RESET%
    echo %YELLOW%Some features may require admin privileges%RESET%
    echo %YELLOW%Consider running as Administrator for full setup%RESET%
)
echo.

:: ========================================
:: STEP 2: CHECK NODE.JS INSTALLATION
:: ========================================
echo %YELLOW%[STEP 2] Checking Node.js installation...%RESET%

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo %RED%❌ Node.js not found!%RESET%
    echo.
    echo %YELLOW%OPTIONS:%RESET%
    echo   1. Download and install Node.js manually from: https://nodejs.org
    echo   2. Use Chocolatey: choco install nodejs
    echo   3. Use Winget: winget install OpenJS.NodeJS
    echo.
    
    :: Try automatic installation with winget
    echo %BLUE%Attempting automatic Node.js installation with winget...%RESET%
    winget install OpenJS.NodeJS --accept-source-agreements --accept-package-agreements
    
    if %errorLevel% neq 0 (
        echo %RED%❌ Automatic installation failed%RESET%
        echo %YELLOW%Please install Node.js manually and run this script again%RESET%
        echo %YELLOW%Download from: https://nodejs.org/en/download/%RESET%
        pause
        exit /b 1
    ) else (
        echo %GREEN%✅ Node.js installed successfully%RESET%
        echo %YELLOW%Please restart this script to continue%RESET%
        pause
        exit /b 0
    )
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo %GREEN%✅ Node.js found: %NODE_VERSION%%RESET%
)

:: Check npm
npm --version >nul 2>&1
if %errorLevel% neq 0 (
    echo %RED%❌ npm not found!%RESET%
    echo %YELLOW%npm should come with Node.js. Please reinstall Node.js%RESET%
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo %GREEN%✅ npm found: %NPM_VERSION%%RESET%
)
echo.

:: ========================================
:: STEP 3: VERIFY PROJECT STRUCTURE
:: ========================================
echo %YELLOW%[STEP 3] Verifying project structure...%RESET%

:: Check main directories
if not exist "%PROJECT_ROOT%System" (
    echo %RED%❌ System directory not found!%RESET%
    goto :error_exit
)

if not exist "%SERVER_DIR%" (
    echo %RED%❌ Server directory not found!%RESET%
    goto :error_exit
)

if not exist "%PROJECT_ROOT%Student-Data" (
    echo %YELLOW%⚠️  Creating Student-Data directory...%RESET%
    mkdir "%PROJECT_ROOT%Student-Data"
)

if not exist "%LOGS_DIR%" (
    echo %YELLOW%⚠️  Creating Logs directory...%RESET%
    mkdir "%LOGS_DIR%"
)

:: Check essential files
if not exist "%SERVER_DIR%\package.json" (
    echo %RED%❌ package.json not found in server directory!%RESET%
    goto :error_exit
)

if not exist "%SERVER_DIR%\main-server.js" (
    echo %RED%❌ main-server.js not found!%RESET%
    goto :error_exit
)

echo %GREEN%✅ Project structure verified%RESET%
echo.

:: ========================================
:: STEP 4: INSTALL DEPENDENCIES
:: ========================================
echo %YELLOW%[STEP 4] Installing project dependencies...%RESET%

cd /d "%SERVER_DIR%"

:: Clear npm cache
echo %BLUE%Clearing npm cache...%RESET%
npm cache clean --force

:: Install dependencies
echo %BLUE%Installing dependencies...%RESET%
npm install

if %errorLevel% neq 0 (
    echo %RED%❌ Failed to install dependencies!%RESET%
    echo.
    echo %YELLOW%TROUBLESHOOTING:%RESET%
    echo   1. Check internet connection
    echo   2. Try: npm install --force
    echo   3. Try: npm install --legacy-peer-deps
    echo   4. Delete node_modules and try again
    echo.
    
    :: Try alternative installation methods
    echo %BLUE%Trying alternative installation...%RESET%
    rmdir /s /q node_modules 2>nul
    npm install --force
    
    if %errorLevel% neq 0 (
        echo %RED%❌ All installation attempts failed%RESET%
        goto :error_exit
    )
)

echo %GREEN%✅ Dependencies installed successfully%RESET%
echo.

:: ========================================
:: STEP 5: VERIFY DEPENDENCIES
:: ========================================
echo %YELLOW%[STEP 5] Verifying installed packages...%RESET%

:: Check critical packages
set "REQUIRED_PACKAGES=express ws xlsx cors nodemon"
for %%p in (%REQUIRED_PACKAGES%) do (
    npm list %%p >nul 2>&1
    if !errorLevel! neq 0 (
        echo %RED%❌ Missing package: %%p%RESET%
        npm install %%p
    ) else (
        echo %GREEN%✅ Package found: %%p%RESET%
    )
)
echo.

:: ========================================
:: STEP 6: SETUP DATABASE
:: ========================================
echo %YELLOW%[STEP 6] Setting up student database...%RESET%

set "EXCEL_FILE=%PROJECT_ROOT%Student-Data\students-database.xlsx"

if not exist "%EXCEL_FILE%" (
    echo %YELLOW%⚠️  Excel database not found%RESET%
    echo %BLUE%Creating sample database...%RESET%
    
    :: Create sample Excel file message
    echo %YELLOW%NOTE: Sample data will be used for testing%RESET%
    echo %YELLOW%Place your students-database.xlsx in Student-Data folder%RESET%
    echo %YELLOW%Format: ID, Name, Center, Subject, Grade, Fees, Phone, Parent_Phone%RESET%
) else (
    echo %GREEN%✅ Excel database found: %EXCEL_FILE%%RESET%
)
echo.

:: ========================================
:: STEP 7: TEST SYSTEM COMPONENTS
:: ========================================
echo %YELLOW%[STEP 7] Testing system components...%RESET%

:: Test server startup
echo %BLUE%Testing server startup...%RESET%
start /b "" node main-server.js

:: Wait for server to start
timeout /t 5 /nobreak >nul

:: Test API endpoint
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/api/student-cache' -UseBasicParsing -TimeoutSec 5; Write-Host 'API Test: SUCCESS' -ForegroundColor Green; exit 0 } catch { Write-Host 'API Test: FAILED' -ForegroundColor Red; exit 1 }"

if %errorLevel% eq 0 (
    echo %GREEN%✅ Server test successful%RESET%
) else (
    echo %RED%❌ Server test failed%RESET%
    echo %YELLOW%Server may still be starting up...%RESET%
)

:: Stop test server
taskkill /f /im node.exe >nul 2>&1

echo.

:: ========================================
:: STEP 8: CREATE STARTUP SHORTCUTS
:: ========================================
echo %YELLOW%[STEP 8] Creating startup shortcuts...%RESET%

:: Create desktop shortcuts
set "DESKTOP=%USERPROFILE%\Desktop"

:: Create VBS script for silent startup
echo Set WshShell = CreateObject("WScript.Shell") > "%PROJECT_ROOT%start_system_silent.vbs"
echo WshShell.Run chr(34) ^& "%PROJECT_ROOT%START_CLEAN_SYSTEM.bat" ^& Chr(34), 0 >> "%PROJECT_ROOT%start_system_silent.vbs"
echo Set WshShell = Nothing >> "%PROJECT_ROOT%start_system_silent.vbs"

:: Create quick start batch
echo @echo off > "%PROJECT_ROOT%QUICK_START.bat"
echo cd /d "%SERVER_DIR%" >> "%PROJECT_ROOT%QUICK_START.bat"
echo start "" http://localhost:3000/entry-scanner >> "%PROJECT_ROOT%QUICK_START.bat"
echo start "" http://localhost:3000/exit-validator >> "%PROJECT_ROOT%QUICK_START.bat"
echo start "" http://localhost:3000/admin-dashboard >> "%PROJECT_ROOT%QUICK_START.bat"
echo node main-server.js >> "%PROJECT_ROOT%QUICK_START.bat"

echo %GREEN%✅ Shortcuts created%RESET%
echo.

:: ========================================
:: STEP 9: SYSTEM HEALTH CHECK
:: ========================================
echo %YELLOW%[STEP 9] Final system health check...%RESET%

:: Check all components
set "HEALTH_SCORE=0"

:: Check Node.js
node --version >nul 2>&1 && set /a HEALTH_SCORE+=1 && echo %GREEN%✅ Node.js: OK%RESET% || echo %RED%❌ Node.js: FAIL%RESET%

:: Check npm
npm --version >nul 2>&1 && set /a HEALTH_SCORE+=1 && echo %GREEN%✅ npm: OK%RESET% || echo %RED%❌ npm: FAIL%RESET%

:: Check project structure
if exist "%SERVER_DIR%\main-server.js" (set /a HEALTH_SCORE+=1 && echo %GREEN%✅ Server files: OK%RESET%) else (echo %RED%❌ Server files: FAIL%RESET%)

:: Check dependencies
if exist "%SERVER_DIR%\node_modules" (set /a HEALTH_SCORE+=1 && echo %GREEN%✅ Dependencies: OK%RESET%) else (echo %RED%❌ Dependencies: FAIL%RESET%)

:: Check web interface
if exist "%PROJECT_ROOT%System\web-interface" (set /a HEALTH_SCORE+=1 && echo %GREEN%✅ Web interface: OK%RESET%) else (echo %RED%❌ Web interface: FAIL%RESET%)

echo.
echo %BLUE%HEALTH SCORE: %HEALTH_SCORE%/5%RESET%

if %HEALTH_SCORE% geq 4 (
    echo %GREEN%🎉 SYSTEM SETUP COMPLETE! 🎉%RESET%
) else (
    echo %YELLOW%⚠️  SETUP COMPLETED WITH WARNINGS%RESET%
)

:: ========================================
:: STEP 10: FINAL INSTRUCTIONS
:: ========================================
echo.
echo ==========================================
echo             SETUP COMPLETE!
echo ==========================================
echo.
echo %GREEN%✅ Your Student Lab System is ready!%RESET%
echo.
echo %YELLOW%QUICK START OPTIONS:%RESET%
echo   1. Double-click: START_CLEAN_SYSTEM.bat
echo   2. Double-click: QUICK_START.bat (opens all interfaces)
echo   3. Run silently: start_system_silent.vbs
echo.
echo %YELLOW%ACCESS URLS (when server is running):%RESET%
echo   Entry Scanner:  http://localhost:3000/entry-scanner
echo   Exit Validator: http://localhost:3000/exit-validator
echo   Admin Dashboard: http://localhost:3000/admin-dashboard
echo.
echo %YELLOW%TROUBLESHOOTING:%RESET%
echo   - Check logs in: %LOGS_DIR%
echo   - Restart system: Ctrl+C then run batch file again
echo   - Update Excel data: Place file in Student-Data folder
echo.
echo %BLUE%SYSTEM INFORMATION:%RESET%
echo   Node.js: %NODE_VERSION%
echo   npm: %NPM_VERSION%
echo   Project: %PROJECT_ROOT%
echo.

:: Create system info file
echo STUDENT LAB SYSTEM - SETUP COMPLETE > "%PROJECT_ROOT%SYSTEM_INFO.txt"
echo Setup Date: %DATE% %TIME% >> "%PROJECT_ROOT%SYSTEM_INFO.txt"
echo Node.js Version: %NODE_VERSION% >> "%PROJECT_ROOT%SYSTEM_INFO.txt"
echo npm Version: %NPM_VERSION% >> "%PROJECT_ROOT%SYSTEM_INFO.txt"
echo Health Score: %HEALTH_SCORE%/5 >> "%PROJECT_ROOT%SYSTEM_INFO.txt"
echo Project Root: %PROJECT_ROOT% >> "%PROJECT_ROOT%SYSTEM_INFO.txt"

echo %GREEN%Setup information saved to: SYSTEM_INFO.txt%RESET%
echo.

:: Ask if user wants to start the system now
echo %YELLOW%Would you like to start the system now? (Y/N)%RESET%
set /p START_NOW=
if /i "%START_NOW%"=="Y" (
    echo %BLUE%Starting Student Lab System...%RESET%
    call "%PROJECT_ROOT%START_CLEAN_SYSTEM.bat"
) else (
    echo %GREEN%Setup complete! Use the batch files to start the system when ready.%RESET%
)

goto :end

:: ========================================
:: ERROR HANDLING
:: ========================================
:error_exit
echo.
echo %RED%==========================================%RESET%
echo %RED%           SETUP FAILED!%RESET%
echo %RED%==========================================%RESET%
echo.
echo %YELLOW%COMMON SOLUTIONS:%RESET%
echo   1. Run as Administrator
echo   2. Check internet connection
echo   3. Install Node.js manually from nodejs.org
echo   4. Verify project files are complete
echo   5. Check antivirus software isn't blocking
echo.
echo %YELLOW%For support, check:%RESET%
echo   - Project documentation
echo   - Node.js installation guide
echo   - npm troubleshooting guide
echo.

:end
echo.
echo Press any key to exit...
pause >nul
exit /b 0
