#!/usr/bin/env python3
"""
Firebase Configuration Diagnostic Tool
This script helps diagnose Firebase authentication issues.
"""

import os
import json
import logging
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_environment_variables():
    """Check Firebase-related environment variables"""
    logger.info("=== Environment Variables Check ===")
    
    env_vars = [
        'FIREBASE_SERVICE_ACCOUNT_KEY_PATH',
        'FIREBASE_SERVICE_ACCOUNT_KEY_JSON',
        'FIREBASE_API_KEY',
        'GOOGLE_CLOUD_PROJECT'
    ]
    
    for var in env_vars:
        value = os.environ.get(var)
        if value:
            if 'KEY' in var and len(value) > 50:
                logger.info(f"✅ {var}: Set (length: {len(value)} chars)")
            else:
                logger.info(f"✅ {var}: {value}")
        else:
            logger.warning(f"❌ {var}: Not set")

def check_service_account_file():
    """Check service account key file"""
    logger.info("\n=== Service Account File Check ===")
    
    file_paths = [
        './firebase-service-account-key.json',
        'firebase-service-account-key.json',
        os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY_PATH', '')
    ]
    
    for file_path in file_paths:
        if not file_path:
            continue
            
        path = Path(file_path)
        logger.info(f"Checking: {path.absolute()}")
        
        if path.exists():
            logger.info(f"✅ File exists: {file_path}")
            try:
                with open(path, 'r') as f:
                    data = json.load(f)
                
                required_fields = [
                    'type', 'project_id', 'private_key_id', 
                    'private_key', 'client_email', 'client_id'
                ]
                
                logger.info("📋 Service Account Key Contents:")
                for field in required_fields:
                    if field in data:
                        if field == 'private_key':
                            logger.info(f"  ✅ {field}: Present (length: {len(data[field])} chars)")
                        else:
                            logger.info(f"  ✅ {field}: {data[field]}")
                    else:
                        logger.error(f"  ❌ {field}: Missing")
                
                # Check if private key is valid format
                private_key = data.get('private_key', '')
                if private_key.startswith('-----BEGIN PRIVATE KEY-----') and private_key.endswith('-----END PRIVATE KEY-----\n'):
                    logger.info("  ✅ Private key format: Valid")
                else:
                    logger.error("  ❌ Private key format: Invalid")
                
                return True
                
            except json.JSONDecodeError as e:
                logger.error(f"❌ Invalid JSON in {file_path}: {e}")
            except Exception as e:
                logger.error(f"❌ Error reading {file_path}: {e}")
        else:
            logger.warning(f"❌ File not found: {file_path}")
    
    return False

def test_firebase_initialization():
    """Test Firebase initialization"""
    logger.info("\n=== Firebase Initialization Test ===")
    
    try:
        import firebase_admin
        from firebase_admin import credentials
        
        # Check if already initialized
        try:
            app = firebase_admin.get_app()
            logger.info(f"✅ Firebase already initialized: {app.project_id}")
            return True
        except ValueError:
            logger.info("Firebase not initialized, attempting initialization...")
        
        # Try to initialize
        service_account_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY_PATH', './firebase-service-account-key.json')
        service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY_JSON')
        
        if service_account_path and os.path.exists(service_account_path):
            logger.info(f"Attempting initialization with file: {service_account_path}")
            cred = credentials.Certificate(service_account_path)
            app = firebase_admin.initialize_app(cred)
            logger.info(f"✅ Firebase initialized successfully: {app.project_id}")
            return True
        elif service_account_json:
            logger.info("Attempting initialization with JSON string...")
            service_account_info = json.loads(service_account_json)
            cred = credentials.Certificate(service_account_info)
            app = firebase_admin.initialize_app(cred)
            logger.info(f"✅ Firebase initialized successfully: {app.project_id}")
            return True
        else:
            logger.error("❌ No valid service account configuration found")
            return False
            
    except ImportError:
        logger.error("❌ firebase-admin package not installed")
        return False
    except Exception as e:
        logger.error(f"❌ Firebase initialization failed: {e}")
        return False

def test_token_verification():
    """Test token verification (requires a valid token)"""
    logger.info("\n=== Token Verification Test ===")
    logger.info("ℹ️  This test requires a valid Firebase ID token")
    logger.info("ℹ️  You can get one from your frontend application's browser console")
    logger.info("ℹ️  Look for: firebase.auth().currentUser.getIdToken()")
    
    # This is just a placeholder - actual testing would require a real token
    logger.info("⏭️  Skipping token verification test (requires manual token input)")

def generate_new_service_account_instructions():
    """Generate instructions for creating a new service account key"""
    logger.info("\n=== Instructions for New Service Account Key ===")
    logger.info("1. Go to Firebase Console: https://console.firebase.google.com/")
    logger.info("2. Select your project: datom-2b7ff")
    logger.info("3. Go to Project Settings (gear icon)")
    logger.info("4. Click on 'Service Accounts' tab")
    logger.info("5. Click 'Generate New Private Key'")
    logger.info("6. Download the JSON file")
    logger.info("7. Save it as 'firebase-service-account-key.json' in your backend directory")
    logger.info("8. Make sure the file is added to .gitignore")
    logger.info("9. Restart your server")

def main():
    """Run all diagnostic checks"""
    logger.info("🔍 Firebase Configuration Diagnostic Tool")
    logger.info("=" * 50)
    
    check_environment_variables()
    file_exists = check_service_account_file()
    
    if file_exists:
        firebase_initialized = test_firebase_initialization()
        if firebase_initialized:
            test_token_verification()
        else:
            generate_new_service_account_instructions()
    else:
        logger.error("\n❌ No valid service account file found!")
        generate_new_service_account_instructions()
    
    logger.info("\n" + "=" * 50)
    logger.info("🏁 Diagnostic complete!")

if __name__ == "__main__":
    main()
