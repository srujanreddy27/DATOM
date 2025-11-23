import requests
from requests.auth import HTTPBasicAuth
import io

BASE_URL = "http://localhost:8000"
AUTH_ENDPOINT = "/api/auth/login"
TASKS_ENDPOINT = "/api/tasks"
SUBMISSIONS_ENDPOINT = "/api/submissions"
USERNAME = "test@gmail.com"
PASSWORD = "111111"
TIMEOUT = 30


def get_auth_token():
    url = f"{BASE_URL}/api/auth/login"
    data = {"email": USERNAME, "password": PASSWORD}
    response = requests.post(url, json=data, timeout=TIMEOUT)
    response.raise_for_status()
    json_resp = response.json()
    token = json_resp.get("access_token") or json_resp.get("token")
    if not token:
        raise Exception("Authentication failed: no token returned")
    return token


def create_task(auth_token):
    url = f"{BASE_URL}{TASKS_ENDPOINT}"
    task_data = {
        "title": "Test Task for File Submission",
        "description": "Task created for testing file upload submissions.",
        "category": "Testing",
        "budget": 1000,
        "deadline": "2030-01-01T00:00:00Z",
        "skills": ["python", "api", "testing"],
        "expected_files_count": 2,
        "validation_code": "VALID123"
    }
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.post(url, json=task_data, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()["id"] if "id" in response.json() else response.json().get("task_id")


def delete_task(task_id, auth_token):
    url = f"{BASE_URL}{TASKS_ENDPOINT}/{task_id}"
    headers = {"Authorization": f"Bearer {auth_token}"}
    response = requests.delete(url, headers=headers, timeout=TIMEOUT)
    # May not raise if delete not implemented, ignore errors here
    return response.status_code


def test_TC007_upload_files_with_submission():
    auth_token = get_auth_token()
    headers = {"Authorization": f"Bearer {auth_token}"}

    task_id = None
    try:
        # Create a task to attach submission files to
        task_id = create_task(auth_token)
        assert task_id, "Failed to create a task to upload submission files"

        url = f"{BASE_URL}/api/submissions"
        # Prepare multipart form data
        # Files - create two small dummy files, one allowed type (txt), one allowed type (png)
        file1_content = b"Hello world: this is test file 1."
        file2_content = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00"
        files = [
            ("files", ("test1.txt", io.BytesIO(file1_content), "text/plain")),
            ("files", ("image1.png", io.BytesIO(file2_content), "image/png")),
        ]
        data = {
            "task_id": str(task_id),
            "description": "Submission with multiple files for TC007 test"
        }
        response = requests.post(
            url,
            headers=headers,
            files=files,
            data=data,
            timeout=TIMEOUT,
        )

        # Validate response status and schema
        assert response.status_code == 201 or response.status_code == 200, f"Unexpected status code: {response.status_code}"

        resp_json = response.json()
        # At minimum, expect submission id or similar confirmation
        assert "submission_id" in resp_json or "id" in resp_json, "Response missing submission identifier"

        # Validate files are accepted and metadata returned
        submitted_files = resp_json.get("files") or []
        assert len(submitted_files) == 2, f"Expected 2 files in response, got {len(submitted_files)}"

        # Validate file size constraints (no file > 50MB, we used tiny files)
        for f in submitted_files:
            assert "size" in f and f["size"] <= 50 * 1024 * 1024, "File size exceeds limit or missing"

        # Validate file types allowed - simple check content-type presence
        for f in submitted_files:
            assert "content_type" in f, "File content_type missing in response"

        # Optionally, check that files stored securely (e.g. presence of secure URL or token)
        for f in submitted_files:
            assert "secure_url" in f or "file_path" in f or "download_token" in f, "File security info missing"

    finally:
        # Cleanup: delete task to remove submissions linked
        if task_id:
            try:
                delete_task(task_id, auth_token)
            except Exception:
                pass


test_TC007_upload_files_with_submission()