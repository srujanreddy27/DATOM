#!/bin/bash

# Backend Server Startup Script for DecentraTask

echo "🚀 Starting DecentraTask Backend Server..."
echo ""

# Check if we're in the right directory
if [ ! -f "backend/server.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected to find: backend/server.py"
    exit 1
fi

# Check if Python is available
if ! command -v python &> /dev/null; then
    echo "❌ Error: Python is not installed or not in PATH"
    echo "   Please install Python 3.8+ and try again"
    exit 1
fi

# Check if pip is available
if ! command -v pip &> /dev/null; then
    echo "❌ Error: pip is not installed or not in PATH"
    echo "   Please install pip and try again"
    exit 1
fi

# Install dependencies if needed
echo "📦 Checking dependencies..."
cd backend
pip install -r requirements.txt --quiet

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "   Google OAuth will not work without proper configuration"
    echo "   Run the setup script first: ../setup-google-oauth.sh"
    echo ""
fi

# Start the server
echo "🌐 Starting FastAPI server on http://localhost:8000"
echo "   API Documentation: http://localhost:8000/docs"
echo "   Press Ctrl+C to stop the server"
echo ""

# Start uvicorn server
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
