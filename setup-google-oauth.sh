#!/bin/bash

# Google OAuth Setup Script for DecentraTask
# This script helps you set up Google OAuth credentials

echo "🔧 Setting up Google OAuth for DecentraTask..."
echo ""

# Check if .env file exists
if [ -f "backend/.env" ]; then
    echo "⚠️  .env file already exists. Backing up to .env.backup"
    cp backend/.env backend/.env.backup
fi

# Create .env file
echo "📝 Creating .env file..."
cat > backend/.env << 'EOF'
# Google OAuth Configuration
# Get these from Google Cloud Console: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# OAuth Redirect URI (should match what's configured in Google Cloud Console)
OAUTH_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# Frontend origin for redirects
FRONTEND_ORIGIN=http://localhost:3000

# JWT Secret (change this in production)
JWT_SECRET=dev-secret-key-change-me-in-production

# MongoDB Configuration (optional - will use memory storage if not set)
MONGO_URL=mongodb://localhost:27017
DB_NAME=decentratask
USE_MEMORY_DB=false

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
EOF

echo "✅ .env file created successfully!"
echo ""
echo "🔑 Next steps to complete Google OAuth setup:"
echo ""
echo "1. Go to Google Cloud Console: https://console.cloud.google.com/"
echo "2. Create a new project or select an existing one"
echo "3. Enable the Google+ API (or Google Identity API)"
echo "4. Go to 'Credentials' and create an 'OAuth 2.0 Client ID'"
echo "5. Set the authorized redirect URI to: http://localhost:8000/api/auth/google/callback"
echo "6. Copy your Client ID and Client Secret"
echo "7. Edit backend/.env and replace 'your_google_client_id_here' and 'your_google_client_secret_here' with your actual values"
echo ""
echo "📖 For detailed instructions, see: backend/google-oauth-setup.md"
echo ""
echo "🚀 After setting up the credentials, restart your backend server!"
