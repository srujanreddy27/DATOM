import requests
import sys
import json
from datetime import datetime, timezone
import uuid

class DecentraTaskAPITester:
    def __init__(self, base_url="https://chainoutsource.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_resources = {
            'users': [],
            'tasks': [],
            'applications': [],
            'escrow': []
        }

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, dict) and 'id' in response_data:
                        print(f"   Created resource ID: {response_data['id']}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_create_users(self):
        """Create test users"""
        users_data = [
            {
                "username": f"client_user_{datetime.now().strftime('%H%M%S')}",
                "email": f"client_{datetime.now().strftime('%H%M%S')}@test.com",
                "user_type": "client"
            },
            {
                "username": f"freelancer_user_{datetime.now().strftime('%H%M%S')}",
                "email": f"freelancer_{datetime.now().strftime('%H%M%S')}@test.com",
                "user_type": "freelancer"
            }
        ]
        
        for user_data in users_data:
            success, response = self.run_test(
                f"Create {user_data['user_type']} User",
                "POST",
                "users",
                200,
                data=user_data
            )
            if success and 'id' in response:
                self.created_resources['users'].append(response)
        
        return len(self.created_resources['users']) >= 2

    def test_get_users(self):
        """Test getting users"""
        success, response = self.run_test(
            "Get All Users",
            "GET",
            "users",
            200
        )
        
        if success and self.created_resources['users']:
            # Test getting specific user
            user_id = self.created_resources['users'][0]['id']
            success2, response2 = self.run_test(
                "Get Specific User",
                "GET",
                f"users/{user_id}",
                200
            )
            return success and success2
        
        return success

    def test_create_tasks(self):
        """Create test tasks"""
        if not self.created_resources['users']:
            print("❌ No users available for task creation")
            return False
            
        client_user = next((u for u in self.created_resources['users'] if u['user_type'] == 'client'), None)
        if not client_user:
            print("❌ No client user available for task creation")
            return False

        tasks_data = [
            {
                "title": "Test ML Training Task",
                "description": "Need help with machine learning model training",
                "category": "AI/ML",
                "budget": 500.0,
                "deadline": "2024-03-15",
                "client": client_user['username'],
                "skills": ["Python", "TensorFlow", "Machine Learning"]
            },
            {
                "title": "Smart Contract Development",
                "description": "Develop and audit smart contracts for DeFi protocol",
                "category": "Blockchain",
                "budget": 2500.0,
                "deadline": "2024-03-20",
                "client": client_user['username'],
                "skills": ["Solidity", "Web3", "Smart Contracts"]
            }
        ]
        
        for task_data in tasks_data:
            success, response = self.run_test(
                f"Create Task: {task_data['title']}",
                "POST",
                "tasks",
                200,
                data=task_data
            )
            if success and 'id' in response:
                self.created_resources['tasks'].append(response)
        
        return len(self.created_resources['tasks']) >= 2

    def test_get_tasks(self):
        """Test getting tasks with filtering"""
        # Test get all tasks
        success1, response1 = self.run_test(
            "Get All Tasks",
            "GET",
            "tasks",
            200
        )
        
        # Test filter by category
        success2, response2 = self.run_test(
            "Get Tasks by Category",
            "GET",
            "tasks",
            200,
            params={"category": "AI/ML"}
        )
        
        # Test filter by status
        success3, response3 = self.run_test(
            "Get Tasks by Status",
            "GET",
            "tasks",
            200,
            params={"status": "open"}
        )
        
        # Test get specific task
        if self.created_resources['tasks']:
            task_id = self.created_resources['tasks'][0]['id']
            success4, response4 = self.run_test(
                "Get Specific Task",
                "GET",
                f"tasks/{task_id}",
                200
            )
            return success1 and success2 and success3 and success4
        
        return success1 and success2 and success3

    def test_task_status_update(self):
        """Test updating task status"""
        if not self.created_resources['tasks']:
            print("❌ No tasks available for status update")
            return False
            
        task_id = self.created_resources['tasks'][0]['id']
        success, response = self.run_test(
            "Update Task Status",
            "PUT",
            f"tasks/{task_id}/status?status=in_progress",
            200
        )
        return success

    def test_create_applications(self):
        """Test creating task applications"""
        if not self.created_resources['tasks'] or not self.created_resources['users']:
            print("❌ No tasks or users available for application creation")
            return False
            
        freelancer_user = next((u for u in self.created_resources['users'] if u['user_type'] == 'freelancer'), None)
        if not freelancer_user:
            print("❌ No freelancer user available for application creation")
            return False

        task = self.created_resources['tasks'][0]
        application_data = {
            "task_id": task['id'],
            "freelancer_id": freelancer_user['id'],
            "proposal": "I have extensive experience in ML and can complete this task efficiently.",
            "bid_amount": 450.0,
            "estimated_completion": "2024-03-10"
        }
        
        success, response = self.run_test(
            "Create Task Application",
            "POST",
            "applications",
            200,
            data=application_data
        )
        
        if success and 'id' in response:
            self.created_resources['applications'].append(response)
        
        return success

    def test_get_applications(self):
        """Test getting applications"""
        if not self.created_resources['applications']:
            print("❌ No applications available for testing")
            return False
            
        application = self.created_resources['applications'][0]
        
        # Test get applications by task
        success1, response1 = self.run_test(
            "Get Applications by Task",
            "GET",
            f"applications/task/{application['task_id']}",
            200
        )
        
        # Test get applications by user
        success2, response2 = self.run_test(
            "Get Applications by User",
            "GET",
            f"applications/user/{application['freelancer_id']}",
            200
        )
        
        return success1 and success2

    def test_create_escrow(self):
        """Test creating escrow transaction"""
        if not self.created_resources['tasks'] or not self.created_resources['users']:
            print("❌ No tasks or users available for escrow creation")
            return False
            
        task = self.created_resources['tasks'][0]
        client_user = next((u for u in self.created_resources['users'] if u['user_type'] == 'client'), None)
        freelancer_user = next((u for u in self.created_resources['users'] if u['user_type'] == 'freelancer'), None)
        
        if not client_user or not freelancer_user:
            print("❌ Missing client or freelancer user for escrow creation")
            return False

        success, response = self.run_test(
            "Create Escrow Transaction",
            "POST",
            f"escrow?task_id={task['id']}&client_id={client_user['id']}&freelancer_id={freelancer_user['id']}&amount={task['budget']}",
            200
        )
        
        if success and 'id' in response:
            self.created_resources['escrow'].append(response)
        
        return success

    def test_get_escrow(self):
        """Test getting escrow transaction"""
        if not self.created_resources['escrow']:
            print("❌ No escrow transactions available for testing")
            return False
            
        escrow_id = self.created_resources['escrow'][0]['id']
        success, response = self.run_test(
            "Get Escrow Transaction",
            "GET",
            f"escrow/{escrow_id}",
            200
        )
        return success

    def test_release_escrow(self):
        """Test releasing escrow with ZKP"""
        if not self.created_resources['escrow']:
            print("❌ No escrow transactions available for release testing")
            return False
            
        escrow_id = self.created_resources['escrow'][0]['id']
        zkp_hash = f"zkp_hash_{uuid.uuid4().hex[:16]}"
        
        success, response = self.run_test(
            "Release Escrow with ZKP",
            "PUT",
            f"escrow/{escrow_id}/release?zkp_hash={zkp_hash}",
            200
        )
        return success

    def test_analytics(self):
        """Test analytics endpoint"""
        success, response = self.run_test(
            "Get Platform Analytics",
            "GET",
            "analytics/stats",
            200
        )
        
        if success and isinstance(response, dict):
            expected_keys = ['total_tasks', 'active_tasks', 'total_users', 'total_earnings', 'success_rate']
            has_all_keys = all(key in response for key in expected_keys)
            if has_all_keys:
                print(f"   Analytics data: {response}")
            else:
                print(f"   Missing keys in analytics response: {set(expected_keys) - set(response.keys())}")
            return has_all_keys
        
        return success

def main():
    print("🚀 Starting DecentraTask API Testing...")
    print("=" * 60)
    
    tester = DecentraTaskAPITester()
    
    # Test sequence
    test_results = []
    
    # Basic connectivity
    test_results.append(tester.test_root_endpoint())
    
    # User management
    test_results.append(tester.test_create_users())
    test_results.append(tester.test_get_users())
    
    # Task management
    test_results.append(tester.test_create_tasks())
    test_results.append(tester.test_get_tasks())
    test_results.append(tester.test_task_status_update())
    
    # Application system
    test_results.append(tester.test_create_applications())
    test_results.append(tester.test_get_applications())
    
    # Escrow system
    test_results.append(tester.test_create_escrow())
    test_results.append(tester.test_get_escrow())
    test_results.append(tester.test_release_escrow())
    
    # Analytics
    test_results.append(tester.test_analytics())
    
    # Print final results
    print("\n" + "=" * 60)
    print(f"📊 FINAL RESULTS:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed. Check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())