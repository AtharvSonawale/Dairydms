@echo off
title Backend Server
cd /d "%~dp0backend"
echo Current folder:
cd
echo.
echo Running: npm run dev
echo.
call npm run dev
echo.
echo ===================================
echo Backend process stopped or crashed.
echo Check the error above.
echo ===================================
pause
