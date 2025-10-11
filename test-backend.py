#!/usr/bin/env python3
"""
Backend Connection Test Script
Tests if the DecentraTask backend server is running and accessible
"""

import requests
import sys
import time

def test_backend_connection():
    """Test if the backend server is accessible"""
    base_url = "http://localhost:8000"
    
    print("🔍 Testing backend connection...")
    print(f"   Testing URL: {base_url}")
    print()
    
    try:
        # Test basic API endpoint
        print("1. Testing API root endpoint...")
        response = requests.get(f"{base_url}/api/", timeout=5)
        if response.status_code == 200:
            print("   ✅ API root endpoint is accessible")
            print(f"   Response: {response.json()}")
        else:
            print(f"   ❌ API root endpoint returned status {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("   ❌ Connection failed - server is not running")
        print("   💡 Solution: Start the backend server first")
        return False
    except requests.exceptions.Timeout:
        print("   ❌ Request timed out - server might be slow")
        return False
    except Exception as e:
        print(f"   ❌ Unexpected error: {e}")
        return False
    
    print()
    
    try:
        # Test auth endpoints
        print("2. Testing authentication endpoints...")
        
        # Test Google OAuth endpoint
        response = requests.get(f"{base_url}/api/auth/google/login", timeout=5)
        if response.status_code == 500:
            print("   ⚠️  Google OAuth endpoint accessible but not configured")
            print("   💡 Solution: Set up Google OAuth credentials in .env file")
        elif response.status_code in [200, 302]:
            print("   ✅ Google OAuth endpoint is working")
        else:
            print(f"   ❌ Google OAuth endpoint returned status {response.status_code}")
            
        # Test auth me endpoint (should return 401 without token)
        response = requests.get(f"{base_url}/api/auth/me", timeout=5)
        if response.status_code == 401:
            print("   ✅ Auth me endpoint is working (correctly requires authentication)")
        else:
            print(f"   ⚠️  Auth me endpoint returned status {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error testing auth endpoints: {e}")
        return False
    
    print()
    print("🎉 Backend server is running and accessible!")
    print("   You can now use the login page with Google OAuth")
    return True

if __name__ == "__main__":
    success = test_backend_connection()
    if not success:
        print()
        print("🚀 To start the backend server:")
        print("   Windows: Run start-backend.bat")
        print("   Linux/Mac: Run ./start-backend.sh")
        print("   Manual: cd backend && python -m uvicorn server:app --reload")
        sys.exit(1)
    else:
        sys.exit(0)
