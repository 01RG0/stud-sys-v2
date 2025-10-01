@echo off
title Project Organization - Student Lab System
color 0B
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   PROJECT ORGANIZATION TOOL
echo ========================================
echo.
echo This tool will organize and clean up your project structure
echo for better maintainability and performance.
echo.

set /p continue="Continue with project organization? (y/n): "
if /i not "%continue%"=="y" (
    echo Organization cancelled.
    pause
    exit /b 0
)

echo.
echo ========================================
echo   STEP 1: CREATING DIRECTORY STRUCTURE
echo ========================================

echo 📁 Creating organized directory structure...

REM Create main directories
if not exist "System" mkdir "System"
if not exist "System\server" mkdir "System\server"
if not exist "System\web-interface" mkdir "System\web-interface"
if not exist "System\web-interface\pages" mkdir "System\web-interface\pages"
if not exist "System\web-interface\scripts" mkdir "System\web-interface\scripts"
if not exist "System\web-interface\styles" mkdir "System\web-interface\styles"
if not exist "System\web-interface\libraries" mkdir "System\web-interface\libraries"
if not exist "System\web-interface\webfonts" mkdir "System\web-interface\webfonts"

if not exist "Documentation" mkdir "Documentation"
if not exist "Batch-Files" mkdir "Batch-Files"
if not exist "Batch-Files\Setup" mkdir "Batch-Files\Setup"
if not exist "Batch-Files\System-Control" mkdir "Batch-Files\System-Control"
if not exist "Batch-Files\Testing" mkdir "Batch-Files\Testing"
if not exist "Batch-Files\Utilities" mkdir "Batch-Files\Utilities"

if not exist "Logs" mkdir "Logs"
if not exist "Backups" mkdir "Backups"
if not exist "Backups\System" mkdir "Backups\System"
if not exist "Backups\Database" mkdir "Backups\Database"
if not exist "Backups\Configuration" mkdir "Backups\Configuration"

if not exist "Student-Data" mkdir "Student-Data"
if not exist "Student-Data\processed" mkdir "Student-Data\processed"
if not exist "Student-Data\exports" mkdir "Student-Data\exports"
if not exist "Student-Data\imports" mkdir "Student-Data\imports"

if not exist "Assets" mkdir "Assets"
if not exist "Assets\Scripts" mkdir "Assets\Scripts"
if not exist "Assets\Fonts" mkdir "Assets\Fonts"
if not exist "Assets\Images" mkdir "Assets\Images"

if not exist "Tests" mkdir "Tests"
if not exist "Tests\Unit" mkdir "Tests\Unit"
if not exist "Tests\Integration" mkdir "Tests\Integration"
if not exist "Tests\E2E" mkdir "Tests\E2E"

echo ✅ Directory structure created

echo.
echo ========================================
echo   STEP 2: ORGANIZING BATCH FILES
echo ========================================

echo 📋 Organizing batch files...

REM Move setup files
if exist "SETUP_*.bat" (
    for %%f in (SETUP_*.bat) do (
        move "%%f" "Batch-Files\Setup\" >nul 2>&1
        echo Moved: %%f
    )
)

REM Move system control files
if exist "START_*.bat" (
    for %%f in (START_*.bat) do (
        move "%%f" "Batch-Files\System-Control\" >nul 2>&1
        echo Moved: %%f
    )
)

REM Move testing files
if exist "TEST_*.bat" (
    for %%f in (TEST_*.bat) do (
        move "%%f" "Batch-Files\Testing\" >nul 2>&1
        echo Moved: %%f
    )
)

REM Move utility files
if exist "FIX_*.bat" (
    for %%f in (FIX_*.bat) do (
        move "%%f" "Batch-Files\Utilities\" >nul 2>&1
        echo Moved: %%f
    )
)

if exist "VERIFY_*.bat" (
    for %%f in (VERIFY_*.bat) do (
        move "%%f" "Batch-Files\Utilities\" >nul 2>&1
        echo Moved: %%f
    )
)

echo ✅ Batch files organized

echo.
echo ========================================
echo   STEP 3: ORGANIZING DOCUMENTATION
echo ========================================

