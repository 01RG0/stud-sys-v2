@echo off
echo ========================================
echo   Student Lab System - Simple Start
echo ========================================
echo.

cd /d "%~dp0System\server"

echo Starting server with Node.js directly...
echo (No nodemon - manual restart required)
echo.
echo Press Ctrl+C to stop the server
echo.
echo Access URLs:
echo   Entry Scanner:  http://localhost:3000/entry-scanner
echo   Exit Validator: http://localhost:3000/exit-validator
echo   Admin Dashboard: http://localhost:3000/admin-dashboard
echo.
echo ========================================

node main-server.js

echo.
echo Server stopped.
pause
