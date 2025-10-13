import os
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import firebase_admin
from firebase_admin import firestore
# from firebase_auth import initialize_firebase

logger = logging.getLogger(__name__)

# Firebase Admin SDK initialization disabled for development - using memory storage
# initialize_firebase()

def get_firestore_client():
    """Get Firestore client"""
    try:
        return firestore.client()
    except Exception as e:
        logger.error(f"Failed to get Firestore client: {e}")
        return None

# Collections
USERS_COLLECTION = 'users'
TASKS_COLLECTION = 'tasks'
APPLICATIONS_COLLECTION = 'applications'
AUTH_USERS_COLLECTION = 'auth_users'
ESCROW_TRANSACTIONS_COLLECTION = 'escrow_transactions'

class FirebaseDB:
    def __init__(self):
        self.db = get_firestore_client()
        self.use_memory = self.db is None
        # In-memory fallback stores
        self.memory_tasks = []
        self.memory_users = []
        self.memory_applications = []
        self.memory_auth_users = []
        self.memory_escrow_transactions = []
        
        if self.use_memory:
            logger.warning("Using in-memory storage as Firestore is not available")
        else:
            logger.info("Using Firebase Firestore for data storage")

    def prepare_for_firestore(self, data):
        """Prepare data for Firestore storage"""
        if isinstance(data, dict):
            prepared = {}
            for key, value in data.items():
                if isinstance(value, datetime):
                    prepared[key] = value
                elif isinstance(value, dict):
                    prepared[key] = self.prepare_for_firestore(value)
                elif isinstance(value, list):
                    prepared[key] = [self.prepare_for_firestore(item) if isinstance(item, dict) else item for item in value]
                else:
                    prepared[key] = value
            return prepared
        return data

    # User operations
    async def save_user(self, user_data: dict) -> bool:
        """Save user to Firestore"""
        try:
            if self.db:
                prepared_data = self.prepare_for_firestore(user_data)
                doc_ref = self.db.collection(USERS_COLLECTION).document(user_data['id'])
                doc_ref.set(prepared_data)
                logger.info(f"User saved to Firestore: {user_data['id']}")
                return True
            else:
                # Fallback to memory
                self.memory_users.append(user_data)
                logger.info(f"User saved to memory: {user_data['id']}")
                return True
        except Exception as e:
            logger.error(f"Failed to save user: {e}")
            return False

    async def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Get user by ID"""
        try:
            if self.db:
                doc_ref = self.db.collection(USERS_COLLECTION).document(user_id)
                doc = doc_ref.get()
                if doc.exists:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for user in self.memory_users:
                    if user.get('id') == user_id:
                        return user
                return None
        except Exception as e:
            logger.error(f"Failed to get user by ID: {e}")
            return None

    async def get_user_by_email(self, email: str) -> Optional[dict]:
        """Get user by email"""
        try:
            if self.db:
                users_ref = self.db.collection(USERS_COLLECTION)
                query = users_ref.where('email', '==', email.lower()).limit(1)
                docs = query.stream()
                for doc in docs:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for user in self.memory_users:
                    if user.get('email', '').lower() == email.lower():
                        return user
                return None
        except Exception as e:
            logger.error(f"Failed to get user by email: {e}")
            return None

    async def get_user_by_firebase_uid(self, firebase_uid: str) -> Optional[dict]:
        """Get user by Firebase UID"""
        try:
            if self.db:
                users_ref = self.db.collection(USERS_COLLECTION)
                query = users_ref.where('firebase_uid', '==', firebase_uid).limit(1)
                docs = query.stream()
                for doc in docs:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for user in self.memory_users:
                    if user.get('firebase_uid') == firebase_uid:
                        return user
                return None
        except Exception as e:
            logger.error(f"Failed to get user by Firebase UID: {e}")
            return None

    async def update_user(self, user_id: str, update_data: dict) -> bool:
        """Update user data"""
        try:
            if self.db:
                doc_ref = self.db.collection(USERS_COLLECTION).document(user_id)
                prepared_data = self.prepare_for_firestore(update_data)
                doc_ref.update(prepared_data)
                logger.info(f"User updated in Firestore: {user_id}")
                return True
            else:
                # Fallback to memory
                for i, user in enumerate(self.memory_users):
                    if user.get('id') == user_id:
                        self.memory_users[i].update(update_data)
                        logger.info(f"User updated in memory: {user_id}")
                        return True
                return False
        except Exception as e:
            logger.error(f"Failed to update user: {e}")
            return False

    # Task operations
    async def save_task(self, task_data: dict) -> bool:
        """Save task to Firestore"""
        try:
            if self.db:
                prepared_data = self.prepare_for_firestore(task_data)
                doc_ref = self.db.collection(TASKS_COLLECTION).document(task_data['id'])
                doc_ref.set(prepared_data)
                logger.info(f"Task saved to Firestore: {task_data['id']}")
                return True
            else:
                # Fallback to memory
                self.memory_tasks.append(task_data)
                logger.info(f"Task saved to memory: {task_data['id']}")
                return True
        except Exception as e:
            logger.error(f"Failed to save task: {e}")
            return False

    async def get_all_tasks(self) -> List[dict]:
        """Get all tasks"""
        try:
            if self.db:
                tasks_ref = self.db.collection(TASKS_COLLECTION)
                docs = tasks_ref.stream()
                tasks = []
                for doc in docs:
                    task_data = doc.to_dict()
                    tasks.append(task_data)
                return tasks
            else:
                # Fallback to memory
                return self.memory_tasks.copy()
        except Exception as e:
            logger.error(f"Failed to get tasks: {e}")
            return []

    async def get_task_by_id(self, task_id: str) -> Optional[dict]:
        """Get task by ID"""
        try:
            if self.db:
                doc_ref = self.db.collection(TASKS_COLLECTION).document(task_id)
                doc = doc_ref.get()
                if doc.exists:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for task in self.memory_tasks:
                    if task.get('id') == task_id:
                        return task
                return None
        except Exception as e:
            logger.error(f"Failed to get task by ID: {e}")
            return None

    async def update_task(self, task_id: str, update_data: dict) -> bool:
        """Update task data"""
        try:
            if self.db:
                doc_ref = self.db.collection(TASKS_COLLECTION).document(task_id)
                prepared_data = self.prepare_for_firestore(update_data)
                doc_ref.update(prepared_data)
                logger.info(f"Task updated in Firestore: {task_id}")
                return True
            else:
                # Fallback to memory
                for i, task in enumerate(self.memory_tasks):
                    if task.get('id') == task_id:
                        self.memory_tasks[i].update(update_data)
                        logger.info(f"Task updated in memory: {task_id}")
                        return True
                return False
        except Exception as e:
            logger.error(f"Failed to update task: {e}")
            return False

    async def delete_task(self, task_id: str) -> bool:
        """Delete task"""
        try:
            if self.db:
                doc_ref = self.db.collection(TASKS_COLLECTION).document(task_id)
                doc_ref.delete()
                logger.info(f"Task deleted from Firestore: {task_id}")
                return True
            else:
                # Fallback to memory
                self.memory_tasks = [task for task in self.memory_tasks if task.get('id') != task_id]
                logger.info(f"Task deleted from memory: {task_id}")
                return True
        except Exception as e:
            logger.error(f"Failed to delete task: {e}")
            return False

    # Auth user operations
    async def save_auth_record(self, record: dict) -> bool:
        """Save auth record to Firestore"""
        try:
            if self.db:
                prepared_data = self.prepare_for_firestore(record)
                doc_ref = self.db.collection(AUTH_USERS_COLLECTION).document(record['id'])
                doc_ref.set(prepared_data)
                logger.info(f"Auth record saved to Firestore: {record['id']}")
                return True
            else:
                # Fallback to memory
                self.memory_auth_users.append(record)
                logger.info(f"Auth record saved to memory: {record['id']}")
                return True
        except Exception as e:
            logger.error(f"Failed to save auth record: {e}")
            return False

    async def get_auth_record_by_email(self, email: str) -> Optional[dict]:
        """Get auth record by email"""
        try:
            if self.db:
                auth_ref = self.db.collection(AUTH_USERS_COLLECTION)
                query = auth_ref.where('email', '==', email.lower()).limit(1)
                docs = query.stream()
                for doc in docs:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for record in self.memory_auth_users:
                    if record.get('email', '').lower() == email.lower():
                        return record
                return None
        except Exception as e:
            logger.error(f"Failed to get auth record by email: {e}")
            return None

    async def upsert_auth_record_by_email(self, email: str, user_id: str, hashed_password: Optional[str] = None) -> dict:
        """Upsert auth record by email"""
        try:
            email_l = email.lower()
            existing = await self.get_auth_record_by_email(email_l)
            
            if existing:
                # Update existing record
                update_data = {"user_id": user_id}
                if hashed_password:
                    update_data["hashed_password"] = hashed_password
                
                if self.db:
                    doc_ref = self.db.collection(AUTH_USERS_COLLECTION).document(existing['id'])
                    doc_ref.update(update_data)
                else:
                    # Update in memory
                    for record in self.memory_auth_users:
                        if record.get('email') == email_l:
                            record.update(update_data)
                            break
                
                return {**existing, **update_data}
            else:
                # Create new record
                import uuid
                record = {
                    "id": str(uuid.uuid4()),
                    "email": email_l,
                    "user_id": user_id,
                    "hashed_password": hashed_password
                }
                await self.save_auth_record(record)
                return record
                
        except Exception as e:
            logger.error(f"Failed to upsert auth record: {e}")
            return {}

    # Application operations
    async def save_application(self, application_data: dict) -> bool:
        """Save application to Firestore"""
        try:
            if self.db:
                prepared_data = self.prepare_for_firestore(application_data)
                doc_ref = self.db.collection(APPLICATIONS_COLLECTION).document(application_data['id'])
                doc_ref.set(prepared_data)
                logger.info(f"Application saved to Firestore: {application_data['id']}")
                return True
            else:
                # Fallback to memory
                self.memory_applications.append(application_data)
                logger.info(f"Application saved to memory: {application_data['id']}")
                return True
        except Exception as e:
            logger.error(f"Failed to save application: {e}")
            return False

    # Escrow transaction operations
    async def save_escrow_transaction(self, escrow_data: dict) -> bool:
        """Save escrow transaction to Firestore"""
        try:
            if self.db:
                prepared_data = self.prepare_for_firestore(escrow_data)
                doc_ref = self.db.collection(ESCROW_TRANSACTIONS_COLLECTION).document(escrow_data['id'])
                doc_ref.set(prepared_data)
                logger.info(f"Escrow transaction saved to Firestore: {escrow_data['id']}")
                return True
            else:
                # Fallback to memory
                self.memory_escrow_transactions.append(escrow_data)
                logger.info(f"Escrow transaction saved to memory: {escrow_data['id']}")
                return True
        except Exception as e:
            logger.error(f"Failed to save escrow transaction: {e}")
            return False

# Global instance
firebase_db = FirebaseDB()
