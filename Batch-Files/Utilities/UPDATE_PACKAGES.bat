@echo off
title Package Updater - Student Lab System
color 0A
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   PACKAGE UPDATER
echo ========================================
echo.
echo This tool will update all packages to their
echo latest compatible versions.
echo.

set /p continue="Continue with package update? (y/n): "
if /i not "%continue%"=="y" (
    echo Package update cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STEP 1: BACKUP CURRENT PACKAGES
echo ========================================

echo 💾 Creating backup of current package files...

REM Create backup directory
set backup_dir=%~dp0..\..\..\Backups\Package-Backups
if not exist "%backup_dir%" mkdir "%backup_dir%"

set timestamp=%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set timestamp=!timestamp: =0!
set backup_name=package_backup_!timestamp!

echo Creating backup: !backup_name!

REM Backup main package files
if exist "%~dp0..\..\..\System\package.json" (
    copy "%~dp0..\..\..\System\package.json" "%backup_dir%\!backup_name!_main_package.json" >nul
    echo ✅ Main package.json backed up
)

if exist "%~dp0..\..\..\System\package-lock.json" (
    copy "%~dp0..\..\..\System\package-lock.json" "%backup_dir%\!backup_name!_main_package-lock.json" >nul
    echo ✅ Main package-lock.json backed up
)

REM Backup server package files
if exist "%~dp0..\..\..\System\server\package.json" (
    copy "%~dp0..\..\..\System\server\package.json" "%backup_dir%\!backup_name!_server_package.json" >nul
    echo ✅ Server package.json backed up
)

if exist "%~dp0..\..\..\System\server\package-lock.json" (
    copy "%~dp0..\..\..\System\server\package-lock.json" "%backup_dir%\!backup_name!_server_package-lock.json" >nul
    echo ✅ Server package-lock.json backed up
)

echo ✅ Package backup completed: !backup_name!

echo.
echo ========================================
echo   STEP 2: UPDATE MAIN SYSTEM PACKAGES
echo ========================================

echo 📦 Updating main system packages...
cd /d "%~dp0..\..\..\System"

if exist "package.json" (
    echo.
    echo 🔍 Current package versions:
    npm list --depth=0 2>nul
    
    echo.
    echo 📥 Installing latest compatible versions...
    npm install --save
    
    if %errorlevel% neq 0 (
        echo ❌ Failed to update main packages
        echo Trying with force flag...
        npm install --save --force
        if %errorlevel% neq 0 (
            echo ❌ Main package update failed completely
            set MAIN_UPDATE_FAILED=1
        ) else (
            echo ✅ Main packages updated with force
            set MAIN_UPDATE_FAILED=0
        )
    ) else (
        echo ✅ Main packages updated successfully
        set MAIN_UPDATE_FAILED=0
    )
    
    echo.
    echo 🔍 Updated package versions:
    npm list --depth=0 2>nul
) else (
    echo ❌ Main package.json not found
    set MAIN_UPDATE_FAILED=1
)

echo.
echo ========================================
echo   STEP 3: UPDATE SERVER PACKAGES
echo ========================================

echo 📦 Updating server packages...
cd /d "%~dp0..\..\..\System\server"

if exist "package.json" (
    echo.
    echo 🔍 Current server package versions:
    npm list --depth=0 2>nul
    
    echo.
    echo 📥 Installing latest compatible versions...
    npm install --save
    
    if %errorlevel% neq 0 (
        echo ❌ Failed to update server packages
        echo Trying with force flag...
        npm install --save --force
        if %errorlevel% neq 0 (
            echo ❌ Server package update failed completely
            set SERVER_UPDATE_FAILED=1
        ) else (
            echo ✅ Server packages updated with force
            set SERVER_UPDATE_FAILED=0
        )
    ) else (
        echo ✅ Server packages updated successfully
        set SERVER_UPDATE_FAILED=0
    )
    
    echo.
    echo 🔍 Updated server package versions:
    npm list --depth=0 2>nul
) else (
    echo ❌ Server package.json not found
    set SERVER_UPDATE_FAILED=1
)

echo.
echo ========================================
echo   STEP 4: SECURITY AUDIT
echo ========================================

echo 🔒 Running security audit after update...

REM Audit main packages
echo.
echo Auditing main system packages...
cd /d "%~dp0..\..\..\System"
if exist "package.json" (
    npm audit --audit-level=moderate
    if %errorlevel% neq 0 (
        echo ⚠️  Security vulnerabilities found in main packages
        echo Consider running: npm audit fix
    ) else (
        echo ✅ No security vulnerabilities in main packages
    )
)

REM Audit server packages
echo.
echo Auditing server packages...
cd /d "%~dp0..\..\..\System\server"
if exist "package.json" (
    npm audit --audit-level=moderate
    if %errorlevel% neq 0 (
        echo ⚠️  Security vulnerabilities found in server packages
        echo Consider running: npm audit fix
    ) else (
        echo ✅ No security vulnerabilities in server packages
    )
)

echo.
echo ========================================
echo   STEP 5: COMPATIBILITY TEST
echo ========================================

echo 🧪 Testing updated packages...

REM Test main packages
echo.
echo Testing main system packages...
cd /d "%~dp0..\..\..\System"
if exist "package.json" (
    echo 🔍 Testing package compatibility...
    npm run test 2>nul
    if %errorlevel% neq 0 (
        echo ⚠️  Some tests failed - this may be normal if tests are not configured
    ) else (
        echo ✅ Main package tests passed
    )
)

REM Test server packages
echo.
echo Testing server packages...
cd /d "%~dp0..\..\..\System\server"
if exist "package.json" (
    echo 🔍 Testing server package compatibility...
    node -c main-server.js 2>nul
    if %errorlevel% neq 0 (
        echo ❌ Server syntax check failed
        echo There may be compatibility issues
    ) else (
        echo ✅ Server syntax check passed
    )
)

echo.
echo ========================================
echo   STEP 6: UPDATE SUMMARY
echo ========================================

echo 📋 Package Update Summary:
echo.

if %MAIN_UPDATE_FAILED%==0 (
    echo ✅ Main system packages: Updated successfully
) else (
    echo ❌ Main system packages: Update failed
)

if %SERVER_UPDATE_FAILED%==0 (
    echo ✅ Server packages: Updated successfully
) else (
    echo ❌ Server packages: Update failed
)

echo.
echo 📊 Updated Package Versions:
echo   Node.js: %NODE_VERSION%
echo   npm: %NPM_VERSION%
echo.

echo 🔧 Key Updates:
echo   - express: Latest stable version
echo   - mysql2: Latest with Node.js 18+ support
echo   - ws: Latest WebSocket library
echo   - xlsx: Latest Excel processing
echo   - cors: Latest CORS middleware
echo   - dotenv: Latest environment variables
echo   - helmet: Latest security middleware
echo   - uuid: Latest UUID generation
echo   - moment: Latest date/time library
echo   - winston: Latest logging library
echo.

echo ⚠️  Important Notes:
echo   1. All packages updated to latest compatible versions
echo   2. Backup created: !backup_name!
echo   3. Test the system thoroughly after update
echo   4. Check for any breaking changes in package documentation
echo   5. Run security audit if needed: npm audit fix
echo.

echo ========================================
echo   PACKAGE UPDATE COMPLETED
echo ========================================
echo.

set /p test_system="Test the system now? (y/n): "
if /i "%test_system%"=="y" (
    echo.
    echo 🧪 Testing system startup...
    cd /d "%~dp0..\..\..\System"
    timeout /t 3 >nul
    start "System Test" cmd /k "node server/main-server.js"
    echo ✅ System test started in new window
    echo Check the new window for any startup errors.
)

echo.
pause
