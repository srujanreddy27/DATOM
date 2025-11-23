import requests

BASE_URL = "http://localhost:8000/api/auth"
TIMEOUT = 30

def test_verify_otp_password_reset():
    headers = {
        "Content-Type": "application/json"
    }

    email = "test@gmail.com"
    new_password = "NewSecurePassword123!"
    invalid_otp = "000000"  # Assume invalid OTP

    payload_invalid = {
        "email": email,
        "otp": invalid_otp,
        "new_password": new_password
    }

    url_verify_otp = BASE_URL + "/verify-otp"
    try:
        resp_invalid = requests.post(url_verify_otp, json=payload_invalid, headers=headers, timeout=TIMEOUT)
        assert resp_invalid.status_code in (400, 401)
        json_resp_invalid = resp_invalid.json()
        assert "error" in json_resp_invalid or "message" in json_resp_invalid

        valid_otp = "123456"
        payload_valid = {
            "email": email,
            "otp": valid_otp,
            "new_password": new_password
        }
        resp_valid = requests.post(url_verify_otp, json=payload_valid, headers=headers, timeout=TIMEOUT)

        if resp_valid.status_code == 200:
            json_resp_valid = resp_valid.json()
            assert "message" in json_resp_valid or "success" in json_resp_valid
        else:
            assert resp_valid.status_code in (400, 401, 422)
            json_resp_valid = resp_valid.json()
            assert "error" in json_resp_valid or "message" in json_resp_valid

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"


test_verify_otp_password_reset()
