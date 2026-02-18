@echo off
REM ============================================
REM ChurchCheck Print Helper - Uninstall
REM ============================================

cd /d "%~dp0"

cls
echo.
echo   Uninstalling ChurchCheck Print Helper...
echo.

REM Kill the wscript wrapper that runs the helper silently
taskkill /F /IM "wscript.exe" 2>nul

REM Kill any node process running print-helper.cjs
powershell -Command "Get-WmiObject Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*print-helper*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" 2>nul
echo   [OK] Process stopped

REM Remove from Startup folder
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
del "%STARTUP_DIR%\ChurchCheck PrintHelper.lnk" 2>nul
echo   [OK] Removed from Windows Startup

REM Remove the silent runner VBS
del "%~dp0run-silent.vbs" 2>nul
echo   [OK] Cleaned up files

echo.
echo   ================================================
echo   [OK] Print helper has been fully uninstalled.
echo        You can delete this folder to remove all files.
echo   ================================================
echo.
pause
