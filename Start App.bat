@echo off
title Stop App
echo Stopping all running servers...
taskkill /F /IM node.exe /T >nul 2>&1
echo Done. All servers stopped.
pause