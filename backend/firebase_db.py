import os
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import firebase_admin
from firebase_admin import firestore
from firebase_auth import initialize_firebase

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
try:
    initialize_firebase()
    logger.info("Firebase Admin SDK initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
    logger.warning("Continuing with in-memory storage")

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
SUBMISSIONS_COLLECTION = 'submissions'
AUTH_USERS_COLLECTION = 'auth_users'
ESCROW_TRANSACTIONS_COLLECTION = 'escrow_transactions'
PAYMENT_CLAIMS_COLLECTION = 'payment_claims'
OTP_COLLECTION = 'otp_codes'

class FirebaseDB:
    def __init__(self):
        self.db = get_firestore_client()
        self.use_memory = self.db is None
        # In-memory fallback stores
        self.memory_tasks = []
        self.memory_users = []
        self.memory_submissions = []
        self.memory_auth_users = []
        self.memory_escrow_transactions = []
        self.memory_payment_claims = []
        self.memory_otp_codes = []
        
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
            logger.info(f"💾 Attempting to save auth record for email: {record.get('email')}")
            logger.info(f"💾 Firestore DB available: {self.db is not None}")
            
            if self.db:
                prepared_data = self.prepare_for_firestore(record)
                logger.info(f"💾 Prepared data keys: {list(prepared_data.keys())}")
                
                doc_ref = self.db.collection(AUTH_USERS_COLLECTION).document(record['id'])
                logger.info(f"💾 Writing to collection: {AUTH_USERS_COLLECTION}, doc: {record['id']}")
                
                doc_ref.set(prepared_data)
                logger.info(f"✅ Auth record saved to Firestore: {record['id']} for {record.get('email')}")
                
                # Verify it was saved
                saved_doc = doc_ref.get()
                if saved_doc.exists:
                    logger.info(f"✅ Verified: Auth record exists in Firestore")
                else:
                    logger.error(f"❌ Verification failed: Auth record not found after save!")
                
                return True
            else:
                # Fallback to memory
                self.memory_auth_users.append(record)
                logger.info(f"Auth record saved to memory: {record['id']}")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to save auth record: {e}")
            logger.exception("Full traceback:")
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
            logger.info(f"🔐 Upserting auth record for {email_l}, user_id: {user_id}, has_password: {hashed_password is not None}")
            
            existing = await self.get_auth_record_by_email(email_l)
            logger.info(f"🔐 Existing auth record found: {existing is not None}")
            
            if existing:
                # Update existing record
                update_data = {"user_id": user_id}
                if hashed_password:
                    update_data["hashed_password"] = hashed_password
                    logger.info(f"🔐 Updating password for existing record: {existing['id']}")
                
                if self.db:
                    doc_ref = self.db.collection(AUTH_USERS_COLLECTION).document(existing['id'])
                    doc_ref.update(update_data)
                    logger.info(f"🔐 Updated auth record in Firestore: {existing['id']}")
                    
                    # Verify the update
                    updated_doc = doc_ref.get()
                    if updated_doc.exists:
                        updated_data = updated_doc.to_dict()
                        logger.info(f"🔐 Verified update - password hash length: {len(updated_data.get('hashed_password', ''))}")
                    else:
                        logger.error(f"❌ Failed to verify auth record update")
                else:
                    # Update in memory
                    for record in self.memory_auth_users:
                        if record.get('email') == email_l:
                            record.update(update_data)
                            logger.info(f"🔐 Updated auth record in memory for {email_l}")
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
                logger.info(f"🔐 Creating new auth record for {email_l}")
                await self.save_auth_record(record)
                return record
                
        except Exception as e:
            logger.error(f"❌ Failed to upsert auth record: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return {}

    # Submission operations
    async def save_submission(self, submission_data: dict) -> bool:
        """Save submission to Firestore"""
        try:
            if self.db:
                prepared_data = self.prepare_for_firestore(submission_data)
                doc_ref = self.db.collection(SUBMISSIONS_COLLECTION).document(submission_data['id'])
                doc_ref.set(prepared_data)
                logger.info(f"Submission saved to Firestore: {submission_data['id']}")
                return True
            else:
                # Fallback to memory
                self.memory_submissions.append(submission_data)
                logger.info(f"Submission saved to memory: {submission_data['id']}")
                return True
        except Exception as e:
            logger.error(f"Failed to save submission: {e}")
            return False

    async def get_submissions_by_task_id(self, task_id: str) -> List[dict]:
        """Get all submissions for a specific task"""
        try:
            if self.db:
                subs_ref = self.db.collection(SUBMISSIONS_COLLECTION)
                query = subs_ref.where('task_id', '==', task_id)
                docs = query.stream()
                submissions = []
                for doc in docs:
                    sub_data = doc.to_dict()
                    submissions.append(sub_data)
                return submissions
            else:
                # Fallback to memory
                return [sub for sub in self.memory_submissions if sub.get('task_id') == task_id]
        except Exception as e:
            logger.error(f"Failed to get submissions by task ID: {e}")
            return []

    async def get_submissions_by_freelancer_id(self, freelancer_id: str) -> List[dict]:
        """Get all submissions by a specific freelancer"""
        try:
            if self.db:
                subs_ref = self.db.collection(SUBMISSIONS_COLLECTION)
                query = subs_ref.where('freelancer_id', '==', freelancer_id)
                docs = query.stream()
                submissions = []
                for doc in docs:
                    sub_data = doc.to_dict()
                    submissions.append(sub_data)
                return submissions
            else:
                # Fallback to memory
                return [sub for sub in self.memory_submissions if sub.get('freelancer_id') == freelancer_id]
        except Exception as e:
            logger.error(f"Failed to get submissions by freelancer ID: {e}")
            return []

    async def get_submission_by_id(self, submission_id: str) -> Optional[dict]:
        """Get submission by ID"""
        try:
            if self.db:
                doc_ref = self.db.collection(SUBMISSIONS_COLLECTION).document(submission_id)
                doc = doc_ref.get()
                if doc.exists:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for sub in self.memory_submissions:
                    if sub.get('id') == submission_id:
                        return sub
                return None
        except Exception as e:
            logger.error(f"Failed to get submission by ID: {e}")
            return None

    async def update_submission(self, submission_id: str, update_data: dict) -> bool:
        """Update submission data"""
        try:
            if self.db:
                doc_ref = self.db.collection(SUBMISSIONS_COLLECTION).document(submission_id)
                prepared_data = self.prepare_for_firestore(update_data)
                doc_ref.update(prepared_data)
                logger.info(f"Submission updated in Firestore: {submission_id}")
                return True
            else:
                # Fallback to memory
                for i, sub in enumerate(self.memory_submissions):
                    if sub.get('id') == submission_id:
                        self.memory_submissions[i].update(update_data)
                        logger.info(f"Submission updated in memory: {submission_id}")
                        return True
                return False
        except Exception as e:
            logger.error(f"Failed to update submission: {e}")
            return False

    async def check_existing_submission(self, task_id: str, freelancer_id: str) -> Optional[dict]:
        """Check if freelancer has already submitted work for this task"""
        try:
            if self.db:
                subs_ref = self.db.collection(SUBMISSIONS_COLLECTION)
                query = subs_ref.where('task_id', '==', task_id).where('freelancer_id', '==', freelancer_id).limit(1)
                docs = query.stream()
                for doc in docs:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for sub in self.memory_submissions:
                    if sub.get('task_id') == task_id and sub.get('freelancer_id') == freelancer_id:
                        return sub
                return None
        except Exception as e:
            logger.error(f"Failed to check existing submission: {e}")
            return None

    async def get_approved_submission_for_task(self, task_id: str) -> Optional[dict]:
        """Get the approved submission for a task (if any)"""
        try:
            if self.db:
                subs_ref = self.db.collection(SUBMISSIONS_COLLECTION)
                query = subs_ref.where('task_id', '==', task_id).where('status', '==', 'approved').limit(1)
                docs = query.stream()
                for doc in docs:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for sub in self.memory_submissions:
                    if sub.get('task_id') == task_id and sub.get('status') == 'approved':
                        return sub
                return None
        except Exception as e:
            logger.error(f"Failed to get approved submission: {e}")
            return None

    # Payment claim operations
    async def save_payment_claim(self, claim_data: dict) -> bool:
        """Save payment claim to Firestore"""
        try:
            if self.db:
                prepared_data = self.prepare_for_firestore(claim_data)
                doc_ref = self.db.collection(PAYMENT_CLAIMS_COLLECTION).document(claim_data['id'])
                doc_ref.set(prepared_data)
                logger.info(f"Payment claim saved to Firestore: {claim_data['id']}")
                return True
            else:
                # Fallback to memory
                self.memory_payment_claims.append(claim_data)
                logger.info(f"Payment claim saved to memory: {claim_data['id']}")
                return True
        except Exception as e:
            logger.error(f"Failed to save payment claim: {e}")
            return False

    async def get_payment_claim_by_id(self, claim_id: str) -> Optional[dict]:
        """Get payment claim by ID"""
        try:
            if self.db:
                doc_ref = self.db.collection(PAYMENT_CLAIMS_COLLECTION).document(claim_id)
                doc = doc_ref.get()
                if doc.exists:
                    return doc.to_dict()
                return None
            else:
                # Fallback to memory
                for claim in self.memory_payment_claims:
                    if claim.get('id') == claim_id:
                        return claim
                return None
        except Exception as e:
            logger.error(f"Failed to get payment claim by ID: {e}")
            return None

    async def get_payment_claims_by_freelancer_id(self, freelancer_id: str) -> List[dict]:
        """Get all payment claims by a specific freelancer"""
        try:
            if self.db:
                claims_ref = self.db.collection(PAYMENT_CLAIMS_COLLECTION)
                query = claims_ref.where('freelancer_id', '==', freelancer_id)
                docs = query.stream()
                claims = []
                for doc in docs:
                    claim_data = doc.to_dict()
                    claims.append(claim_data)
                return claims
            else:
                # Fallback to memory
                return [claim for claim in self.memory_payment_claims if claim.get('freelancer_id') == freelancer_id]
        except Exception as e:
            logger.error(f"Failed to get payment claims by freelancer ID: {e}")
            return []

    async def update_payment_claim(self, claim_id: str, update_data: dict) -> bool:
        """Update payment claim data"""
        try:
            if self.db:
                doc_ref = self.db.collection(PAYMENT_CLAIMS_COLLECTION).document(claim_id)
                prepared_data = self.prepare_for_firestore(update_data)
                doc_ref.update(prepared_data)
                logger.info(f"Payment claim updated in Firestore: {claim_id}")
                return True
            else:
                # Fallback to memory
                for i, claim in enumerate(self.memory_payment_claims):
                    if claim.get('id') == claim_id:
                        self.memory_payment_claims[i].update(update_data)
                        logger.info(f"Payment claim updated in memory: {claim_id}")
                        return True
                return False
        except Exception as e:
            logger.error(f"Failed to update payment claim: {e}")
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

    # OTP operations
    async def save_otp(self, email: str, otp: str, expires_at: datetime) -> bool:
        """Save OTP code for password reset"""
        try:
            # Ensure expires_at is timezone-aware
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
                
            otp_data = {
                'email': email.lower(),
                'otp': otp,
                'expires_at': expires_at,
                'created_at': datetime.now(timezone.utc),
                'used': False
            }
            
            logger.info(f"💾 Attempting to save OTP for {email}: {otp}")
            logger.info(f"💾 OTP data: {otp_data}")
            
            if self.db:
                # Use email as document ID for easy retrieval
                doc_ref = self.db.collection(OTP_COLLECTION).document(email.lower())
                prepared_data = self.prepare_for_firestore(otp_data)
                logger.info(f"💾 Prepared data for Firestore: {prepared_data}")
                doc_ref.set(prepared_data)
                logger.info(f"✅ OTP saved to Firestore for {email}")
                
                # Verify it was saved by reading it back
                saved_doc = doc_ref.get()
                if saved_doc.exists:
                    saved_data = saved_doc.to_dict()
                    logger.info(f"✅ Verified OTP saved successfully: {saved_data}")
                else:
                    logger.error(f"❌ OTP save verification failed for {email}")
                    return False
                return True
            else:
                # Fallback to memory - remove any existing OTP for this email first
                self.memory_otp_codes = [otp_code for otp_code in self.memory_otp_codes if otp_code.get('email') != email.lower()]
                self.memory_otp_codes.append(otp_data)
                logger.info(f"✅ OTP saved to memory for {email}")
                logger.info(f"💾 Memory OTP codes: {self.memory_otp_codes}")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to save OTP: {e}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return False

    async def get_otp(self, email: str) -> Optional[dict]:
        """Get OTP code for email"""
        try:
            logger.info(f"🔍 Looking for OTP for email: {email}")
            
            if self.db:
                doc_ref = self.db.collection(OTP_COLLECTION).document(email.lower())
                doc = doc_ref.get()
                logger.info(f"🔍 Firestore document exists: {doc.exists}")
                if doc.exists:
                    otp_data = doc.to_dict()
                    logger.info(f"🔍 Found OTP data in Firestore: {otp_data}")
                    return otp_data
                logger.info(f"🔍 No OTP found in Firestore for {email}")
                return None
            else:
                # Fallback to memory
                logger.info(f"🔍 Searching memory OTP codes: {self.memory_otp_codes}")
                for otp in self.memory_otp_codes:
                    if otp.get('email') == email.lower():
                        logger.info(f"🔍 Found OTP in memory: {otp}")
                        return otp
                logger.info(f"🔍 No OTP found in memory for {email}")
                return None
        except Exception as e:
            logger.error(f"❌ Failed to get OTP: {e}")
            return None

    async def verify_and_use_otp(self, email: str, otp: str) -> bool:
        """Verify OTP and mark as used"""
        try:
            logger.info(f"🔐 Verifying OTP for {email}: {otp}")
            
            otp_data = await self.get_otp(email)
            logger.info(f"🔐 Retrieved OTP data: {otp_data}")
            
            if not otp_data:
                logger.error(f"❌ No OTP data found for {email}")
                return False
            
            stored_otp = otp_data.get('otp')
            is_used = otp_data.get('used', False)
            expires_at = otp_data.get('expires_at')
            # Use UTC timezone for consistency
            current_time = datetime.now(timezone.utc)
            
            # Convert expires_at to timezone-aware if it's naive
            if expires_at and expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            logger.info(f"🔐 OTP comparison - Stored: {stored_otp}, Received: {otp}, Match: {stored_otp == otp}")
            logger.info(f"🔐 Used status: {is_used}")
            logger.info(f"🔐 Expiration - Expires: {expires_at}, Current: {current_time}, Valid: {expires_at > current_time if expires_at else False}")
            
            # Check if OTP matches and is not expired
            if (stored_otp == otp and 
                not is_used and 
                expires_at and expires_at > current_time):
                
                # Mark as used
                if self.db:
                    doc_ref = self.db.collection(OTP_COLLECTION).document(email.lower())
                    doc_ref.update({'used': True})
                    logger.info(f"✅ OTP marked as used in Firestore for {email}")
                else:
                    # Update in memory
                    for stored_otp in self.memory_otp_codes:
                        if stored_otp.get('email') == email.lower():
                            stored_otp['used'] = True
                            break
                    logger.info(f"✅ OTP marked as used in memory for {email}")
                
                logger.info(f"✅ OTP verified and used for {email}")
                return True
            
            logger.error(f"❌ OTP verification failed for {email}")
            return False
        except Exception as e:
            logger.error(f"❌ Failed to verify OTP: {e}")
            return False

    async def cleanup_expired_otps(self):
        """Clean up expired OTP codes"""
        try:
            # Use UTC timezone for consistency
            current_time = datetime.now(timezone.utc)
            
            logger.info(f"🧹 Cleaning up expired OTPs. Current time: {current_time}")
            
            if self.db:
                # Query expired OTPs
                expired_otps = self.db.collection(OTP_COLLECTION).where('expires_at', '<', current_time).stream()
                deleted_count = 0
                for doc in expired_otps:
                    doc_data = doc.to_dict()
                    logger.info(f"🧹 Deleting expired OTP for {doc_data.get('email')}: expires_at={doc_data.get('expires_at')}")
                    doc.reference.delete()
                    deleted_count += 1
                logger.info(f"🧹 Cleaned up {deleted_count} expired OTPs from Firestore")
            else:
                # Clean up memory
                original_count = len(self.memory_otp_codes)
                self.memory_otp_codes = [
                    otp for otp in self.memory_otp_codes 
                    if otp.get('expires_at', datetime.now(timezone.utc)) > current_time
                ]
                deleted_count = original_count - len(self.memory_otp_codes)
                logger.info(f"🧹 Cleaned up {deleted_count} expired OTPs from memory")
        except Exception as e:
            logger.error(f"❌ Failed to cleanup expired OTPs: {e}")

# Global instance
firebase_db = FirebaseDB()
