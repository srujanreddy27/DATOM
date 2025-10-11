@echo off
REM Backend Server Startup Script for DecentraTask (Windows)

echo 🚀 Starting DecentraTask Backend Server...
echo.

REM Check if we're in the right directory
if not exist "backend\server.py" (
    echo ❌ Error: Please run this script from the project root directory
    echo    Current directory: %CD%
    echo    Expected to find: backend\server.py
    pause
    exit /b 1
)

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Python is not installed or not in PATH
    echo    Please install Python 3.8+ and try again
    pause
    exit /b 1
)

REM Check if pip is available
pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: pip is not installed or not in PATH
    echo    Please install pip and try again
    pause
    exit /b 1
)

REM Install dependencies if needed
echo 📦 Checking dependencies...
cd backend
pip install -r requirements.txt --quiet

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found
    echo    Google OAuth will not work without proper configuration
    echo    Run the setup script first: ..\setup-google-oauth.bat
    echo.
)

REM Start the server
echo 🌐 Starting FastAPI server on http://localhost:8000
echo    API Documentation: http://localhost:8000/docs
echo    Press Ctrl+C to stop the server
echo.

REM Start uvicorn server
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
