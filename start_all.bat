@echo off
TITLE RetailMind AI Launcher
echo ========================================================
echo           RetailMind AI - System Startup
echo ========================================================
echo.
echo [1/3] Launching AI Microservice (FastAPI on Port 8000)...
start "RetailMind - AI Service (8000)" cmd /k "cd /d D:\Capstone_Project\RetailMind\ai_service && .\venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/3] Launching Backend Server (Express on Port 5000)...
start "RetailMind - Backend (5000)" cmd /k "cd /d D:\Capstone_Project\RetailMind\backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [3/3] Launching Frontend (React Vite on Port 3000)...
start "RetailMind - Frontend (3000)" cmd /k "cd /d D:\Capstone_Project\RetailMind\frontend && npm run dev"

echo.
echo ========================================================
echo All 3 services launched successfully!
echo Open your browser at: http://localhost:3000
echo ========================================================
echo.
pause
