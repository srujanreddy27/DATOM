@echo off
REM Frontend Server Startup Script for DecentraTask (Windows)

echo 🚀 Starting DecentraTask Frontend Server...
echo.

REM Check if we're in the right directory
if not exist "frontend\package.json" (
    echo ❌ Error: Please run this script from the project root directory
    echo    Current directory: %CD%
    echo    Expected to find: frontend\package.json
    pause
    exit /b 1
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo    Please install Node.js 16+ and try again
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: npm is not installed or not in PATH
    echo    Please install npm and try again
    pause
    exit /b 1
)

REM Install dependencies if needed
echo 📦 Installing dependencies...
cd frontend
npm install

REM Start the React development server
echo 🌐 Starting React development server...
echo    Frontend will be available at: http://localhost:3000
echo    Login page: http://localhost:3000/login.html
echo    Press Ctrl+C to stop the server
echo.

REM Start the development server
npm start
