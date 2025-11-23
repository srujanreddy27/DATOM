"""
Rate limiting middleware for API protection
"""
import time
from collections import defaultdict
from fastapi import HTTPException, Request
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, list] = defaultdict(list)
    
    def is_allowed(self, identifier: str) -> Tuple[bool, int]:
        """
        Check if request is allowed
        Returns: (is_allowed, remaining_requests)
        """
        now = time.time()
        minute_ago = now - 60
        
        # Clean old requests
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier]
            if req_time > minute_ago
        ]
        
        # Check limit
        if len(self.requests[identifier]) >= self.requests_per_minute:
            return False, 0
        
        # Add current request
        self.requests[identifier].append(now)
        remaining = self.requests_per_minute - len(self.requests[identifier])
        
        return True, remaining

# Global rate limiter instances
auth_limiter = RateLimiter(requests_per_minute=10)  # Strict for auth endpoints
api_limiter = RateLimiter(requests_per_minute=60)   # General API

async def rate_limit_auth(request: Request):
    """Rate limit authentication endpoints"""
    client_ip = request.client.host
    allowed, remaining = auth_limiter.is_allowed(client_ip)
    
    if not allowed:
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        raise HTTPException(
            status_code=429,
            detail="Too many authentication attempts. Please try again later."
        )
    
    return remaining

async def rate_limit_api(request: Request):
    """Rate limit general API endpoints"""
    client_ip = request.client.host
    allowed, remaining = api_limiter.is_allowed(client_ip)
    
    if not allowed:
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please slow down."
        )
    
    return remaining