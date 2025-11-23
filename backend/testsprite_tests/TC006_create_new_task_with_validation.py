import requests
from requests.auth import HTTPBasicAuth
import datetime

BASE_URL = "http://localhost:8000/api"
TASKS_ENDPOINT = f"{BASE_URL}/tasks"
AUTH_LOGIN_ENDPOINT = f"{BASE_URL}/auth/login"
USERNAME = "test@gmail.com"
PASSWORD = "111111"
TIMEOUT = 30

def test_create_new_task_with_validation():
    # Authenticate and get token
    auth_resp = requests.post(
        AUTH_LOGIN_ENDPOINT,
        json={"email": USERNAME, "password": PASSWORD},
        timeout=TIMEOUT
    )
    assert auth_resp.status_code == 200, f"Authentication failed: {auth_resp.text}"
    auth_data = auth_resp.json()
    token = auth_data.get("access_token") or auth_data.get("token")
    assert token, "No token received in login response"

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Prepare task data
    future_date = (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat() + "Z"
    task_payload = {
        "title": "Test Task Title",
        "description": "This is a test description for task creation with validation.",
        "category": "Development",
        "budget": 1500.00,
        "deadline": future_date,
        "skills": ["python", "blockchain", "zkp"],
        "expected_files_count": 3,
        "validation_code": "VAL123ABC"
    }

    created_task_id = None

    try:
        # Create task
        resp = requests.post(
            TASKS_ENDPOINT,
            headers=headers,
            json=task_payload,
            timeout=TIMEOUT
        )
        assert resp.status_code == 201, f"Failed to create task: {resp.status_code} {resp.text}"

        task_data = resp.json()
        created_task_id = task_data.get("id") or task_data.get("task_id")
        assert created_task_id, "Created task ID not returned"

        # Validate returned data matches sent data
        assert task_data.get("title") == task_payload["title"], "Title mismatch"
        assert task_data.get("description") == task_payload["description"], "Description mismatch"
        assert task_data.get("category") == task_payload["category"], "Category mismatch"
        assert float(task_data.get("budget")) == task_payload["budget"], "Budget mismatch"
        assert task_data.get("deadline").startswith(task_payload["deadline"][:10]), "Deadline mismatch"
        assert set(task_data.get("skills", [])) == set(task_payload["skills"]), "Skills mismatch"
        assert int(task_data.get("expected_files_count")) == task_payload["expected_files_count"], "Expected files count mismatch"
        assert task_data.get("validation_code") == task_payload["validation_code"], "Validation code mismatch"

        # Test error case: missing required field (title)
        invalid_payload = task_payload.copy()
        invalid_payload.pop("title")
        error_resp = requests.post(
            TASKS_ENDPOINT,
            headers=headers,
            json=invalid_payload,
            timeout=TIMEOUT
        )
        assert error_resp.status_code == 422 or error_resp.status_code == 400, "Expected validation error for missing title"

    finally:
        # Cleanup: delete the created task if exists
        if created_task_id:
            del_resp = requests.delete(
                f"{TASKS_ENDPOINT}/{created_task_id}",
                headers=headers,
                timeout=TIMEOUT
            )
            # It's not critical to assert delete here, but log if failed
            if del_resp.status_code not in (200, 204):
                print(f"Warning: Failed to delete task {created_task_id}: {del_resp.status_code} {del_resp.text}")

test_create_new_task_with_validation()