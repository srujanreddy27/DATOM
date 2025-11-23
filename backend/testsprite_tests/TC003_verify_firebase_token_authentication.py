import requests

BASE_URL = "http://localhost:8000"
VERIFY_ENDPOINT = "/api/auth/firebase/verify"
LOGIN_ENDPOINT = "/api/auth/login"
TIMEOUT = 30

def test_verify_firebase_token_authentication():
    try:
        # First, login to get a valid Firebase token via email/password
        login_payload = {
            "email": "test@gmail.com",
            "password": "111111"
        }
        login_resp = requests.post(
            BASE_URL + LOGIN_ENDPOINT,
            json=login_payload,
            timeout=TIMEOUT,
            headers={"Content-Type": "application/json"}
        )
        assert login_resp.status_code == 200
        login_data = login_resp.json()
        token = login_data.get("access_token") or login_data.get("token")
        assert token and isinstance(token, str), "Token not found in login response"

        # Test valid token verification
        headers = {
            "Authorization": f"Bearer {token}"
        }
        verify_resp = requests.post(
            BASE_URL + VERIFY_ENDPOINT,
            headers=headers,
            timeout=TIMEOUT
        )
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        # The response should indicate the token is valid and include role/access info
        assert verify_data.get("valid") is True or verify_data.get("success") is True, "Token verification failed"
        # Check role-based access field exists and is valid only if token is valid
        assert "role" in verify_data and verify_data["role"] in ["client", "freelancer"], "Role missing or invalid"

        # Test with invalid token (random string)
        headers_invalid = {
            "Authorization": "Bearer invalidtoken123"
        }
        invalid_resp = requests.post(
            BASE_URL + VERIFY_ENDPOINT,
            headers=headers_invalid,
            timeout=TIMEOUT
        )
        assert invalid_resp.status_code in [401, 403], "Invalid token did not return proper error code"
        invalid_data = invalid_resp.json()
        assert invalid_data.get("valid") is False or invalid_data.get("error") or invalid_data.get("message"), "Invalid token error message missing"

        # Test missing Authorization header
        no_auth_resp = requests.post(
            BASE_URL + VERIFY_ENDPOINT,
            timeout=TIMEOUT
        )
        assert no_auth_resp.status_code in [401, 403], "Missing auth header did not return proper error code"
        no_auth_data = no_auth_resp.json()
        assert no_auth_data.get("error") or no_auth_data.get("message"), "Missing auth error message missing"
    except requests.RequestException as e:
        assert False, f"Request failed with exception: {e}"

test_verify_firebase_token_authentication()