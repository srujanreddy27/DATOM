# Google OAuth Configuration Template
# Copy this file to .env and fill in your actual values

# Google OAuth Configuration
# Get these from Google Cloud Console: https://console.cloud.google.com/
# 1. Go to Google Cloud Console
# 2. Create a new project or select existing one
# 3. Enable Google+ API
# 4. Go to Credentials and create OAuth 2.0 Client ID
# 5. Set authorized redirect URI to: http://localhost:8000/api/auth/google/callback
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
