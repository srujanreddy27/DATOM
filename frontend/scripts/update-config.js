#!/usr/bin/env node

/**
 * Script to update config.js with environment variables
 * Run this script before building or serving the application
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const configPath = path.join(__dirname, '../public/config.js');

const config = {
  BACKEND_URL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000',
  FIREBASE_CONFIG: {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.REACT_APP_FIREBASE_APP_ID || '',
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || ''
  }
};

const configContent = `// Configuration for static HTML files
// This file is auto-generated from environment variables
// Do not edit manually - run 'npm run update-config' instead

window.APP_CONFIG = ${JSON.stringify(config, null, 2)};

// Function to load config from environment (for development)
window.loadConfigFromEnv = function() {
  return window.APP_CONFIG;
};
`;

try {
  fs.writeFileSync(configPath, configContent, 'utf8');
  console.log('✅ Config updated successfully!');
  console.log(`📁 Updated: ${configPath}`);
  console.log(`🔧 Backend URL: ${config.BACKEND_URL}`);
  console.log(`🔥 Firebase Project: ${config.FIREBASE_CONFIG.projectId}`);
} catch (error) {
  console.error('❌ Failed to update config:', error.message);
  process.exit(1);
}