@echo off
REM ============================================
REM ChurchCheck Print Helper - Uninstall
REM ============================================

cls
echo.
echo   Uninstalling ChurchCheck Print Helper...
echo.

REM Kill running instance
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq ChurchCheck*" >nul 2>nul
taskkill /F /IM "wscript.exe" >nul 2>nul
echo   [OK] Process stopped

REM Remove from Startup
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
del "%STARTUP_DIR%\ChurchCheck PrintHelper.lnk" 2>nul
echo   [OK] Removed from Startup

echo.
echo   [OK] Print helper has been uninstalled.
echo        You can delete this folder to remove all files.
echo.
pause

