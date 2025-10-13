import os
import json
import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Header
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    logger.info("Starting Firebase initialization...")
    
    try:
        # Check if Firebase is already initialized
        app = firebase_admin.get_app()
        logger.info(f"Firebase Admin SDK already initialized for project: {app.project_id}")
        return
    except ValueError:
        # Firebase not initialized, proceed with initialization
        logger.info("Firebase not initialized, proceeding with setup...")
    
    # Try to get service account key from file path
    service_account_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY_PATH')
    service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY_JSON')
    
    logger.info(f"Service account path: {service_account_path}")
    logger.info(f"Service account JSON env var set: {service_account_json is not None}")
    
    if service_account_path and os.path.exists(service_account_path):
        try:
            # Initialize with service account file
            logger.info(f"Loading service account from file: {service_account_path}")
            cred = credentials.Certificate(service_account_path)
            app = firebase_admin.initialize_app(cred)
            logger.info(f"Firebase initialized successfully with service account file. Project ID: {app.project_id}")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase with service account file: {e}")
            raise
    elif service_account_json:
        try:
            # Initialize with service account JSON string
            service_account_info = json.loads(service_account_json)
            cred = credentials.Certificate(service_account_info)
            app = firebase_admin.initialize_app(cred)
            logger.info(f"Firebase initialized successfully with service account JSON. Project ID: {app.project_id}")
        except Exception as e:
            logger.error(f"Failed to initialize Firebase with service account JSON: {e}")
            raise
    else:
        # For development: Create a minimal service account configuration
        try:
            logger.info("Initializing Firebase for development...")
            project_id = os.environ.get('GOOGLE_CLOUD_PROJECT', 'datom-2b7ff')
            
            # Create a minimal service account dict for development
            # This is a simplified approach for development only
            service_account_info = {
                "type": "service_account",
                "project_id": project_id,
                "private_key_id": "dev-key-id",
                "private_key": "-----BEGIN PRIVATE KEY-----\nDEV_PRIVATE_KEY_PLACEHOLDER\n-----END PRIVATE KEY-----\n",
                "client_email": f"firebase-adminsdk@{project_id}.iam.gserviceaccount.com",
                "client_id": "dev-client-id",
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
            }
            
            # For development, we'll use Application Default Credentials or skip Firebase Admin
            # The frontend will handle authentication, backend will just verify tokens
            try:
                # Try to use Application Default Credentials
                cred = credentials.ApplicationDefault()
                app = firebase_admin.initialize_app(cred, options={'projectId': project_id})
                logger.info(f"Firebase initialized with Application Default Credentials. Project ID: {project_id}")
            except Exception as adc_error:
                logger.warning(f"Application Default Credentials failed: {adc_error}")
                try:
                    # Try without credentials - this will work for token verification in some cases
                    app = firebase_admin.initialize_app(options={'projectId': project_id})
                    logger.info(f"Firebase initialized without credentials. Project ID: {project_id}")
                except Exception as no_cred_error:
                    logger.error(f"Failed to initialize Firebase without credentials: {no_cred_error}")
                    raise
                
        except Exception as e:
            logger.error(f"Failed to initialize Firebase for development: {e}")
            # For development, we'll continue without Firebase and mock the responses
            logger.warning("Continuing without Firebase initialization - using development mode")
            return

async def verify_firebase_token(authorization: Optional[str] = Header(default=None)) -> dict:
    """Verify Firebase ID token and return user info"""
    logger.info(f"Verifying Firebase token. Authorization header present: {authorization is not None}")
    
    if not authorization or not authorization.lower().startswith("bearer "):
        logger.error("No authorization header or invalid format")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ", 1)[1]
    logger.info(f"Extracted token (first 20 chars): {token[:20]}...")
    
    try:
        # Check if Firebase is initialized
        try:
            app = firebase_admin.get_app()
            logger.info(f"Firebase app initialized: {app.project_id}")
            
            # Verify the Firebase ID token with clock skew tolerance
            decoded_token = auth.verify_id_token(token, clock_skew_seconds=60)
            logger.info(f"Token verified successfully for user: {decoded_token.get('uid')}")
            return decoded_token
            
        except ValueError:
            logger.error("Firebase app not initialized!")
            raise HTTPException(status_code=500, detail="Firebase authentication not available")
        
    except auth.InvalidIdTokenError as e:
        logger.error(f"Invalid ID token: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except auth.ExpiredIdTokenError as e:
        logger.error(f"Expired ID token: {e}")
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        logger.error(f"Token verification error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

def get_user_from_firebase_token(decoded_token: dict) -> dict:
    """Extract user information from decoded Firebase token"""
    return {
        "uid": decoded_token.get("uid"),
        "email": decoded_token.get("email"),
        "name": decoded_token.get("name", decoded_token.get("email", "").split("@")[0]),
        "picture": decoded_token.get("picture"),
        "email_verified": decoded_token.get("email_verified", False)
    }