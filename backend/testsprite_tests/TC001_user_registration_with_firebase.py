import requests
import uuid

BASE_URL = "http://localhost:8000"
SIGNUP_ENDPOINT = "/api/auth/signup"

def test_user_registration_with_firebase():
    url = BASE_URL + SIGNUP_ENDPOINT
    headers = {
        "Content-Type": "application/json"
    }
    unique_str = str(uuid.uuid4())[:8]
    payload = {
        "username": f"testuser_{unique_str}",
        "email": f"testuser_{unique_str}@example.com",
        "password": "StrongP@ssw0rd123",
        "user_type": "freelancer"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code in (200, 201), f"Unexpected status code: {response.status_code}"
        data = response.json()
        assert "uid" in data, "Response missing expected user identifier 'uid'"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    except ValueError:
        assert False, "Response is not valid JSON"

test_user_registration_with_firebase()
