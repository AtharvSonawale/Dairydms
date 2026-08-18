@echo off
title Frontend Server
cd /d "%~dp0frontend"
echo Current folder:
cd
echo.
echo Running: npm run dev
echo.
call npm run dev
echo.
echo ===================================
echo Frontend process stopped or crashed.
echo Check the error above.
echo ===================================
pause
