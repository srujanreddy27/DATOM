# Firebase Authentication Setup Guide

## Overview
Your app has been migrated from Google Cloud Console OAuth to Firebase Authentication. This will allow users to show up in your Firebase console and provide better user management.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "decentratask")
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Click on "Google" provider
5. Toggle "Enable"
6. Add your support email
7. Click "Save"

## Step 3: Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. In "General" tab, scroll to "Your apps"
3. Click "Web" icon (</>) to add a web app
4. Register your app with name "DecentraTask Frontend"
5. Copy the Firebase configuration object

## Step 4: Update Frontend Configuration

Update `frontend/.env` with your Firebase config:

```env
REACT_APP_FIREBASE_API_KEY=your-api-key-here
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## Step 5: Setup Backend Service Account

1. In Firebase Console, go to Project Settings
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Save the JSON file as `backend/firebase-service-account-key.json`
5. Keep this file secure and never commit it to version control

## Step 6: Install Dependencies

Backend:
```bash
cd backend
pip install -r requirements.txt
```

Frontend:
```bash
cd frontend
npm install
```

## Step 7: Update Login Page

Update the Firebase config in `frontend/public/login.html` with your actual values.

## Step 8: Test the Setup

1. Start the backend: `python backend/server.py`
2. Start the frontend: `cd frontend && npm start`
3. Go to `http://localhost:3000/login.html`
4. Try signing in with Google
5. Check Firebase Console > Authentication > Users to see logged-in users

## Security Notes

- Never commit `firebase-service-account-key.json` to version control
- Add it to `.gitignore`
- For production, use environment variables instead of the JSON file
- Set up proper Firebase security rules