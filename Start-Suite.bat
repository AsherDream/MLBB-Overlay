@echo off
title MLBB Broadcast Suite v1.0
color 0A

echo ===================================================
echo      STARTING MLBB BROADCAST SUITE v1.0
echo ===================================================
echo.

echo Starting Node.js Server on Port 3000...
echo.

:: Start server in background
cd server
start /B node index.js

:: Wait for server boot
timeout /t 2 /nobreak > nul

:: Open browser
echo Opening Central Hub...
start http://localhost:3000/

echo.
echo ---------------------------------------------------
echo [LIVE] Suite is running. Close this window to stop.
echo ---------------------------------------------------

pause

