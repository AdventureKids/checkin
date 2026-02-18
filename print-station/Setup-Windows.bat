@echo off
REM ============================================
REM ChurchCheck Print Helper - Windows Setup
REM ============================================
REM Double-click this file to install everything.
REM You only need to run this ONCE.
REM ============================================

cls
echo.
echo   ========================================
echo     ChurchCheck Print Helper - Windows Setup
echo   ========================================
echo   This will install the print helper so
echo   your check-in station can print labels.
echo   ========================================
echo.

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo Choose the LTS version and run the installer.
    echo Then run this setup again.
    echo.
    start https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found

REM Install dependencies
echo.
echo [INSTALL] Installing print helper dependencies...
call npm install --production

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

echo.
echo [OK] Dependencies installed!

REM Copy avatar files if main project exists nearby
if exist "..\public\avatars" (
    echo [COPY] Copying avatar files...
    xcopy /E /I /Y "..\public\avatars" "public\avatars" >nul 2>nul
    echo [OK] Avatars copied
)

REM Detect DYMO printer
echo.
echo [DETECT] Looking for DYMO printer...
powershell -Command "Get-Printer | Where-Object { $_.Name -like '*DYMO*' -or $_.Name -like '*LabelWriter*' } | Select-Object -First 1 -ExpandProperty Name" > temp_printer.txt 2>nul
set /p DYMO_PRINTER=<temp_printer.txt
del temp_printer.txt 2>nul

if not "%DYMO_PRINTER%"=="" (
    echo [OK] Found DYMO printer: %DYMO_PRINTER%
) else (
    echo [WARN] No DYMO printer detected.
    echo        Make sure your DYMO LabelWriter is connected and powered on.
)

echo.
echo   ========================================
echo           [OK] Setup Complete!
echo   ========================================
echo.
echo   To start the print helper:
echo   ^> Double-click 'Start-Windows.bat'
echo.
echo   Then open Chrome and go to:
echo   ^> churchcheck-api.onrender.com
echo.
echo   ========================================
echo.
pause

