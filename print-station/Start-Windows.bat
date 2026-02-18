@echo off
REM ============================================
REM ChurchCheck Print Helper - Start
REM ============================================
REM Double-click to start the print helper.
REM Keep this window open while using check-in.
REM ============================================

cls
echo.
echo   ========================================
echo     ChurchCheck Print Helper v2.0
echo   ========================================
echo   Keep this window open while checking in.
echo   Labels print to your DYMO LabelWriter.
echo   ========================================
echo.

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Please run Setup-Windows.bat first.
    pause
    exit /b 1
)

REM Check for node_modules
if not exist "node_modules" (
    echo [INSTALL] First run detected - installing dependencies...
    call npm install --production
)

echo [START] Starting print helper...
echo         Press Ctrl+C to stop.
echo.

node print-helper.cjs

