import requests
import json
import time

BASE_URL = "http://localhost:8000/api"

print("--- Testing Anti-Abuse Logic ---")

# 1. Test Normal Task
normal_task_payload = {
    "title": "Normal Task",
    "description": "Just a normal task",
    "budget": 50,
    "expected_files_count": 10,  # $5.00 per file (Above $0.50 threshold)
    "client": "TestClient_Normal",
    "category": "Development",
    "skills": ["Python"],
    "deadline": "2030-01-01"
}

print("\n1. Submitting a Normal Task (Budget/Files = 5.00)")
try:
    res1 = requests.post(f"{BASE_URL}/tasks", json=normal_task_payload)
    if res1.status_code == 200:
        task_data = res1.json()
        print(f"✅ Success! Rating assigned: {task_data.get('client_rating')}")
        assert task_data.get('client_rating', 5.0) >= 4.0, "Rating shouldn't be penalized"
    else:
        print(f"❌ Failed: {res1.text}")
except Exception as e:
    print(f"Error testing normal task: {e}")


# 2. Test Abusive Task
abusive_task_payload = {
    "title": "Abusive Task",
    "description": "I need 1 million images for 1 dollar",
    "budget": 1.0,
    "expected_files_count": 100,  # $0.01 per file, clearly abusive
    "client": "TestClient_Greedy",
    "category": "Design",
    "skills": ["Photoshop"],
    "deadline": "2030-01-01"
}

print("\n2. Submitting an Abusive Task (Budget/Files = 0.01)")
try:
    res2 = requests.post(f"{BASE_URL}/tasks", json=abusive_task_payload)
    if res2.status_code == 200:
        task_data = res2.json()
        rating = task_data.get('client_rating')
        print(f"✅ Created successfully, but rating assigned: {rating}")
        if rating and rating <= 2.0:
            print("🎉 Anti-abuse logic hit successfully! The greedy client got a low rating defaults to 2.0")
        else:
            print("❌ Anti-abuse logic FAILED! The greedy client didn't get penalized.")
    else:
        print(f"❌ Failed: {res2.text}")
except Exception as e:
    print(f"Error testing abusive task: {e}")

print("\n--- Testing Complete ---")
