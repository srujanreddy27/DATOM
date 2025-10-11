@echo off
REM Google OAuth Setup Script for DecentraTask (Windows)
REM This script helps you set up Google OAuth credentials

echo 🔧 Setting up Google OAuth for DecentraTask...
echo.

REM Check if .env file exists
if exist "backend\.env" (
    echo ⚠️  .env file already exists. Backing up to .env.backup
    copy "backend\.env" "backend\.env.backup"
)

REM Create .env file
echo 📝 Creating .env file...
(
echo # Google OAuth Configuration
echo # Get these from Google Cloud Console: https://console.cloud.google.com/
echo GOOGLE_CLIENT_ID=your_google_client_id_here
echo GOOGLE_CLIENT_SECRET=your_google_client_secret_here
echo.
echo # OAuth Redirect URI ^(should match what's configured in Google Cloud Console^)
echo OAUTH_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
echo.
echo # Frontend origin for redirects
echo FRONTEND_ORIGIN=http://localhost:3000
echo.
echo # JWT Secret ^(change this in production^)
echo JWT_SECRET=dev-secret-key-change-me-in-production
echo.
echo # MongoDB Configuration ^(optional - will use memory storage if not set^)
echo MONGO_URL=mongodb://localhost:27017
echo DB_NAME=decentratask
echo USE_MEMORY_DB=false
echo.
echo # CORS Configuration
echo CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
) > "backend\.env"

echo ✅ .env file created successfully!
echo.
echo 🔑 Next steps to complete Google OAuth setup:
echo.
echo 1. Go to Google Cloud Console: https://console.cloud.google.com/
echo 2. Create a new project or select an existing one
echo 3. Enable the Google+ API ^(or Google Identity API^)
echo 4. Go to 'Credentials' and create an 'OAuth 2.0 Client ID'
echo 5. Set the authorized redirect URI to: http://localhost:8000/api/auth/google/callback
echo 6. Copy your Client ID and Client Secret
echo 7. Edit backend\.env and replace 'your_google_client_id_here' and 'your_google_client_secret_here' with your actual values
echo.
echo 📖 For detailed instructions, see: backend\google-oauth-setup.md
echo.
echo 🚀 After setting up the credentials, restart your backend server!
pause