echo 📚 Organizing documentation files...

REM Move documentation files
if exist "*.md" (
    for %%f in (*.md) do (
        if not "%%f"=="README.md" (
            move "%%f" "Documentation\" >nul 2>&1
            echo Moved: %%f
        )
    )
)

echo ✅ Documentation organized

echo.
echo ========================================
echo   STEP 4: ORGANIZING ASSETS
echo ========================================

echo 🎨 Organizing assets...

REM Move font files
if exist "*.woff2" (
    for %%f in (*.woff2) do (
        move "%%f" "Assets\Fonts\" >nul 2>&1
        echo Moved: %%f
    )
)

if exist "*.ttf" (
    for %%f in (*.ttf) do (
        move "%%f" "Assets\Fonts\" >nul 2>&1
        echo Moved: %%f
    )
)

REM Move script files
if exist "*.js" (
    for %%f in (*.js) do (
        if not "%%f"=="test-*.js" (
            move "%%f" "Assets\Scripts\" >nul 2>&1
            echo Moved: %%f
        )
    )
)

echo ✅ Assets organized

echo.
echo ========================================
echo   STEP 5: ORGANIZING TEST FILES
echo ========================================

echo 🧪 Organizing test files...

REM Move test files
if exist "test-*.js" (
    for %%f in (test-*.js) do (
        move "%%f" "Tests\Integration\" >nul 2>&1
        echo Moved: %%f
    )
)

if exist "test-*.html" (
    for %%f in (test-*.html) do (
        move "%%f" "Tests\E2E\" >nul 2>&1
        echo Moved: %%f
    )
)

echo ✅ Test files organized

echo.
echo ========================================
echo   STEP 6: CLEANING UP TEMPORARY FILES
echo ========================================

echo 🧹 Cleaning up temporary files...

REM Remove temporary files
del /q /s *.tmp >nul 2>&1
del /q /s *.temp >nul 2>&1
del /q /s *.log >nul 2>&1
del /q /s *.cache >nul 2>&1
del /q /s Thumbs.db >nul 2>&1
del /q /s .DS_Store >nul 2>&1

REM Remove empty directories
for /f "delims=" %%d in ('dir /ad /b /s ^| sort /r') do rd "%%d" 2>nul

echo ✅ Temporary files cleaned

echo.
echo ========================================
echo   STEP 7: CREATING PROJECT INDEX
echo ========================================

echo 📋 Creating project index...

REM Create project index file
(
echo # Student Lab System - Project Index
echo.
echo ## Directory Structure
echo.
echo ### System Files
echo - `System/` - Main application code
echo   - `server/` - Backend server files
echo   - `web-interface/` - Frontend web interface
echo     - `pages/` - HTML pages
echo     - `scripts/` - JavaScript files
echo     - `styles/` - CSS files
echo     - `libraries/` - Third-party libraries
echo     - `webfonts/` - Web fonts
echo.
echo ### Batch Files
echo - `Batch-Files/` - Windows batch scripts
echo   - `Setup/` - Installation and setup scripts
echo   - `System-Control/` - System management scripts
echo   - `Testing/` - Testing and validation scripts
echo   - `Utilities/` - Utility and maintenance scripts
echo.
echo ### Documentation
echo - `Documentation/` - Project documentation
echo.
echo ### Data Storage
echo - `Student-Data/` - Student data files
echo   - `processed/` - Processed data files
echo   - `exports/` - Exported data files
echo   - `imports/` - Imported data files
echo.
echo ### Logs and Backups
echo - `Logs/` - System log files
echo - `Backups/` - Backup files
echo   - `System/` - System backups
echo   - `Database/` - Database backups
echo   - `Configuration/` - Configuration backups
echo.
echo ### Assets
echo - `Assets/` - Static assets
echo   - `Scripts/` - Additional scripts
echo   - `Fonts/` - Font files
echo   - `Images/` - Image files
echo.
echo ### Tests
echo - `Tests/` - Test files
echo   - `Unit/` - Unit tests
echo   - `Integration/` - Integration tests
echo   - `E2E/` - End-to-end tests
echo.
echo ## Quick Start
echo.
echo 1. Run `MASTER_SETUP.bat` for complete setup
echo 2. Run `QUICK_START.bat` to start the system
echo 3. Access the system at http://localhost:3000
echo.
echo ## Maintenance
echo.
echo - Use `Batch-Files/System-Control/ENHANCED_SYSTEM_CONTROL.bat` for system management
echo - Use `Batch-Files/Setup/ENHANCED_MYSQL_SETUP.bat` for database setup
echo - Check `Logs/` directory for system logs
echo - Use `Backups/` directory for system backups
echo.
echo ## Support
echo.
echo For issues and support, check the Documentation directory.
) > PROJECT_INDEX.md

