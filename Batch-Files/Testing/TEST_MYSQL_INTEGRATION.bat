@echo off
echo ========================================
echo    MySQL Integration Test
echo ========================================
echo.

echo Starting MySQL integration test...
echo.

cd ..\..\System
node test-mysql-integration.js

echo.
echo ========================================
echo Test completed. Check results above.
echo ========================================
pause
