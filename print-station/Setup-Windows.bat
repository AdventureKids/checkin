@echo off
REM ============================================
REM ChurchCheck Print Helper - Windows Setup
REM ============================================
REM Double-click this file ONE TIME to install.
REM The print helper will run automatically in
REM the background from now on — even after reboot.
REM ============================================

REM IMPORTANT: cd to the folder this bat file lives in
cd /d "%~dp0"
set SCRIPT_DIR=%~dp0

cls
echo.
echo   ================================================
echo     ChurchCheck Print Helper - One-Time Setup
echo   ================================================
echo   After setup, the print helper runs silently
echo   in the background -- even after restarting.
echo   You'll never need to touch this again.
echo   ================================================
echo.

REM ---- Step 1: Check for Node.js ----
echo Step 1: Checking for Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   [X] Node.js is not installed.
    echo.
    echo   Opening Node.js download page...
    echo   Install the LTS version, then run this setup again.
    start https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('where node') do set NODE_PATH=%%i
echo   [OK] Node.js %NODE_VERSION%

REM ---- Step 2: Verify setup ----
echo.
echo Step 2: Verifying files...
if not exist "print-helper.cjs" (
    echo   [X] print-helper.cjs not found. Make sure you unzipped the full package.
    pause
    exit /b 1
)
echo   [OK] All files present (zero native dependencies!)

REM ---- Step 3: Copy avatars ----
if exist "..\public\avatars" (
    if not exist "public\avatars\boy-ranger" (
        echo.
        echo Step 3: Copying avatar files...
        xcopy /E /I /Y "..\public\avatars" "public\avatars" >nul 2>nul
        echo   [OK] Avatars copied
    )
)

REM ---- Step 4: Detect DYMO printer ----
echo.
echo Step 4: Detecting DYMO printer...
powershell -Command "Get-Printer | Where-Object { $_.Name -like '*DYMO*' -or $_.Name -like '*LabelWriter*' } | Select-Object -First 1 -ExpandProperty Name" > "%TEMP%\dymo_printer.txt" 2>nul
set /p DYMO_PRINTER=<"%TEMP%\dymo_printer.txt"
del "%TEMP%\dymo_printer.txt" 2>nul

if not "%DYMO_PRINTER%"=="" (
    echo   [OK] Found: %DYMO_PRINTER%
) else (
    echo   [!] No DYMO printer found right now.
    echo       Make sure it's plugged in and powered on.
    echo       The helper will still start.
)

REM ---- Step 5: Kill any existing instance ----
echo.
echo Step 5: Installing as background service...
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq ChurchCheck*" >nul 2>nul

REM ---- Step 6: Create a VBS wrapper for silent background execution ----

echo Set WshShell = CreateObject("WScript.Shell") > "%SCRIPT_DIR%run-silent.vbs"
echo WshShell.Run """%NODE_PATH%"" ""%SCRIPT_DIR%print-helper.cjs""", 0, False >> "%SCRIPT_DIR%run-silent.vbs"

REM ---- Step 7: Add to Windows Startup folder ----
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_VBS=%TEMP%\create_shortcut.vbs

echo Set oWS = WScript.CreateObject("WScript.Shell") > "%SHORTCUT_VBS%"
echo sLinkFile = "%STARTUP_DIR%\ChurchCheck PrintHelper.lnk" >> "%SHORTCUT_VBS%"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%SHORTCUT_VBS%"
echo oLink.TargetPath = "wscript.exe" >> "%SHORTCUT_VBS%"
echo oLink.Arguments = """%SCRIPT_DIR%run-silent.vbs""" >> "%SHORTCUT_VBS%"
echo oLink.WorkingDirectory = "%SCRIPT_DIR%" >> "%SHORTCUT_VBS%"
echo oLink.Description = "ChurchCheck Print Helper" >> "%SHORTCUT_VBS%"
echo oLink.Save >> "%SHORTCUT_VBS%"

cscript //nologo "%SHORTCUT_VBS%"
del "%SHORTCUT_VBS%" 2>nul

echo   [OK] Added to Windows Startup

REM ---- Step 8: Start it now ----
echo.
echo Step 6: Starting print helper...
start "" wscript.exe "%SCRIPT_DIR%run-silent.vbs"

REM Wait and verify
timeout /t 3 /nobreak >nul

powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3100/status' -UseBasicParsing -TimeoutSec 5; Write-Host '  [OK] Print helper is running!' } catch { Write-Host '  [!] Still starting up...' }" 2>nul

echo.
echo   ================================================
echo              [OK] Setup Complete!
echo   ================================================
echo.
echo   The print helper is now running in the
echo   background and will auto-start on login.
echo.
echo   You can close this window.
echo.
echo   Just open Chrome and go to:
echo   ^> churchcheck-api.onrender.com
echo.
echo   You should see: Printer Ready
echo.
echo   To uninstall later, run Uninstall-Windows.bat
echo   ================================================
echo.
pause
