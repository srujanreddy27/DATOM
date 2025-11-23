import requests
import time

BASE_URL = "http://localhost:8000"
AUTH_CREDENTIALS = ("test@gmail.com", "111111")
TIMEOUT = 30

def authenticate():
    login_url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": AUTH_CREDENTIALS[0],
        "password": AUTH_CREDENTIALS[1]
    }
    response = requests.post(login_url, json=payload, timeout=TIMEOUT)
    response.raise_for_status()
    token = response.json().get("access_token")
    assert token, "No access token received after login"
    return token


def create_task(token):
    url = f"{BASE_URL}/api/tasks"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "title": "Test Task for Partial Approval",
        "description": "Task created for testing file partial approval system.",
        "category": "Testing",
        "budget": 1000,
        "deadline": (int(time.time()) + 3600 * 24 * 7),  # 7 days from now as epoch timestamp
        "skills": ["python", "blockchain", "zkp"],
        "expected_files_count": 2,
        "validation_code": "VALID1234"
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    task = resp.json()
    assert "id" in task, "Created task response missing task ID"
    return task["id"]


def upload_submission(token, task_id):
    url = f"{BASE_URL}/api/submissions"
    headers = {"Authorization": f"Bearer {token}"}

    # Multipart form data fields
    data = {
        "task_id": str(task_id),
        "description": "Submission for partial approval testing"
    }
    # Provide files as a list of tuples
    files_for_requests = [
        ("files", ("file1.txt", b"File content 1", "text/plain")),
        ("files", ("file2.txt", b"File content 2", "text/plain")),
    ]

    resp = requests.post(url, headers=headers, data=data, files=files_for_requests, timeout=TIMEOUT)
    resp.raise_for_status()
    submission = resp.json()
    assert "id" in submission, "Submission response missing submission ID"
    assert "files" in submission and len(submission["files"]) >= 2, "Submission files missing or insufficient"
    return submission


def approve_individual_file(token, submission_id, file_id):
    url = f"{BASE_URL}/api/submissions/{submission_id}/files/{file_id}/approve"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.put(url, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    approval_resp = resp.json()
    assert approval_resp.get("approved") is True or approval_resp.get("status") == "approved", "File not approved"
    return approval_resp


def get_submission(token, submission_id):
    url = f"{BASE_URL}/api/submissions/{submission_id}"
    headers = {"Authorization": f"Bearer {token}"}
    resp = requests.get(url, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    submission = resp.json()
    return submission


def TC009_approve_individual_file_in_submission():
    token = None
    task_id = None
    submission = None
    try:
        token = authenticate()

        # Create a new task to submit files for
        task_id = create_task(token)

        # Upload submission with multiple files
        submission = upload_submission(token, task_id)
        submission_id = submission["id"]
        files = submission["files"]
        assert isinstance(files, list) and len(files) > 0, "Submission should have files"

        # Pick first file to approve
        file_to_approve = files[0]
        file_id = file_to_approve.get("id")
        assert file_id, "File in submission missing file ID"

        # Approve individual file
        approval_response = approve_individual_file(token, submission_id, file_id)

        # Validate approval recorded and proportional payment updated (check response fields)
        assert "payment_amount" in approval_response or "proportional_payment" in approval_response, "Payment info missing after approval"

        # Check submission's file approval status updated
        updated_submission = get_submission(token, submission_id)
        updated_files = updated_submission.get("files", [])
        file_status = None
        for f in updated_files:
            if f.get("id") == file_id:
                file_status = f.get("approval_status")
                break
        assert file_status == "approved", "File approval status not updated in submission"

        # Also check partial payment amount key exists in submission data
        assert "proportional_payment_amount" in updated_submission or "payment_status" in updated_submission or "payment" in updated_submission, "Proportional payment info missing in submission after approval"

    finally:
        # Cleanup: delete the submission and task if created
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        if submission is not None:
            try:
                requests.delete(f"{BASE_URL}/api/submissions/{submission['id']}", headers=headers, timeout=TIMEOUT)
            except Exception:
                pass
        if task_id is not None:
            try:
                requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=headers, timeout=TIMEOUT)
            except Exception:
                pass


TC009_approve_individual_file_in_submission()
