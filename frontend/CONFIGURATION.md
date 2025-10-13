# Configuration Management

This document explains how configuration is managed in the DecentraTask frontend application.

## Overview

All hardcoded configuration values have been moved to environment variables to improve security and deployment flexibility.

## Environment Variables

All configuration is managed through environment variables defined in `.env` files:

### Frontend (.env)
```bash
# Backend API Configuration
REACT_APP_BACKEND_URL=http://localhost:8000

# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Blockchain Configuration
REACT_APP_NETWORK_NAME=Datom Test Network
REACT_APP_RPC_URL=http://127.0.0.1:8545
REACT_APP_CHAIN_ID=31337
REACT_APP_CHAIN_ID_HEX=0x7a69
REACT_APP_CURRENCY_SYMBOL=ETH
REACT_APP_ESCROW_ADDRESS=0xA54130603Aed8B222f9BE8F22F4F8ED458505A27
```

## Static HTML Configuration

For static HTML files (like `login.html` and `test-firebase.html`), configuration is managed through:

### 1. config.js File
- Located at `public/config.js`
- Auto-generated from environment variables
- Used by static HTML files that can't access React environment variables

### 2. Update Script
- Run `npm run update-config` to regenerate `config.js` from environment variables
- Automatically runs before `npm start` and `npm run build`

## Files Updated

### Removed Hardcoded Values From:
- ✅ `frontend/public/login.html` - Firebase config and backend URLs
- ✅ `frontend/public/test-firebase.html` - Firebase config and backend URLs  
- ✅ `frontend/src/utils/testFirebase.js` - Project-specific checks
- ✅ `backend/server.py` - CORS origins

### Configuration Sources:
- **React Components**: Use `process.env.REACT_APP_*` variables
- **Static HTML Files**: Use `window.APP_CONFIG` from `config.js`
- **Backend**: Use `os.environ.get()` with fallbacks

## Development Workflow

1. **Setup**: Copy `.env.example` to `.env` and fill in your values
2. **Development**: Run `npm start` (automatically updates config.js)
3. **Production**: Set environment variables in your deployment platform

## Security Notes

- Never commit actual API keys to version control
- Use `.env.example` to document required variables
- The `config.js` file is auto-generated and should not be edited manually
- In production, ensure environment variables are properly secured

## Deployment

For different environments:

### Development
```bash
cp .env.example .env
# Edit .env with your development values
npm run update-config
npm start
```

### Production
```bash
# Set environment variables in your deployment platform
# config.js will be auto-generated during build
npm run build
```

## Troubleshooting

### Config Not Loading
- Ensure `config.js` exists in `public/` directory
- Run `npm run update-config` to regenerate
- Check that environment variables are set correctly

### Firebase Errors
- Verify all Firebase environment variables are set
- Check Firebase project settings match your `.env` values
- Ensure Firebase Authentication is enabled in your project

### Backend Connection Issues
- Verify `REACT_APP_BACKEND_URL` points to correct backend
- Check CORS configuration in backend matches frontend origin
- Ensure backend is running and accessible