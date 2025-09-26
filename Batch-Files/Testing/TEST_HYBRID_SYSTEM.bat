@echo off
echo ========================================
echo HYBRID SYSTEM COMPREHENSIVE TEST
echo Student Lab System - Local + MySQL Backup
echo ========================================
echo.

echo Starting Hybrid System Tests...
echo This will test all scenarios: offline, online, reconnection, data conflicts
echo.

cd ..\..\System
node test-hybrid-system.js

echo.
echo ========================================
echo Test completed. Check the results above.
echo ========================================
pause
