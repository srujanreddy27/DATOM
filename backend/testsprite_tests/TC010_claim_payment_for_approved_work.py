import requests
import time

BASE_URL = "http://localhost:8000"

TOKEN = "<PLACEHOLDER_FOR_VALID_FIREBASE_JWT_TOKEN>"  # Replace with a valid Firebase JWT token for testing
TIMEOUT = 30

def test_claim_payment_for_approved_work():
    headers = {}
    # Use a valid Firebase JWT access token obtained externally
    token = TOKEN
    assert token and token != "<PLACEHOLDER_FOR_VALID_FIREBASE_JWT_TOKEN>", "Please set a valid Firebase JWT token in TOKEN variable"
    headers["Authorization"] = f"Bearer {token}"

    # Helper function: Create new task (as client) - required for submission
    task_payload = {
        "title": "Test Task For Payment Claim",
        "description": "Task created for testing payment claim after partial approval",
        "category": "testing",
        "budget": 100,
        "deadline": "2030-12-31T23:59:59Z",
        "skills": ["python", "blockchain"],
        "expected_files_count": 1,
        "validation_code": "VALID123"
    }
    task_resp = requests.post(f"{BASE_URL}/api/tasks", json=task_payload, headers=headers, timeout=TIMEOUT)
    assert task_resp.status_code == 201, f"Task creation failed: {task_resp.text}"
    task = task_resp.json()
    task_id = task.get("id") or task.get("task_id")
    assert task_id, "No task_id returned from task creation"

    submission_id = None
    try:
        # Step 2: Upload a file submission as freelancer for the task
        files = {
            "files": ("testfile.txt", b"Test file content for payment claim", "text/plain")
        }
        submission_payload = {
            "task_id": str(task_id),
            "description": "Submission for testing payment claim"
        }
        submit_resp = requests.post(f"{BASE_URL}/api/submissions",
                                    data=submission_payload,
                                    files=files,
                                    headers=headers,
                                    timeout=TIMEOUT)
        assert submit_resp.status_code == 201, f"Submission upload failed: {submit_resp.text}"
        submission = submit_resp.json()
        submission_id = submission.get("id") or submission.get("submission_id")
        assert submission_id, "No submission_id returned from submission upload"

        # Step 3: Approve the submission entirely to simulate approved work
        approve_resp = requests.put(f"{BASE_URL}/api/submissions/{submission_id}/approve",
                                   headers=headers,
                                   timeout=TIMEOUT)
        assert approve_resp.status_code == 200, f"Approving submission failed: {approve_resp.text}"

        # Step 4: Claim payment for the approved submission providing wallet address and dummy tx hash
        claim_payload = {
            "submission_id": submission_id,
            "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
            "transaction_hash": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef"
        }
        claim_resp = requests.post(f"{BASE_URL}/api/payments/claim",
                                  json=claim_payload,
                                  headers=headers,
                                  timeout=TIMEOUT)
        assert claim_resp.status_code == 200, f"Payment claim failed: {claim_resp.text}"
        claim_data = claim_resp.json()
        assert "status" in claim_data, "No status key in payment claim response"
        assert claim_data["status"] in ["pending", "processed", "success"], \
            f"Unexpected payment claim status: {claim_data['status']}"

        # Step 5: Optionally confirm payment claim status by retrieving it
        status_resp = requests.get(f"{BASE_URL}/api/submissions/{submission_id}/payment-status",
                                   headers=headers,
                                   timeout=TIMEOUT)
        assert status_resp.status_code == 200, f"Payment status check failed: {status_resp.text}"
        status_data = status_resp.json()
        assert "payment_claimed" in status_data, "Payment status response missing 'payment_claimed'"
        assert isinstance(status_data["payment_claimed"], bool), "'payment_claimed' should be boolean"

    finally:
        # Cleanup: Delete submission if created
        if submission_id:
            try:
                requests.delete(f"{BASE_URL}/api/submissions/{submission_id}",
                                headers=headers,
                                timeout=TIMEOUT)
            except Exception:
                pass
        # Cleanup: Delete task if created
        if task_id:
            try:
                requests.delete(f"{BASE_URL}/api/tasks/{task_id}",
                                headers=headers,
                                timeout=TIMEOUT)
            except Exception:
                pass

test_claim_payment_for_approved_work()
