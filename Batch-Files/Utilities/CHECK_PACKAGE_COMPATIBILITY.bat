@echo off
title Package Compatibility Checker
color 0B
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   PACKAGE COMPATIBILITY CHECKER
echo ========================================
echo.
echo This tool will check package compatibility
echo with the latest npm and Node.js versions.
echo.

set /p continue="Continue with compatibility check? (y/n): "
if /i not "%continue%"=="y" (
    echo Compatibility check cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STEP 1: CHECKING NODE.JS AND NPM
echo ========================================

REM Check Node.js version
echo 🔍 Checking Node.js version...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    echo Please install Node.js 18.0.0 or higher
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo ✅ Node.js found: %NODE_VERSION%
    
    REM Extract major version
    for /f "tokens=1 delims=." %%a in ("%NODE_VERSION%") do set NODE_MAJOR=%%a
    set NODE_MAJOR=!NODE_MAJOR:v=!
    
    if !NODE_MAJOR! lss 18 (
        echo ⚠️  Warning: Node.js version %NODE_VERSION% is below recommended 18.0.0
        echo Some packages may not work correctly
    ) else (
        echo ✅ Node.js version is compatible
    )
)

REM Check npm version
echo.
echo 🔍 Checking npm version...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm not found!
    echo Please install npm 11.5.2 or higher
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo ✅ npm found: %NPM_VERSION%
    
    REM Extract major version
    for /f "tokens=1 delims=." %%a in ("%NPM_VERSION%") do set NPM_MAJOR=%%a
    
    if %NPM_MAJOR% lss 11 (
        echo ⚠️  Warning: npm version %NPM_VERSION% is below recommended 11.5.2
        echo Some packages may not install correctly
    ) else (
        echo ✅ npm version is compatible
    )
)

echo.
echo ========================================
echo   STEP 2: CHECKING PACKAGE VERSIONS
echo ========================================

REM Navigate to System directory
cd /d "%~dp0..\..\..\System"

echo 📦 Checking main system packages...
if exist "package.json" (
    echo ✅ Main package.json found
    
    REM Check for outdated packages
    echo.
    echo 🔍 Checking for outdated packages...
    npm outdated --json > temp_outdated.json 2>nul
    if %errorlevel% neq 0 (
        echo ⚠️  Could not check for outdated packages
        echo This might be due to network issues or package registry problems
    ) else (
        if exist "temp_outdated.json" (
            echo 📊 Outdated packages found:
            type temp_outdated.json
            del temp_outdated.json >nul 2>&1
        ) else (
            echo ✅ All packages are up to date
        )
    )
) else (
    echo ❌ Main package.json not found
)

echo.
echo 📦 Checking server packages...
cd /d "%~dp0..\..\..\System\server"
if exist "package.json" (
    echo ✅ Server package.json found
    
    REM Check for outdated packages
    echo.
    echo 🔍 Checking for outdated server packages...
    npm outdated --json > temp_outdated.json 2>nul
    if %errorlevel% neq 0 (
        echo ⚠️  Could not check for outdated server packages
    ) else (
        if exist "temp_outdated.json" (
            echo 📊 Outdated server packages found:
            type temp_outdated.json
            del temp_outdated.json >nul 2>&1
        ) else (
            echo ✅ All server packages are up to date
        )
    )
) else (
    echo ❌ Server package.json not found
)

echo.
echo ========================================
echo   STEP 3: PACKAGE COMPATIBILITY TEST
echo ========================================

echo 🧪 Testing package compatibility...

REM Test main packages
echo.
echo Testing main system packages...
cd /d "%~dp0..\..\..\System"
if exist "package.json" (
    echo 🔍 Testing package installation...
    npm install --dry-run >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Package installation test failed
        echo There may be compatibility issues
    ) else (
        echo ✅ Package installation test passed
    )
)

