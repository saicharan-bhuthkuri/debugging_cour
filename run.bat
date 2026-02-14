@echo off
cd /d "%~dp0"
echo Starting Debugging Course Application...

REM Start Backend Server
start "Backend Server (Port 3000)" cmd /k "bun run --hot main.ts"

REM Start Frontend Server
cd frontend
start "Frontend Server (Port 5173)" cmd /k "bun run dev"

echo Servers have been launched in separate windows.
timeout /t 5
start http://localhost:5173
pause
