@echo off
echo ========================================
echo   System Verification - Clean Version
echo ========================================
echo.

set BASE_DIR=%~dp0
cd /d "%BASE_DIR%"

echo Checking folder structure...
echo.

if exist "%~dp0System\server" (
    echo ✅ System\server folder exists
) else (
    echo ❌ System\server folder missing
    goto :error
)

if exist "%~dp0System\web-interface" (
    echo ✅ System\web-interface folder exists
) else (
    echo ❌ System\web-interface folder missing
    goto :error
)

if exist "%~dp0Student-Data" (
    echo ✅ Student-Data folder exists
) else (
    echo ❌ Student-Data folder missing
    goto :error
)

echo.
echo Checking server files...

if exist "%~dp0System\server\main-server.js" (
    echo ✅ main-server.js exists
) else (
    echo ❌ main-server.js missing
    goto :error
)

if exist "%~dp0System\server\package.json" (
    echo ✅ package.json exists
) else (
    echo ❌ package.json missing
    goto :error
)

if exist "%~dp0System\server\node_modules" (
    echo ✅ node_modules exists
) else (
    echo ❌ node_modules missing
    goto :error
)

echo.
echo Checking web interface files...

if exist "%~dp0System\web-interface\pages\Entry-Scanner.html" (
    echo ✅ Entry-Scanner.html exists
) else (
    echo ❌ Entry-Scanner.html missing
    goto :error
)

if exist "%~dp0System\web-interface\pages\Exit-Validator.html" (
    echo ✅ Exit-Validator.html exists
) else (
    echo ❌ Exit-Validator.html missing
    goto :error
)

if exist "%~dp0System\web-interface\pages\Admin-Dashboard.html" (
    echo ✅ Admin-Dashboard.html exists
) else (
    echo ❌ Admin-Dashboard.html missing
    goto :error
)

if exist "%~dp0System\web-interface\scripts\Entry-Scanner.js" (
    echo ✅ Entry-Scanner.js exists
) else (
    echo ❌ Entry-Scanner.js missing
    goto :error
)

if exist "%~dp0System\web-interface\scripts\Exit-Validator.js" (
    echo ✅ Exit-Validator.js exists
) else (
    echo ❌ Exit-Validator.js missing
    goto :error
)

if exist "%~dp0System\web-interface\scripts\Admin-Dashboard.js" (
    echo ✅ Admin-Dashboard.js exists
) else (
    echo ❌ Admin-Dashboard.js missing
    goto :error
)

if exist "%~dp0System\web-interface\styles\main-styles.css" (
    echo ✅ main-styles.css exists
) else (
    echo ❌ main-styles.css missing
    goto :error
)

if exist "%~dp0System\web-interface\libraries\qr-scanner-library.js" (
    echo ✅ qr-scanner-library.js exists
) else (
    echo ❌ qr-scanner-library.js missing
    goto :error
)

echo.
echo Checking data files...

if exist "%~dp0Student-Data\students-database.xlsx" (
    echo ✅ students-database.xlsx exists
) else (
    echo ⚠️  students-database.xlsx missing (will use sample data)
)

echo.
echo Checking scripts...

if exist "%~dp0Scripts\daily-export-tool.js" (
    echo ✅ daily-export-tool.js exists
) else (
    echo ❌ daily-export-tool.js missing
    goto :error
)

echo.
echo ========================================
echo   ✅ ALL CHECKS PASSED!
echo ========================================
echo.
echo Your system is properly organized and ready to run.
echo.
echo To start the system:
echo   1. Double-click START_CLEAN_SYSTEM.bat
echo   2. Or run: cd System\server ^&^& npm run dev
echo.
echo Access URLs when running:
echo   Entry Scanner:  http://localhost:3000/entry-scanner
echo   Exit Validator: http://localhost:3000/exit-validator
echo   Admin Dashboard: http://localhost:3000/admin-dashboard
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo   ❌ VERIFICATION FAILED!
echo ========================================
echo.
echo Some files are missing. Please check the error messages above.
echo You may need to re-run the organization process.
echo.
pause
exit /b 1
