import requests

BASE_URL = "http://localhost:8000"
TIMEOUT = 30

def test_user_login_with_email_password():
    login_url = f"{BASE_URL}/api/auth/login"
    email = "test@gmail.com"
    password = "111111"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "email": email,
        "password": password
    }
    try:
        response = requests.post(login_url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request to login endpoint failed: {e}"

    assert response.status_code == 200, f"Login failed with status code {response.status_code} and body {response.text}"
    resp_json = response.json()
    # Validate presence of JWT token
    assert "token" in resp_json, "Response JSON does not contain 'token'"
    token = resp_json.get("token")
    assert isinstance(token, str) and len(token) > 0, "JWT token is empty or invalid"

    # Validate presence of user role in response if available
    # Assuming API returns e.g. 'role' or 'user' object with role info
    # This must be according to the API. We check common fields:
    assert any(k in resp_json for k in ["role", "user", "roles"]), "Response does not contain role information"

    # Optional: Check token format (JWT tokens have 3 parts separated by dots)
    parts = token.split('.')
    assert len(parts) == 3, "JWT token format invalid"

test_user_login_with_email_password()