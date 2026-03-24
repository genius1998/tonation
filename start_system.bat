@echo off
title MyTonation Launcher

echo [1/2] Starting Backend Server...
start "MyTonation Server" cmd /k "cd server && npm start"

echo [2/2] Starting Client (React)...
start "MyTonation Client" cmd /k "cd client && npm run dev"

echo ========================================================
echo   MyTonation is running!
echo ========================================================
echo.
echo   [Admin Panel]   http://localhost:5173/admin
echo   [OBS Overlay]   http://localhost:5173/overlay
echo.
echo   Do not close the opened command windows.
echo ========================================================
pause
