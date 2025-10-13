#!/usr/bin/env node

/**
 * Script to validate that all required environment variables are set
 */

require('dotenv').config();

const requiredVars = [
  'REACT_APP_BACKEND_URL',
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID'
];

const optionalVars = [
  'REACT_APP_FIREBASE_MEASUREMENT_ID',
  'REACT_APP_NETWORK_NAME',
  'REACT_APP_RPC_URL',
  'REACT_APP_CHAIN_ID',
  'REACT_APP_CHAIN_ID_HEX',
  'REACT_APP_CURRENCY_SYMBOL',
  'REACT_APP_ESCROW_ADDRESS'
];

console.log('🔍 Validating environment variables...\n');

let hasErrors = false;

// Check required variables
console.log('📋 Required Variables:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    console.log(`❌ ${varName}: Missing or empty`);
    hasErrors = true;
  } else {
    console.log(`✅ ${varName}: Set`);
  }
});

// Check optional variables
console.log('\n📋 Optional Variables:');
optionalVars.forEach(varName => {
  const value = process.env[varName];
  if (!value || value.trim() === '') {
    console.log(`⚠️  ${varName}: Not set (using default)`);
  } else {
    console.log(`✅ ${varName}: Set`);
  }
});

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.log('❌ Validation failed! Please set all required environment variables.');
  console.log('💡 Copy .env.example to .env and fill in your values.');
  process.exit(1);
} else {
  console.log('✅ All required environment variables are set!');
  console.log('🚀 Ready to start the application.');
}