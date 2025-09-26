@echo off
echo ========================================
echo   Student Lab System - Server Cleanup
echo ========================================
echo.

echo Stopping any servers using ports 3000 and 3443...
echo.

REM Kill any Node.js processes
echo [1/3] Stopping Node.js processes...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo    ✓ Node.js processes stopped
) else (
    echo    ℹ No Node.js processes found
)

REM Kill processes using port 3000
echo [2/3] Stopping processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
    if !errorlevel! equ 0 (
        echo    ✓ Process on port 3000 stopped (PID: %%a)
    )
)

REM Kill processes using port 3443
echo [3/3] Stopping processes on port 3443...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3443 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>&1
    if !errorlevel! equ 0 (
        echo    ✓ Process on port 3443 stopped (PID: %%a)
    )
)

echo.
echo Waiting 3 seconds for ports to be released...
timeout /t 3 /nobreak >nul

echo.
echo Checking port status...
netstat -an | findstr ":3000\|:3443" | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo    ⚠ Some ports may still be in use
    echo    You may need to wait a moment before starting the server
) else (
    echo    ✓ Ports 3000 and 3443 are now free
)

echo.
echo ========================================
echo   Server cleanup completed!
echo ========================================
echo.
echo You can now run START_CLEAN_SYSTEM.bat
echo.
pause
