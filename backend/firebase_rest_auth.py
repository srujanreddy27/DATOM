import os
import logging
import requests
from typing import Optional, Dict
from fastapi import HTTPException, Header

logger = logging.getLogger(__name__)

# Firebase REST API endpoints
FIREBASE_VERIFY_TOKEN_URL = "https://identitytoolkit.googleapis.com/v1/accounts:lookup"
FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY', 'AIzaSyBMJS7MFdKLisxIhrpG6WEaJOOMBj0sOYc')

# Debug logging
logger.info(f"Firebase API Key loaded: {FIREBASE_API_KEY[:20]}..." if FIREBASE_API_KEY else "No Firebase API Key found")

async def verify_firebase_token_rest(authorization: Optional[str] = Header(default=None)) -> dict:
    """Verify Firebase ID token using REST API"""
    logger.info(f"Verifying Firebase token via REST API. Authorization header present: {authorization is not None}")
    
    if not authorization or not authorization.lower().startswith("bearer "):
        logger.error("No authorization header or invalid format")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ", 1)[1]
    logger.info(f"Extracted token (first 20 chars): {token[:20]}...")
    
    try:
        # Use Firebase REST API to verify the token
        url = f"{FIREBASE_VERIFY_TOKEN_URL}?key={FIREBASE_API_KEY}"
        payload = {
            "idToken": token
        }
        
        response = requests.post(url, json=payload, timeout=10)
        
        if response.status_code != 200:
            logger.error(f"Firebase REST API error: {response.status_code} - {response.text}")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        data = response.json()
        
        if 'users' not in data or len(data['users']) == 0:
            logger.error("No user data in Firebase response")
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_data = data['users'][0]
        logger.info(f"Token verified successfully for user: {user_data.get('localId')}")
        
        # Convert Firebase REST API response to our expected format
        return {
            "uid": user_data.get("localId"),
            "email": user_data.get("email"),
            "name": user_data.get("displayName", user_data.get("email", "").split("@")[0]),
            "picture": user_data.get("photoUrl"),
            "email_verified": user_data.get("emailVerified", False),
            "provider_data": user_data.get("providerUserInfo", [])
        }
        
    except requests.RequestException as e:
        logger.error(f"Network error during token verification: {e}")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    except Exception as e:
        logger.error(f"Token verification error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

def get_user_from_firebase_token_rest(decoded_token: dict) -> dict:
    """Extract user information from decoded Firebase token (REST API version)"""
    user_data = {
        "uid": decoded_token.get("uid"),
        "email": decoded_token.get("email"),
        "name": decoded_token.get("name", decoded_token.get("email", "").split("@")[0]),
        "picture": decoded_token.get("picture"),
        "email_verified": decoded_token.get("email_verified", False)
    }
    
    return user_data
