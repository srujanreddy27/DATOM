import requests
import base64
import json
import traceback

BASE_URL = "http://localhost:8000/api"
AUTH_USERNAME = "test@gmail.com"
AUTH_PASSWORD = "111111"
TIMEOUT = 30

def basic_auth_header(username: str, password: str) -> dict:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}

def create_task(headers):
    payload = {
        "title": "Test Task for ZKP Generation",
        "description": "Task description for zero knowledge proof generation test.",
        "category": "Testing",
        "budget": 1000,
        "deadline": "2030-12-31T23:59:59Z",
        "skills": ["crypto", "python", "zkp"],
        "expected_files_count": 1,
        "validation_code": "VALID123"  # Required field added
    }
    resp = requests.post(f"{BASE_URL}/tasks", headers=headers, json=payload, timeout=TIMEOUT)
    resp.raise_for_status()
    task_data = resp.json()
    assert "id" in task_data, "Task creation response missing 'id'"
    return task_data["id"]

def upload_submission(headers, task_id):
    files = {
        "files": ("testfile.txt", b"Dummy file content for ZKP test", "text/plain")
    }
    data = {
        "task_id": str(task_id),
        "description": "Submission for ZKP generation test"
    }
    resp = requests.post(f"{BASE_URL}/submissions", headers=headers, files=files, data=data, timeout=TIMEOUT)
    resp.raise_for_status()
    submission_data = resp.json()
    assert "id" in submission_data, "Submission creation response missing 'id'"
    return submission_data["id"]

def generate_zkp(headers, submission_id):
    resp = requests.post(f"{BASE_URL}/submissions/{submission_id}/generate-zkp", headers=headers, timeout=TIMEOUT)
    if resp.status_code == 404:
        raise Exception("Submission not found for ZKP generation")
    resp.raise_for_status()
    zkp_result = resp.json()
    # Validate expected fields in ZKP result indicating Pedersen Commitments and Schnorr proofs data
    assert isinstance(zkp_result, dict), "ZKP generation result is not a dict"
    assert "pedersen_commitment" in zkp_result, "Missing pedersen_commitment in ZKP result"
    assert "schnorr_proof" in zkp_result, "Missing schnorr_proof in ZKP result"
    # Example simple fields checks
    assert isinstance(zkp_result["pedersen_commitment"], str), "pedersen_commitment is not a string"
    assert isinstance(zkp_result["schnorr_proof"], dict), "schnorr_proof is not a dict"
    # schnorr_proof content validation (basic)
    schnorr = zkp_result["schnorr_proof"]
    assert "challenge" in schnorr and isinstance(schnorr["challenge"], str), "Invalid schnorr_proof challenge"
    assert "response" in schnorr and isinstance(schnorr["response"], str), "Invalid schnorr_proof response"

def delete_task(headers, task_id):
    # Assuming a delete endpoint exists for cleanup; if not, ignore or implement differently
    try:
        resp = requests.delete(f"{BASE_URL}/tasks/{task_id}", headers=headers, timeout=TIMEOUT)
        if resp.status_code not in (200, 204, 404):
            resp.raise_for_status()
    except Exception:
        pass  # Best effort cleanup

def test_TC008_generate_zero_knowledge_proof_for_file_validation():
    headers = basic_auth_header(AUTH_USERNAME, AUTH_PASSWORD)
    task_id = None
    submission_id = None
    try:
        # Create a new task
        task_id = create_task(headers)

        # Upload a submission file for the created task
        submission_id = upload_submission(headers, task_id)

        # Generate zero-knowledge proof for the submission
        generate_zkp(headers, submission_id)
    except Exception:
        traceback.print_exc()
        assert False, "Test TC008 failed due to exception."
    finally:
        # Cleanup: delete created task to avoid polluting test data
        if task_id:
            delete_task(headers, task_id)

test_TC008_generate_zero_knowledge_proof_for_file_validation()