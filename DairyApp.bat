@echo off
title App Launcher
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo ===================================
echo   Starting App - please wait...
echo ===================================
echo.

if not exist "%ROOT%node_modules" goto INSTALL_ROOT
goto CHECK_BACKEND
:INSTALL_ROOT
echo Installing launcher dependencies, first run only...
call npm install
:CHECK_BACKEND

if not exist "%ROOT%backend\node_modules" goto INSTALL_BACKEND
goto CHECK_FRONTEND
:INSTALL_BACKEND
echo Installing backend dependencies, first run only...
call npm install --prefix "%ROOT%backend"
:CHECK_FRONTEND

if not exist "%ROOT%frontend\node_modules" goto INSTALL_FRONTEND
goto RUN_ALL
:INSTALL_FRONTEND
echo Installing frontend dependencies, first run only...
call npm install --prefix "%ROOT%frontend"
:RUN_ALL

echo.
echo Starting backend + frontend...
echo (Vite will open the browser automatically once ready)
echo.
call npm run start-all

echo.
echo Servers stopped.
pause