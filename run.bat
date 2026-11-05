@echo off
rem Start MotoShop AI with the settings in .env. Double-click, then open the URL it prints.
rem Pass -Production to run the built app (after npm run build).
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js was not found. Install it from https://nodejs.org and try again. & pause & exit /b 1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
pause
