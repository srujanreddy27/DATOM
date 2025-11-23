import requests
from requests.auth import HTTPBasicAuth

BASE_URL = "http://localhost:8000"
TIMEOUT = 30
AUTH_USERNAME = "test@gmail.com"
AUTH_PASSWORD = "111111"

def test_send_password_reset_email():
    url = f"{BASE_URL}/api/auth/forgot-password"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {
        "email": AUTH_USERNAME
    }
    try:
        # Use basic token auth as per instructions
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            auth=HTTPBasicAuth(AUTH_USERNAME, AUTH_PASSWORD),
            timeout=TIMEOUT
        )
        # Validate success response
        assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
        json_response = response.json()
        # Assert response contains indication of email sent status
        assert "message" in json_response or "success" in json_response, "Response missing confirmation message"
        msg = json_response.get("message") or json_response.get("success")
        assert isinstance(msg, str) and len(msg) > 0, "Empty confirmation message"
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_send_password_reset_email()