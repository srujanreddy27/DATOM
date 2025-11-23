"""
Hybrid Firebase authentication that tries Admin SDK first, then falls back to REST API
"""

import logging
from typing import Optional
from fastapi import HTTPException, Header

logger = logging.getLogger(__name__)

async def verify_firebase_token_hybrid(authorization: Optional[str] = Header(default=None)) -> dict:
    """
    Verify Firebase token using hybrid approach:
    1. Try Firebase Admin SDK first (more secure, better validation)
    2. Fall back to REST API if Admin SDK fails
    """
    logger.info("Starting hybrid Firebase token verification")
    
    if not authorization or not authorization.lower().startswith("bearer "):
        logger.error("No authorization header or invalid format")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ", 1)[1]
    logger.info("Token extracted for verification")
    
    # Try Firebase Admin SDK first
    try:
        from firebase_auth import verify_firebase_token, get_user_from_firebase_token
        logger.info("Attempting Firebase Admin SDK verification...")
        decoded_token = await verify_firebase_token(authorization)
        firebase_user = get_user_from_firebase_token(decoded_token)
        logger.info("✅ Firebase Admin SDK verification successful")
        return firebase_user
    except Exception as admin_error:
        logger.warning(f"Firebase Admin SDK verification failed: {admin_error}")
        logger.info("Falling back to REST API verification...")
        
        # Fall back to REST API
        try:
            from firebase_rest_auth import verify_firebase_token_rest, get_user_from_firebase_token_rest
            decoded_token = await verify_firebase_token_rest(authorization)
            firebase_user = get_user_from_firebase_token_rest(decoded_token)
            logger.info("✅ Firebase REST API verification successful")
            return firebase_user
        except Exception as rest_error:
            logger.error(f"Firebase REST API verification also failed: {rest_error}")
            raise HTTPException(
                status_code=401, 
                detail=f"Token verification failed with both methods. Admin SDK: {str(admin_error)[:100]}, REST API: {str(rest_error)[:100]}"
            )