echo ✅ Project index created

echo.
echo ========================================
echo   STEP 8: CREATING .GITIGNORE
echo ========================================

echo 📝 Creating .gitignore file...

if not exist ".gitignore" (
    (
    echo # Dependencies
    echo node_modules/
    echo npm-debug.log*
    echo yarn-debug.log*
    echo yarn-error.log*
    echo.
    echo # Runtime data
    echo pids
    echo *.pid
    echo *.seed
    echo *.pid.lock
    echo.
    echo # Coverage directory used by tools like istanbul
    echo coverage/
    echo.
    echo # nyc test coverage
    echo .nyc_output
    echo.
    echo # Grunt intermediate storage
    echo .grunt
    echo.
    echo # Bower dependency directory
    echo bower_components
    echo.
    echo # node-waf configuration
    echo .lock-wscript
    echo.
    echo # Compiled binary addons
    echo build/Release
    echo.
    echo # Dependency directories
    echo node_modules/
    echo jspm_packages/
    echo.
    echo # Optional npm cache directory
    echo .npm
    echo.
    echo # Optional REPL history
    echo .node_repl_history
    echo.
    echo # Output of 'npm pack'
    echo *.tgz
    echo.
    echo # Yarn Integrity file
    echo .yarn-integrity
    echo.
    echo # dotenv environment variables file
    echo .env
    echo .env.local
    echo .env.development.local
    echo .env.test.local
    echo .env.production.local
    echo.
    echo # parcel-bundler cache
    echo .cache
    echo .parcel-cache
    echo.
    echo # next.js build output
    echo .next
    echo.
    echo # nuxt.js build output
    echo .nuxt
    echo.
    echo # vuepress build output
    echo .vuepress/dist
    echo.
    echo # Serverless directories
    echo .serverless
    echo.
    echo # FuseBox cache
    echo .fusebox/
    echo.
    echo # DynamoDB Local files
    echo .dynamodb/
    echo.
    echo # TernJS port file
    echo .tern-port
    echo.
    echo # Logs
    echo logs
    echo *.log
    echo Logs/
    echo.
    echo # Runtime data
    echo pids
    echo *.pid
    echo *.seed
    echo *.pid.lock
    echo.
    echo # SSL Certificates
    echo System/server/certs/*.crt
    echo System/server/certs/*.key
    echo System/server/certs/*.pem
    echo System/server/certs/*.csr
    echo.
    echo # Database files
    echo *.db
    echo *.sqlite
    echo *.sqlite3
    echo.
    echo # Backup files
    echo Backups/
    echo *.backup
    echo *.bak
    echo.
    echo # Student data exports
    echo Student-Data/exports/
    echo Student-Data/processed/
    echo Student-Data/imports/
    echo.
    echo # Temporary files
    echo temp/
    echo tmp/
    echo *.tmp
    echo *.temp
    echo.
    echo # OS generated files
    echo .DS_Store
    echo .DS_Store?
    echo ._*
    echo .Spotlight-V100
    echo .Trashes
    echo ehthumbs.db
    echo Thumbs.db
    echo.
    echo # IDE files
    echo .vscode/
    echo .idea/
    echo *.swp
    echo *.swo
    echo *~
    echo.
    echo # Test files
    echo Tests/coverage/
    echo Tests/results/
    echo.
    echo # Build files
    echo dist/
    echo build/
    echo.
    echo # Package files
    echo *.tgz
    echo *.tar.gz
    ) > .gitignore
    echo ✅ .gitignore file created
) else (
    echo ✅ .gitignore file already exists
)

echo.
echo ========================================
echo   STEP 9: CREATING PROJECT CONFIGURATION
echo ========================================

echo ⚙️ Creating project configuration...

REM Create project configuration file
(
echo {
echo   "name": "student-lab-system",
echo   "version": "2.0.0",
echo   "description": "Advanced Student Lab Management System",
echo   "main": "System/server/main-server.js",
echo   "scripts": {
echo     "start": "node System/server/main-server.js",
echo     "dev": "nodemon System/server/main-server.js",
echo     "setup": "MASTER_SETUP.bat",
echo     "organize": "ORGANIZE_PROJECT.bat",
echo     "test": "npm run test:unit && npm run test:integration",
echo     "test:unit": "jest Tests/Unit",
echo     "test:integration": "jest Tests/Integration",
echo     "test:e2e": "jest Tests/E2E",
echo     "lint": "eslint System/",
echo     "clean": "node clean-project.js"
echo   },
echo   "keywords": [
echo     "student-management",
echo     "qr-scanner",
echo     "mysql",
echo     "express",
echo     "offline-first"
echo   ],
echo   "author": "Student Lab System Team",
echo   "license": "MIT",
echo   "repository": {
echo     "type": "git",
echo     "url": "https://github.com/your-org/student-lab-system.git"
echo   },
echo   "engines": {
echo     "node": ">=16.0.0",
echo     "npm": ">=8.0.0"
echo   },
echo   "config": {
echo     "port": 3000,
echo     "https_port": 3443,
echo     "mysql_port": 3306,
echo     "offline_mode": true,
echo     "zero_data_loss": true
echo   }
echo }
) > project.json

echo ✅ Project configuration created

echo.
echo ========================================
echo   STEP 10: FINAL VERIFICATION
echo ========================================

echo 🔍 Verifying project organization...

REM Check if main directories exist
set dirs_ok=1
if not exist "System" set dirs_ok=0
if not exist "Documentation" set dirs_ok=0
if not exist "Batch-Files" set dirs_ok=0
if not exist "Logs" set dirs_ok=0
if not exist "Backups" set dirs_ok=0
if not exist "Student-Data" set dirs_ok=0
if not exist "Assets" set dirs_ok=0
if not exist "Tests" set dirs_ok=0

if %dirs_ok%==1 (
    echo ✅ All main directories created
) else (
    echo ❌ Some directories missing
)

REM Check if key files exist
set files_ok=1
if not exist "README.md" set files_ok=0
if not exist "PROJECT_INDEX.md" set files_ok=0
if not exist ".gitignore" set files_ok=0
if not exist "project.json" set files_ok=0

if %files_ok%==1 (
    echo ✅ All key files created
) else (
    echo ❌ Some key files missing
)

echo.
echo ========================================
echo   PROJECT ORGANIZATION COMPLETED!
echo ========================================
echo.
echo ✅ Directory structure: Organized
echo ✅ Batch files: Organized
echo ✅ Documentation: Organized
echo ✅ Assets: Organized
echo ✅ Test files: Organized
echo ✅ Temporary files: Cleaned
echo ✅ Project index: Created
echo ✅ .gitignore: Created
echo ✅ Project config: Created
echo.
echo Your project is now well-organized and ready for development!
echo.
echo Next steps:
echo 1. Run MASTER_SETUP.bat for complete setup
echo 2. Run QUICK_START.bat to start the system
echo 3. Check PROJECT_INDEX.md for project overview
echo.
echo Project structure:
echo - System/ - Main application code
echo - Batch-Files/ - Windows batch scripts
echo - Documentation/ - Project documentation
echo - Logs/ - System logs
echo - Backups/ - Backup files
echo - Student-Data/ - Student data
echo - Assets/ - Static assets
echo - Tests/ - Test files
echo.

set /p open_explorer="Open project in Windows Explorer? (y/n): "
if /i "%open_explorer%"=="y" (
    start "" "%~dp0"
)

echo.
pause