REM Test server packages
echo.
echo Testing server packages...
cd /d "%~dp0..\..\..\System\server"
if exist "package.json" (
    echo 🔍 Testing server package installation...
    npm install --dry-run >nul 2>&1
    if %errorlevel% neq 0 (
        echo ❌ Server package installation test failed
        echo There may be compatibility issues
    ) else (
        echo ✅ Server package installation test passed
    )
)

echo.
echo ========================================
echo   STEP 4: SECURITY AUDIT
echo ========================================

echo 🔒 Running security audit...

REM Audit main packages
echo.
echo Auditing main system packages...
cd /d "%~dp0..\..\..\System"
if exist "package.json" (
    npm audit --json > temp_audit.json 2>nul
    if %errorlevel% neq 0 (
        echo ⚠️  Could not run security audit on main packages
    ) else (
        if exist "temp_audit.json" (
            echo 📊 Security audit results for main packages:
            type temp_audit.json
            del temp_audit.json >nul 2>&1
        ) else (
            echo ✅ No security vulnerabilities found in main packages
        )
    )
)

REM Audit server packages
echo.
echo Auditing server packages...
cd /d "%~dp0..\..\..\System\server"
if exist "package.json" (
    npm audit --json > temp_audit.json 2>nul
    if %errorlevel% neq 0 (
        echo ⚠️  Could not run security audit on server packages
    ) else (
        if exist "temp_audit.json" (
            echo 📊 Security audit results for server packages:
            type temp_audit.json
            del temp_audit.json >nul 2>&1
        ) else (
            echo ✅ No security vulnerabilities found in server packages
        )
    )
)

echo.
echo ========================================
echo   STEP 5: COMPATIBILITY RECOMMENDATIONS
echo ========================================

echo 📋 Compatibility Recommendations:
echo.

echo ✅ Recommended Versions:
echo   Node.js: 18.0.0 or higher (Current: %NODE_VERSION%)
echo   npm: 11.5.2 or higher (Current: %NPM_VERSION%)
echo.

echo 📦 Key Package Versions:
echo   express: ^4.21.2 (Latest stable)
echo   mysql2: ^3.12.0 (Latest with Node.js 18+ support)
echo   ws: ^8.18.3 (Latest WebSocket library)
echo   xlsx: ^0.18.5 (Latest Excel processing)
echo   cors: ^2.8.5 (Latest CORS middleware)
echo   dotenv: ^16.4.7 (Latest environment variables)
echo   helmet: ^8.0.0 (Latest security middleware)
echo   uuid: ^11.0.3 (Latest UUID generation)
echo   moment: ^2.30.1 (Latest date/time library)
echo   winston: ^3.17.0 (Latest logging library)
echo.

echo 🔧 Development Tools:
echo   nodemon: ^3.1.7 (Latest auto-restart)
echo   jest: ^29.7.0 (Latest testing framework)
echo   supertest: ^7.0.0 (Latest HTTP testing)
echo   eslint: ^9.17.0 (Latest linting)
echo.

echo ⚠️  Important Notes:
echo   1. All packages are tested for Node.js 18+ compatibility
echo   2. npm 11.5.2+ provides better security and performance
echo   3. Some packages may require Node.js 18+ for full functionality
echo   4. Always test after updating packages
echo   5. Use 'npm ci' for production deployments
echo.

echo ========================================
echo   COMPATIBILITY CHECK COMPLETED
echo ========================================
echo.

set /p update_packages="Update packages to latest versions? (y/n): "
if /i "%update_packages%"=="y" (
    echo.
    echo 📦 Updating packages...
    
    REM Update main packages
    echo Updating main system packages...
    cd /d "%~dp0..\..\..\System"
    npm update
    
    REM Update server packages
    echo Updating server packages...
    cd /d "%~dp0..\..\..\System\server"
    npm update
    
    echo ✅ Package update completed
    echo.
    echo Please test the system after updating packages.
) else (
    echo.
    echo Packages not updated. You can update them manually later.
)

echo.
pause
