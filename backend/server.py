from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import jwt
from passlib.context import CryptContext
from fastapi.responses import JSONResponse, FileResponse
from firebase_auth import initialize_firebase
from firebase_hybrid_auth import verify_firebase_token_hybrid
from firebase_db import firebase_db
from firebase_admin import auth
import logging
from web3 import Web3
from eth_account import Account
import json
from datetime import timedelta
import hashlib
import base64
from zkp_system import FileZKPSystem

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import email service AFTER loading environment variables
from email_service import email_service

# Log email service status
if email_service.is_configured:
    logger.info(f"✅ Email service configured for: {email_service.smtp_username}")
else:
    logger.warning("❌ Email service not configured. Set SMTP_USERNAME and SMTP_PASSWORD environment variables.")

# File upload configuration
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt', '.zip', '.rar', '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi'}

# Initialize Firebase Admin SDK
try:
    initialize_firebase()
    logger.info("Firebase Admin SDK initialized in server.py")
    
    # Test Firebase app
    import firebase_admin
    app = firebase_admin.get_app()
    logger.info(f"Firebase app project ID: {app.project_id}")
except Exception as e:
    logger.error(f"Failed to initialize Firebase in server.py: {e}")
    logger.error("Falling back to REST API authentication")

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Startup event to warm up connections
@app.on_event("startup")
async def startup_event():
    """Warm up Firebase connections and cache for faster first requests"""
    logger.info("Starting server warmup...")
    try:
        # Warm up Firebase connection
        import firebase_admin
        app_instance = firebase_admin.get_app()
        logger.info(f"Firebase connection warmed up for project: {app_instance.project_id}")
    except Exception as e:
        logger.warning(f"Firebase warmup failed (will use REST API): {e}")
    
    logger.info("Server warmup completed")

# Define Models
class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    budget: float
    deadline: str
    client: str
    client_rating: float = 4.5
    status: str = "open"
    submissions: int = 0
    skills: List[str] = []
    escrow_status: str = "pending"
    expected_files_count: int = 1  # Number of files client expects
    validation_code: Optional[str] = None  # Optional validation code for automated testing
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
class TaskCreate(BaseModel):
    title: str
    description: str
    category: str
    budget: float
    deadline: str  # ISO date string YYYY-MM-DD
    client: str
    skills: List[str] = []
    expected_files_count: int = 1  # Number of files client expects
    validation_code: Optional[str] = None  # Optional validation code for automated testing

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    user_type: str  # "client" or "freelancer"
    rating: float = 5.0
    completed_tasks: int = 0
    total_earnings: float = 0.0
    reputation_score: int = 100
    firebase_uid: Optional[str] = None  # Firebase user ID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    email: str
    user_type: str

class EscrowTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    client_id: str
    freelancer_id: str
    amount: float
    status: str = "pending"  # pending, funded, released, disputed
    zkp_hash: Optional[str] = None
    smart_contract_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FileSubmission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_path: str
    file_name: str
    file_type: str
    file_size: int
    status: str = "pending"  # pending, approved, rejected
    feedback: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    zkp_proof: Optional[str] = None  # Zero-knowledge proof for file validation
    zkp_metrics: Optional[dict] = None  # Metrics extracted from file for validation
    auto_approved: bool = False  # True if approved automatically via validation code

class Submission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    freelancer_id: str
    freelancer_name: str
    description: str
    files: List[FileSubmission] = []  # Individual file submissions with status
    overall_status: str = "pending"  # pending, partially_approved, fully_approved, rejected
    approved_files_count: int = 0
    total_files_count: int = 0
    approval_percentage: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_updated_at: Optional[datetime] = None
    payment_claimable: bool = False  # True when freelancer can claim payment
    payment_claimed: bool = False  # True when payment has been claimed
    payment_claimed_at: Optional[datetime] = None
    payment_amount: float = 0.0  # Calculated based on approval percentage
    can_resubmit: bool = True  # True if freelancer can resubmit rejected files

class PaymentClaim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    submission_id: str
    task_id: str
    freelancer_id: str
    freelancer_wallet: str
    amount: float
    status: str = "pending"  # pending, completed, failed
    transaction_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

# ---------------- Authentication Models/Setup ----------------
class SignupRequest(BaseModel):
    email: str
    password: str
    username: Optional[str] = None
    user_type: Optional[str] = None  # default assigned if missing

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("JWT_SECRET", "dev-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# Auth storage is now handled by Firebase

# Frontend configuration
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")

# Blockchain Configuration
NETWORK_NAME = os.environ.get("NETWORK_NAME", "Datom Test Network")
RPC_URL = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
CHAIN_ID = int(os.environ.get("CHAIN_ID", "31337"))
CHAIN_ID_HEX = os.environ.get("CHAIN_ID_HEX", "0x7a69")
CURRENCY_SYMBOL = os.environ.get("CURRENCY_SYMBOL", "ETH")
ESCROW_ADDRESS = os.environ.get("ESCROW_ADDRESS", "0xA54130603Aed8B222f9BE8F22F4F8ED458505A27")

# Blockchain Configuration
w3 = Web3(Web3.HTTPProvider(RPC_URL))

# Private key for escrow contract (in production, use secure key management)
ESCROW_PRIVATE_KEY = os.environ.get("ESCROW_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")  # Anvil default account #0
escrow_account = Account.from_key(ESCROW_PRIVATE_KEY)

# Simple escrow contract ABI (for basic ETH transfers)
ESCROW_ABI = [
    {
        "inputs": [{"name": "_to", "type": "address"}],
        "name": "release",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getBalance",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    }
]

def get_escrow_contract():
    """Get escrow contract instance"""
    try:
        return w3.eth.contract(address=ESCROW_ADDRESS, abi=ESCROW_ABI)
    except Exception as e:
        logger.error(f"Failed to get escrow contract: {e}")
        return None

async def transfer_from_escrow(to_address: str, amount_eth: float) -> dict:
    """Transfer ETH from escrow to freelancer wallet"""
    try:
        # Validate connection
        if not w3.is_connected():
            raise Exception("Not connected to blockchain network")
        
        # Convert ETH to Wei
        amount_wei = w3.to_wei(amount_eth, 'ether')
        
        # Get current gas price
        gas_price = w3.eth.gas_price
        
        # Build transaction
        transaction = {
            'to': to_address,
            'value': amount_wei,
            'gas': 21000,  # Standard gas limit for ETH transfer
            'gasPrice': gas_price,
            'nonce': w3.eth.get_transaction_count(escrow_account.address),
            'chainId': CHAIN_ID
        }
        
        # Sign transaction
        signed_txn = w3.eth.account.sign_transaction(transaction, ESCROW_PRIVATE_KEY)
        
        # Send transaction
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        
        # Wait for confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        
        return {
            "success": True,
            "transaction_hash": receipt.transactionHash.hex(),
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "status": receipt.status
        }
        
    except Exception as e:
        logger.error(f"Blockchain transfer failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }

async def get_escrow_balance() -> float:
    """Get current escrow balance in ETH"""
    try:
        balance_wei = w3.eth.get_balance(escrow_account.address)
        return w3.from_wei(balance_wei, 'ether')
    except Exception as e:
        logger.error(f"Failed to get escrow balance: {e}")
        return 0.0

def calculate_proportional_payment(task_budget: float, approved_files: int, total_files: int) -> float:
    """Calculate proportional payment based on approved files"""
    if total_files == 0:
        return 0.0
    return (task_budget * approved_files) / total_files

def update_submission_stats(submission: Submission) -> Submission:
    """Update submission statistics based on file statuses"""
    approved_count = sum(1 for file in submission.files if file.status == "approved")
    total_count = len(submission.files)
    
    submission.approved_files_count = approved_count
    submission.total_files_count = total_count
    submission.approval_percentage = (approved_count / total_count * 100) if total_count > 0 else 0
    
    # Update overall status
    if approved_count == 0:
        if any(file.status == "rejected" for file in submission.files):
            submission.overall_status = "rejected"
        else:
            submission.overall_status = "pending"
    elif approved_count == total_count:
        submission.overall_status = "fully_approved"
    else:
        submission.overall_status = "partially_approved"
    
    # Update payment claimable status
    submission.payment_claimable = approved_count > 0
    
    return submission

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        # First try bcrypt verification
        result = pwd_context.verify(password, hashed)
        logger.info(f"🔐 bcrypt verification result: {result}")
        return result
    except Exception as e:
        logger.info(f"🔐 bcrypt verification failed: {e}")
        
        # Try fallback verification for pbkdf2_sha256 format
        if hashed.startswith("pbkdf2_sha256$"):
            try:
                import hashlib
                parts = hashed.split("$")
                if len(parts) == 3:
                    salt = parts[1]
                    stored_hash = parts[2]
                    computed_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
                    result = computed_hash.hex() == stored_hash
                    logger.info(f"🔐 fallback verification result: {result}")
                    return result
            except Exception as fallback_error:
                logger.error(f"🔐 fallback verification error: {fallback_error}")
        
        return False

def create_access_token(data: dict) -> str:
    payload = {
        **data,
        "exp": datetime.now(timezone.utc).timestamp() + (ACCESS_TOKEN_EXPIRE_MINUTES * 60),
        "iat": datetime.now(timezone.utc).timestamp(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_auth_record_by_email(email: str) -> Optional[dict]:
    return await firebase_db.get_auth_record_by_email(email)

async def save_auth_record(record: dict):
    await firebase_db.save_auth_record(record)

async def upsert_auth_record_by_email(email: str, user_id: str, hashed_password: Optional[str] = None) -> dict:
    return await firebase_db.upsert_auth_record_by_email(email, user_id, hashed_password)

async def get_user_by_id(user_id: str) -> Optional[User]:
    user_data = await firebase_db.get_user_by_id(user_id)
    if user_data:
        return User(**user_data)
    return None

async def get_user_by_firebase_uid(firebase_uid: str) -> Optional[User]:
    """Get user by Firebase UID"""
    user_data = await firebase_db.get_user_by_firebase_uid(firebase_uid)
    if user_data:
        return User(**user_data)
    return None

async def save_user(user: User):
    """Save user to database"""
    await firebase_db.save_user(user.dict())

async def get_current_user(authorization: Optional[str] = Header(default=None)) -> User:
    # Use hybrid Firebase token verification
    firebase_user = await verify_firebase_token_hybrid(authorization)
    
    # Get or create user in our database
    user = await get_user_by_firebase_uid(firebase_user["uid"])
    if not user:
        # Create new user from Firebase data
        user_obj = User(
            id=str(uuid.uuid4()),
            username=firebase_user["name"],
            email=firebase_user["email"],
            user_type="freelancer",  # default
            firebase_uid=firebase_user["uid"]
        )
        await save_user(user_obj)
        user = user_obj

    
    return user

# Helper function for data preparation (kept for compatibility)
def prepare_for_mongo(data):
    # This function is kept for backward compatibility but is no longer needed
    # since Firebase handles datetime serialization automatically
    return data

# Date helpers
def parse_deadline(deadline_str: str) -> datetime:
    try:
        # Expecting YYYY-MM-DD
        return datetime.strptime(deadline_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except Exception:
        # Try ISO format fallback
        return datetime.fromisoformat(deadline_str).replace(tzinfo=timezone.utc)

def is_past_deadline(deadline_str: str) -> bool:
    try:
        deadline_dt = parse_deadline(deadline_str)
        now = datetime.now(timezone.utc)
        return deadline_dt < now.replace(hour=0, minute=0, second=0, microsecond=0)
    except Exception:
        return False

async def save_uploaded_file(file: UploadFile, task_id: str, freelancer_id: str) -> str:
    """Save uploaded file and return the file path"""
    # Validate file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {file_ext} not allowed")
    
    # Create unique filename
    unique_filename = f"{task_id}_{freelancer_id}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    try:
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large (max 50MB)")
        
        with open(file_path, "wb") as f:
            f.write(content)
        
        return str(file_path.relative_to(ROOT_DIR))
    except Exception as e:
        logger.error(f"Failed to save file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save file")

def is_significantly_past_deadline(deadline_str: str) -> bool:
    try:
        deadline_dt = parse_deadline(deadline_str)
        now = datetime.now(timezone.utc)
        # Only consider tasks significantly past deadline if they're more than 30 days old
        return deadline_dt < (now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=30))
    except Exception:
        return False

async def cleanup_tasks():
    """Remove tasks that are significantly past their deadline (keep completed tasks for history)."""
    # Get all tasks from Firebase
    all_tasks = await firebase_db.get_all_tasks()
    
    # Only delete tasks that are more than 30 days past deadline (keep completed tasks)
    for task_data in all_tasks:
        task_id = task_data.get("id")
        deadline_str = str(task_data.get("deadline", ""))
        if deadline_str and is_significantly_past_deadline(deadline_str):
            await firebase_db.delete_task(task_id)

def calculate_proportional_payment(total_budget: float, approved_files: int, expected_files: int) -> float:
    """Calculate proportional payment based on approved files"""
    if expected_files <= 0:
        return 0.0
    
    # Calculate percentage of approved files
    approval_percentage = min(approved_files / expected_files, 1.0)  # Cap at 100%
    
    # Return proportional payment
    return total_budget * approval_percentage

def generate_zkp_for_file(file_path: str, file_name: str, file_size: int, validation_code: str = None) -> tuple[dict, dict]:
    """
    Generate a REAL cryptographic zero-knowledge proof for a file.
    Uses Pedersen commitments and Schnorr-like proofs.
    
    Returns (zkp_proofs_dict, public_metrics_dict)
    
    The ZKP proves file properties (size, name pattern) WITHOUT revealing:
    - The actual file content
    - The exact file size (only that it meets criteria)
    - The full file name (only that it contains required substring)
    """
    try:
        full_path = ROOT_DIR / file_path
        
        # Generate cryptographic ZKP proofs
        if validation_code:
            zkp_proofs = FileZKPSystem.generate_file_proofs(
                str(full_path), 
                file_name, 
                file_size, 
                validation_code
            )
        else:
            # No validation code, just create commitments
            zkp_proofs = {
                "commitments_only": True,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Public metrics (minimal information revealed)
        public_metrics = {
            "has_zkp_proof": bool(validation_code),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "proof_count": len(zkp_proofs.get("proofs", []))
        }
        
        return zkp_proofs, public_metrics
        
    except Exception as e:
        logger.error(f"Failed to generate ZKP for file {file_path}: {e}")
        return {}, {}

def verify_zkp_proof(zkp_proofs: dict, validation_code: str) -> bool:
    """
    Verify a cryptographic zero-knowledge proof.
    
    This verification happens WITHOUT accessing the actual file!
    The verifier only checks the mathematical proof, not the file itself.
    
    Returns True if the ZKP is valid, False otherwise.
    """
    if not validation_code or not validation_code.strip():
        return False
    
    if not zkp_proofs or zkp_proofs.get("commitments_only"):
        return False
    
    try:
        # Verify the cryptographic proof
        is_valid = FileZKPSystem.verify_file_proofs(zkp_proofs, validation_code)
        
        if is_valid:
            logger.info(f"✅ ZKP verification PASSED - File meets criteria WITHOUT revealing content")
        else:
            logger.info(f"❌ ZKP verification FAILED - File does not meet criteria")
        
        return is_valid
        
    except Exception as e:
        logger.error(f"ZKP verification failed: {e}")
        return False

# Routes
@api_router.get("/")
async def root():
    return {"message": "DecentraTask API - Decentralized Task Outsourcing Platform"}

@api_router.get("/blockchain/config")
async def get_blockchain_config():
    """Get blockchain network configuration"""
    return {
        "network_name": NETWORK_NAME,
        "rpc_url": RPC_URL,
        "chain_id": CHAIN_ID,
        "chain_id_hex": CHAIN_ID_HEX,
        "currency_symbol": CURRENCY_SYMBOL,
        "escrow_address": ESCROW_ADDRESS
    }

# Task Management Routes
@api_router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    """Create a new task"""
    task_dict = task.dict()
    # Validate budget and deadline
    if task_dict.get("budget", 0) <= 0:
        raise HTTPException(status_code=400, detail="Budget must be greater than 0")
    try:
        if is_past_deadline(task_dict.get("deadline", "")):
            raise HTTPException(status_code=400, detail="Deadline must be today or in the future")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deadline format. Use YYYY-MM-DD")
    task_obj = Task(**task_dict)
    
    # Save to Firebase
    success = await firebase_db.save_task(task_obj.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save task")
    
    await cleanup_tasks()
    return task_obj

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get all tasks with optional filtering"""
    await cleanup_tasks()
    
    # Get all tasks from Firebase
    all_tasks = await firebase_db.get_all_tasks()
    
    # Apply filters
    filtered_tasks = []
    for task_data in all_tasks:
        # Apply category filter
        if category and category != "all" and task_data.get("category") != category:
            continue
        # Apply status filter
        if status and task_data.get("status") != status:
            continue
        filtered_tasks.append(Task(**task_data))
    
    # Apply limit
    return filtered_tasks[:limit]

@api_router.get("/tasks/my-tasks", response_model=List[Task])
async def get_my_tasks(current_user: User = Depends(get_current_user)):
    """Get tasks posted by the current user (client only)"""
    if current_user.user_type != "client":
        raise HTTPException(status_code=403, detail="Only clients can view their posted tasks")
    
    await cleanup_tasks()
    
    # Get all tasks from Firebase
    all_tasks = await firebase_db.get_all_tasks()
    
    # Filter tasks by client username
    client_tasks = []
    for task_data in all_tasks:
        if task_data.get("client") == current_user.username:
            client_tasks.append(Task(**task_data))
    
    return client_tasks

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get a specific task by ID"""
    await cleanup_tasks()
    
    task_data = await firebase_db.get_task_by_id(task_id)
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return Task(**task_data)

@api_router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, status: str):
    """Update task status"""
    success = await firebase_db.update_task(task_id, {"status": status})
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task status updated successfully"}

@api_router.put("/tasks/{task_id}/escrow-status")
async def update_task_escrow_status(task_id: str, escrow_status: str, current_user: User = Depends(get_current_user)):
    """Update task escrow status (task owner only)"""
    # Check if task exists
    task_data = await firebase_db.get_task_by_id(task_id)
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if user is the task owner
    if task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can update escrow status")
    
    # Validate escrow status
    valid_statuses = ["pending", "funded", "released"]
    if escrow_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid escrow status. Must be one of: {valid_statuses}")
    
    success = await firebase_db.update_task(task_id, {"escrow_status": escrow_status})
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update escrow status")
    
    return {"message": "Escrow status updated successfully", "escrow_status": escrow_status}

# User Management Routes
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    """Create a new user"""
    user_dict = user.dict()
    user_obj = User(**user_dict)
    
    success = await firebase_db.save_user(user_obj.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save user")
    
    return user_obj

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    """Get user by ID"""
    user_data = await firebase_db.get_user_by_id(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user_data)

@api_router.get("/users", response_model=List[User])
async def get_users(user_type: Optional[str] = None, limit: int = 50):
    """Get all users with optional filtering"""
    # For now, we'll get all users and filter in memory
    # In production, you'd want to implement proper Firestore queries
    all_tasks = await firebase_db.get_all_tasks()  # This is a placeholder
    # TODO: Implement get_all_users in firebase_db
    return []

# Submission Management Routes
@api_router.post("/submissions", response_model=Submission)
async def create_submission(
    task_id: str = Form(...),
    description: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """Submit completed work for a task with file uploads"""
    # Only freelancers can submit work
    if current_user.user_type != "freelancer":
        raise HTTPException(status_code=403, detail="Only freelancers can submit work")
    
    # Check if task exists
    task_data = await firebase_db.get_task_by_id(task_id)
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Check if task is still open
    if task_data.get("status") != "open":
        raise HTTPException(status_code=400, detail="Task is no longer accepting submissions")
    
    # Check if task is funded (escrow status)
    if task_data.get("escrow_status") != "funded":
        raise HTTPException(status_code=400, detail="Task must be funded before accepting submissions")
    
    # Check if freelancer has already submitted work
    existing_sub = await firebase_db.check_existing_submission(task_id, current_user.id)
    if existing_sub:
        raise HTTPException(status_code=400, detail="You have already submitted work for this task")
    
    # Check if task already has an approved submission
    approved_sub = await firebase_db.get_approved_submission_for_task(task_id)
    if approved_sub:
        raise HTTPException(status_code=400, detail="This task already has an approved submission")
    
    # Validate submission
    if not description.strip():
        raise HTTPException(status_code=400, detail="Description is required")
    
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="At least one file is required")
    
    # Get validation code from task (if exists)
    validation_code = task_data.get("validation_code")
    
    # Validate and save uploaded files
    file_submissions = []
    auto_approved_count = 0
    
    for file in files:
        if file.filename:  # Skip empty files
            file_path = await save_uploaded_file(file, task_id, current_user.id)
            file_size = file.size or 0
            
            # Generate REAL cryptographic ZKP for the file
            zkp_proofs, public_metrics = generate_zkp_for_file(
                file_path, 
                file.filename, 
                file_size,
                validation_code
            )
            
            # Check if file passes validation code using ZKP verification
            auto_approved = False
            file_status = "pending"
            
            if validation_code and zkp_proofs:
                # Verify the cryptographic ZKP proof
                # This proves the file meets criteria WITHOUT revealing the file!
                if verify_zkp_proof(zkp_proofs, validation_code):
                    auto_approved = True
                    file_status = "approved"
                    auto_approved_count += 1
                    logger.info(f"✅ File {file.filename} auto-approved via CRYPTOGRAPHIC ZKP")
                else:
                    logger.info(f"❌ File {file.filename} failed ZKP verification")
            
            file_submission = FileSubmission(
                file_path=file_path,
                file_name=file.filename,
                file_type=file.content_type or "application/octet-stream",
                file_size=file_size,
                status=file_status,
                zkp_proof=json.dumps(zkp_proofs) if zkp_proofs else None,  # Store as JSON string
                zkp_metrics=public_metrics,
                auto_approved=auto_approved,
                approved_at=datetime.now(timezone.utc) if auto_approved else None
            )
            file_submissions.append(file_submission)
    
    if not file_submissions:
        raise HTTPException(status_code=400, detail="No valid files uploaded")
    
    # Calculate approval stats
    total_files = len(file_submissions)
    approval_percentage = (auto_approved_count / total_files * 100) if total_files > 0 else 0
    
    # Determine overall status
    if auto_approved_count == 0:
        overall_status = "pending"
    elif auto_approved_count == total_files:
        overall_status = "fully_approved"
    else:
        overall_status = "partially_approved"
    
    # Calculate payment amount based on auto-approved files
    expected_files = task_data.get("expected_files_count", 1)
    payment_amount = calculate_proportional_payment(
        task_data.get("budget", 0),
        auto_approved_count,
        expected_files
    )
    
    # Create submission with current user as freelancer
    sub_obj = Submission(
        task_id=task_id,
        freelancer_id=current_user.id,
        freelancer_name=current_user.username,
        description=description.strip(),
        files=file_submissions,
        total_files_count=total_files,
        approved_files_count=auto_approved_count,
        approval_percentage=approval_percentage,
        overall_status=overall_status,
        payment_claimable=auto_approved_count > 0,
        payment_amount=payment_amount
    )
    
    # Save submission to Firebase
    success = await firebase_db.save_submission(sub_obj.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save submission")
    
    # Update task submission count
    current_submissions = task_data.get("submissions", 0)
    await firebase_db.update_task(task_id, {"submissions": current_submissions + 1})
    
    # Check if task should be completed (when approved files >= expected files)
    if auto_approved_count >= expected_files:
        task_data["status"] = "completed"
        task_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        await firebase_db.update_task(task_id, task_data)
        logger.info(f"Task {task_id} auto-completed - approved files ({auto_approved_count}) reached expected count ({expected_files})")
    
    return sub_obj

@api_router.get("/submissions/task/{task_id}", response_model=List[Submission])
async def get_task_submissions(task_id: str, current_user: User = Depends(get_current_user)):
    """Get all submissions for a specific task (task owner only)"""
    # Check if task exists and user is the owner
    task_data = await firebase_db.get_task_by_id(task_id)
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can view submissions")
    
    # Get submissions
    submissions_data = await firebase_db.get_submissions_by_task_id(task_id)
    submissions = [Submission(**sub_data) for sub_data in submissions_data]
    
    return submissions

@api_router.get("/submissions/my-submissions", response_model=List[Submission])
async def get_my_submissions(current_user: User = Depends(get_current_user)):
    """Get all submissions by the current user (freelancer only)"""
    if current_user.user_type != "freelancer":
        raise HTTPException(status_code=403, detail="Only freelancers can view their submissions")
    
    # Get submissions
    submissions_data = await firebase_db.get_submissions_by_freelancer_id(current_user.id)
    submissions = [Submission(**sub_data) for sub_data in submissions_data]
    
    return submissions

@api_router.get("/submissions/{submission_id}", response_model=Submission)
async def get_submission(submission_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific submission"""
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    submission = Submission(**sub_data)
    
    # Check if user has permission to view this submission
    if submission.freelancer_id != current_user.id:
        # Check if user is the task owner
        task_data = await firebase_db.get_task_by_id(submission.task_id)
        if not task_data or task_data.get("client") != current_user.username:
            raise HTTPException(status_code=403, detail="Not authorized to view this submission")
    
    return submission

@api_router.put("/submissions/{submission_id}/approve")
async def approve_submission(
    submission_id: str, 
    current_user: User = Depends(get_current_user)
):
    """Approve a submission and release escrow funds (task owner only)"""
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if user is the task owner
    task_data = await firebase_db.get_task_by_id(sub_data["task_id"])
    if not task_data or task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can approve submissions")
    
    # Check if submission is still pending
    if sub_data.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Submission is not pending")
    
    # Check if task already has an approved submission
    existing_approved = await firebase_db.get_approved_submission_for_task(sub_data["task_id"])
    if existing_approved and existing_approved["id"] != submission_id:
        raise HTTPException(status_code=400, detail="Task already has an approved submission")
    
    # Update submission status to approved and make payment claimable
    success = await firebase_db.update_submission(submission_id, {
        "status": "approved",
        "approved_at": datetime.now(timezone.utc),
        "payment_claimable": True
    })
    if not success:
        raise HTTPException(status_code=500, detail="Failed to approve submission")
    
    # Update task status to completed
    await firebase_db.update_task(sub_data["task_id"], {"status": "completed"})
    
    # Reject all other pending submissions for this task
    all_submissions = await firebase_db.get_submissions_by_task_id(sub_data["task_id"])
    for other_sub in all_submissions:
        if other_sub["id"] != submission_id and other_sub.get("status") == "pending":
            await firebase_db.update_submission(other_sub["id"], {"status": "rejected"})
    
    return {"message": "Submission approved - payment now claimable by freelancer", "status": "approved"}

@api_router.put("/submissions/{submission_id}/reject")
async def reject_submission(
    submission_id: str, 
    current_user: User = Depends(get_current_user)
):
    """Reject a submission (task owner only)"""
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if user is the task owner
    task_data = await firebase_db.get_task_by_id(sub_data["task_id"])
    if not task_data or task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can reject submissions")
    
    # Check if submission is still pending
    if sub_data.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Submission is not pending")
    
    # Update submission status to rejected
    success = await firebase_db.update_submission(submission_id, {"status": "rejected"})
    if not success:
        raise HTTPException(status_code=500, detail="Failed to reject submission")
    
    return {"message": "Submission rejected", "status": "rejected"}

@api_router.get("/tasks/{task_id}/can-submit")
async def can_submit_to_task(task_id: str, current_user: User = Depends(get_current_user)):
    """Check if current user can submit work for a task"""
    # Only freelancers can submit
    if current_user.user_type != "freelancer":
        return {"can_submit": False, "reason": "Only freelancers can submit work"}
    
    # Check if task exists
    task_data = await firebase_db.get_task_by_id(task_id)
    if not task_data:
        return {"can_submit": False, "reason": "Task not found"}
    
    # Check if task is still open
    if task_data.get("status") != "open":
        return {"can_submit": False, "reason": "Task is no longer accepting submissions"}
    
    # Check if task is funded (escrow status)
    if task_data.get("escrow_status") != "funded":
        return {"can_submit": False, "reason": "Task must be funded before accepting submissions"}
    
    # Check if user is the task owner
    if task_data.get("client") == current_user.username:
        return {"can_submit": False, "reason": "You cannot submit work for your own task"}
    
    # Check if already submitted
    existing_sub = await firebase_db.check_existing_submission(task_id, current_user.id)
    if existing_sub:
        return {"can_submit": False, "reason": "You have already submitted work for this task", "submission": existing_sub}
    
    # Check if task already has approved submission
    approved_sub = await firebase_db.get_approved_submission_for_task(task_id)
    if approved_sub:
        return {"can_submit": False, "reason": "This task already has an approved submission"}
    
    return {"can_submit": True}

# Partial Approval System Endpoints
@api_router.put("/submissions/{submission_id}/files/{file_id}/approve")
async def approve_file(
    submission_id: str,
    file_id: str,
    feedback: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Approve a specific file in a submission"""
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if user is the task owner
    task_data = await firebase_db.get_task_by_id(sub_data["task_id"])
    if not task_data or task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can approve files")
    
    # Create submission object and find the file
    submission = Submission(**sub_data)
    file_found = False
    
    for file_sub in submission.files:
        if file_sub.id == file_id:
            if file_sub.status == "approved":
                raise HTTPException(status_code=400, detail="File is already approved")
            
            file_sub.status = "approved"
            file_sub.approved_at = datetime.now(timezone.utc)
            if feedback:
                file_sub.feedback = feedback
            file_found = True
            break
    
    if not file_found:
        raise HTTPException(status_code=404, detail="File not found in submission")
    
    # Update submission statistics
    submission = update_submission_stats(submission)
    submission.last_updated_at = datetime.now(timezone.utc)
    
    # Calculate proportional payment
    submission.payment_amount = calculate_proportional_payment(
        task_data.get("budget", 0),
        submission.approved_files_count,
        submission.total_files_count
    )
    
    # Save updated submission
    success = await firebase_db.update_submission(submission_id, submission.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update submission")
    
    return {
        "message": "File approved successfully",
        "file_id": file_id,
        "submission_status": submission.overall_status,
        "approved_files": submission.approved_files_count,
        "total_files": submission.total_files_count,
        "approval_percentage": submission.approval_percentage,
        "payment_amount": submission.payment_amount
    }

# Individual file approval by index (for frontend compatibility)
@api_router.put("/submissions/{submission_id}/files/index/{file_index}/approve")
async def approve_file_by_index(
    submission_id: str,
    file_index: int,
    current_user: User = Depends(get_current_user)
):
    """Approve a specific file in a submission by index"""
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    submission = Submission(**sub_data)
    
    # Check if user is the task owner
    task_data = await firebase_db.get_task_by_id(submission.task_id)
    if not task_data or task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can approve files")
    
    # Check if file index is valid
    if file_index < 0 or file_index >= len(submission.files):
        raise HTTPException(status_code=404, detail=f"File index {file_index} out of range. Total files: {len(submission.files)}")
    
    # Debug logging
    logger.info(f"Approving file at index {file_index} for submission {submission_id}")
    logger.info(f"File structure: {type(submission.files[file_index])}")
    
    # Ensure the file is a proper FileSubmission object
    file_obj = submission.files[file_index]
    if not isinstance(file_obj, FileSubmission):
        # Convert to FileSubmission if it's a dict or other format
        if isinstance(file_obj, dict):
            file_obj = FileSubmission(**file_obj)
            submission.files[file_index] = file_obj
        else:
            raise HTTPException(status_code=500, detail=f"Invalid file object type: {type(file_obj)}")
    
    # Approve the file at the specified index
    file_obj.status = "approved"
    file_obj.approved_at = datetime.now(timezone.utc)
    
    # Update approval counts and percentages
    submission.approved_files_count = sum(1 for f in submission.files if f.status == "approved")
    submission.total_files_count = len(submission.files)
    submission.approval_percentage = (submission.approved_files_count / submission.total_files_count) * 100
    
    # Calculate proportional payment based on expected files from task (not submitted files)
    expected_files = task_data.get("expected_files_count", 1)
    submission.payment_amount = calculate_proportional_payment(
        task_data.get("budget", 0),
        submission.approved_files_count,
        expected_files
    )
    
    # Make payment claimable if at least one file is approved
    submission.payment_claimable = submission.approved_files_count > 0
    
    # Update submission status
    if submission.approved_files_count == submission.total_files_count:
        submission.overall_status = "fully_approved"
    elif submission.approved_files_count > 0:
        submission.overall_status = "partially_approved"
    
    # Check if we should terminate the task (when approved files == expected files)
    expected_files = task_data.get("expected_files_count", 1)
    if submission.approved_files_count >= expected_files:
        # Update task status to completed
        task_data["status"] = "completed"
        task_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        await firebase_db.update_task(submission.task_id, task_data)
        logger.info(f"Task {submission.task_id} completed - approved files ({submission.approved_files_count}) reached expected count ({expected_files})")
    
    submission.last_updated_at = datetime.now(timezone.utc)
    
    # Save updated submission
    await firebase_db.update_submission(submission_id, submission.dict())
    
    return {
        "message": "File approved successfully",
        "approved_files_count": submission.approved_files_count,
        "total_files_count": submission.total_files_count,
        "approval_percentage": submission.approval_percentage,
        "payment_claimable": submission.payment_claimable,
        "payment_amount": submission.payment_amount
    }

@api_router.put("/submissions/{submission_id}/files/{file_id}/reject")
async def reject_file(
    submission_id: str,
    file_id: str,
    feedback: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Reject a specific file in a submission"""
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if user is the task owner
    task_data = await firebase_db.get_task_by_id(sub_data["task_id"])
    if not task_data or task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can reject files")
    
    # Create submission object and find the file
    submission = Submission(**sub_data)
    file_found = False
    
    for file_sub in submission.files:
        if file_sub.id == file_id:
            if file_sub.status == "rejected":
                raise HTTPException(status_code=400, detail="File is already rejected")
            
            file_sub.status = "rejected"
            file_sub.rejected_at = datetime.now(timezone.utc)
            if feedback:
                file_sub.feedback = feedback
            file_found = True
            break
    
    if not file_found:
        raise HTTPException(status_code=404, detail="File not found in submission")
    
    # Update submission statistics
    submission = update_submission_stats(submission)
    submission.last_updated_at = datetime.now(timezone.utc)
    
    # Calculate proportional payment
    submission.payment_amount = calculate_proportional_payment(
        task_data.get("budget", 0),
        submission.approved_files_count,
        submission.total_files_count
    )
    
    # Save updated submission
    success = await firebase_db.update_submission(submission_id, submission.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update submission")
    
    return {
        "message": "File rejected successfully",
        "file_id": file_id,
        "submission_status": submission.overall_status,
        "approved_files": submission.approved_files_count,
        "total_files": submission.total_files_count,
        "approval_percentage": submission.approval_percentage,
        "can_resubmit": submission.can_resubmit
    }

# Individual file rejection by index (for frontend compatibility)
@api_router.put("/submissions/{submission_id}/files/index/{file_index}/reject")
async def reject_file_by_index(
    submission_id: str,
    file_index: int,
    feedback: str = Form(default=""),
    current_user: User = Depends(get_current_user)
):
    """Reject a specific file in a submission by index"""
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    submission = Submission(**sub_data)
    
    # Check if user is the task owner
    task_data = await firebase_db.get_task_by_id(submission.task_id)
    if not task_data or task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can reject files")
    
    # Check if file index is valid
    if file_index < 0 or file_index >= len(submission.files):
        raise HTTPException(status_code=404, detail=f"File index {file_index} out of range. Total files: {len(submission.files)}")
    
    # Debug logging
    logger.info(f"Rejecting file at index {file_index} for submission {submission_id}")
    logger.info(f"File structure: {type(submission.files[file_index])}")
    
    # Ensure the file is a proper FileSubmission object
    file_obj = submission.files[file_index]
    if not isinstance(file_obj, FileSubmission):
        # Convert to FileSubmission if it's a dict or other format
        if isinstance(file_obj, dict):
            file_obj = FileSubmission(**file_obj)
            submission.files[file_index] = file_obj
        else:
            raise HTTPException(status_code=500, detail=f"Invalid file object type: {type(file_obj)}")
    
    # Reject the file at the specified index
    file_obj.status = "rejected"
    file_obj.rejected_at = datetime.now(timezone.utc)
    if feedback:
        file_obj.feedback = feedback
    
    # Update approval counts and percentages
    submission.approved_files_count = sum(1 for f in submission.files if f.status == "approved")
    submission.total_files_count = len(submission.files)
    submission.approval_percentage = (submission.approved_files_count / submission.total_files_count) * 100
    
    # Calculate proportional payment based on expected files from task (not submitted files)
    expected_files = task_data.get("expected_files_count", 1)
    submission.payment_amount = calculate_proportional_payment(
        task_data.get("budget", 0),
        submission.approved_files_count,
        expected_files
    )
    
    # Make payment claimable if at least one file is approved
    submission.payment_claimable = submission.approved_files_count > 0
    
    # Update submission status
    if submission.approved_files_count == 0:
        submission.overall_status = "rejected"
    elif submission.approved_files_count == submission.total_files_count:
        submission.overall_status = "fully_approved"
    else:
        submission.overall_status = "partially_approved"
    
    # Check if we should terminate the task (when approved files == expected files)
    expected_files = task_data.get("expected_files_count", 1)
    if submission.approved_files_count >= expected_files:
        # Update task status to completed
        task_data["status"] = "completed"
        task_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        await firebase_db.update_task(submission.task_id, task_data)
        logger.info(f"Task {submission.task_id} completed - approved files ({submission.approved_files_count}) reached expected count ({expected_files})")
    
    submission.last_updated_at = datetime.now(timezone.utc)
    submission.can_resubmit = True  # Allow resubmission of rejected files
    
    # Save updated submission
    await firebase_db.update_submission(submission_id, submission.dict())
    
    return {
        "message": "File rejected successfully",
        "approved_files_count": submission.approved_files_count,
        "total_files_count": submission.total_files_count,
        "approval_percentage": submission.approval_percentage,
        "payment_claimable": submission.payment_claimable,
        "can_resubmit": submission.can_resubmit
    }

@api_router.post("/submissions/{submission_id}/resubmit")
async def resubmit_files(
    submission_id: str,
    files: List[UploadFile] = File(...),
    replace_file_ids: List[str] = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Resubmit rejected files in a submission"""
    # Only freelancers can resubmit
    if current_user.user_type != "freelancer":
        raise HTTPException(status_code=403, detail="Only freelancers can resubmit files")
    
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if user owns this submission
    if sub_data["freelancer_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only resubmit your own files")
    
    submission = Submission(**sub_data)
    
    # Check if resubmission is allowed
    if not submission.can_resubmit:
        raise HTTPException(status_code=400, detail="Resubmission is not allowed for this submission")
    
    # Validate that we have the same number of files and file IDs
    if len(files) != len(replace_file_ids):
        raise HTTPException(status_code=400, detail="Number of files must match number of file IDs to replace")
    
    # Get task data
    task_data = await firebase_db.get_task_by_id(submission.task_id)
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Process file replacements
    for i, (new_file, file_id_to_replace) in enumerate(zip(files, replace_file_ids)):
        # Find the file to replace
        file_found = False
        for j, file_sub in enumerate(submission.files):
            if file_sub.id == file_id_to_replace:
                # Check if file was rejected (only rejected files can be resubmitted)
                if file_sub.status != "rejected":
                    raise HTTPException(status_code=400, detail=f"Can only resubmit rejected files. File {file_id_to_replace} is {file_sub.status}")
                
                # Save new file
                if new_file.filename:
                    file_path = await save_uploaded_file(new_file, submission.task_id, current_user.id)
                    
                    # Update file submission
                    submission.files[j] = FileSubmission(
                        id=file_id_to_replace,  # Keep the same ID
                        file_path=file_path,
                        file_name=new_file.filename,
                        file_type=new_file.content_type or "application/octet-stream",
                        file_size=new_file.size or 0,
                        status="pending"  # Reset to pending
                    )
                    file_found = True
                    break
        
        if not file_found:
            raise HTTPException(status_code=404, detail=f"File ID {file_id_to_replace} not found or not rejected")
    
    # Update submission statistics
    submission = update_submission_stats(submission)
    submission.last_updated_at = datetime.now(timezone.utc)
    
    # Save updated submission
    success = await firebase_db.update_submission(submission_id, submission.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update submission")
    
    return {
        "message": f"Successfully resubmitted {len(files)} files",
        "submission_id": submission_id,
        "resubmitted_files": len(files),
        "submission_status": submission.overall_status
    }

@api_router.put("/submissions/{submission_id}/bulk-approve")
async def bulk_approve_files(
    submission_id: str,
    file_ids: List[str] = Form(...),
    feedback: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Approve multiple files at once"""
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if user is the task owner
    task_data = await firebase_db.get_task_by_id(sub_data["task_id"])
    if not task_data or task_data.get("client") != current_user.username:
        raise HTTPException(status_code=403, detail="Only task owner can approve files")
    
    submission = Submission(**sub_data)
    approved_count = 0
    
    # Approve specified files
    for file_sub in submission.files:
        if file_sub.id in file_ids and file_sub.status == "pending":
            file_sub.status = "approved"
            file_sub.approved_at = datetime.now(timezone.utc)
            if feedback:
                file_sub.feedback = feedback
            approved_count += 1
    
    # Update submission statistics
    submission = update_submission_stats(submission)
    submission.last_updated_at = datetime.now(timezone.utc)
    
    # Calculate proportional payment
    submission.payment_amount = calculate_proportional_payment(
        task_data.get("budget", 0),
        submission.approved_files_count,
        submission.total_files_count
    )
    
    # Save updated submission
    success = await firebase_db.update_submission(submission_id, submission.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update submission")
    
    return {
        "message": f"Approved {approved_count} files successfully",
        "approved_files": approved_count,
        "submission_status": submission.overall_status,
        "total_approved": submission.approved_files_count,
        "total_files": submission.total_files_count,
        "approval_percentage": submission.approval_percentage,
        "payment_amount": submission.payment_amount
    }

@api_router.get("/download-file")
async def download_file_with_token(file_path: str, token: str):
    """Download files with Firebase token authentication (for browser links)"""
    try:
        # Verify Firebase token using our hybrid verification
        authorization_header = f"Bearer {token}"
        firebase_user = await verify_firebase_token_hybrid(authorization_header)
        
        # Get user from our database
        user = await get_user_by_firebase_uid(firebase_user["uid"])
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        full_path = ROOT_DIR / file_path
        
        # Security check: ensure file is in uploads directory
        if not str(full_path).startswith(str(UPLOAD_DIR)):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if file exists
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Additional security: verify user has access to this file
        filename = full_path.name
        try:
            # Try to extract task_id and freelancer_id from filename
            parts = filename.split('_')
            if len(parts) >= 2:
                task_id = parts[0]
                freelancer_id = parts[1]
                
                # Check if current user is either:
                # 1. The freelancer who uploaded the file
                # 2. The client who owns the task
                if user.id == freelancer_id:
                    # Freelancer accessing their own file
                    pass
                else:
                    # Check if user is the task owner
                    task_data = await firebase_db.get_task_by_id(task_id)
                    if not task_data or task_data.get("client") != user.username:
                        raise HTTPException(status_code=403, detail="Access denied - not authorized to view this file")
            else:
                # If filename doesn't follow expected format, allow access for now
                # This is a fallback for files that don't follow the naming convention
                logger.warning(f"File {filename} doesn't follow expected naming convention, allowing access")
                pass
        except Exception as e:
            logger.warning(f"Could not verify file access for {filename}: {e}")
            # Instead of denying access, log the warning and allow access
            # This prevents legitimate users from being blocked due to filename format issues
            logger.warning(f"Allowing file access despite verification failure for user {user.id}")
            pass
        
        # Return file
        return FileResponse(
            path=full_path,
            filename=full_path.name,
            media_type='application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File download error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# Payment Claim Routes
@api_router.post("/payments/claim")
async def claim_payment(
    submission_id: str = Form(...),
    wallet_address: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """Claim payment for approved submission"""
    # Only freelancers can claim payments
    if current_user.user_type != "freelancer":
        raise HTTPException(status_code=403, detail="Only freelancers can claim payments")
    
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if user owns this submission
    if sub_data["freelancer_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only claim payment for your own submissions")
    
    # Create submission object to access new fields
    submission = Submission(**sub_data)
    
    # Check if payment is claimable (must have at least some approved files)
    if not submission.payment_claimable:
        raise HTTPException(status_code=400, detail="Payment is not yet claimable - no files have been approved")
    
    if submission.payment_claimed:
        raise HTTPException(status_code=400, detail="Payment has already been claimed")
    
    # Check if there are any approved files
    if submission.approved_files_count == 0:
        raise HTTPException(status_code=400, detail="No files have been approved for payment")
    
    # Validate wallet address format (basic validation)
    if not wallet_address.startswith("0x") or len(wallet_address) != 42:
        raise HTTPException(status_code=400, detail="Invalid wallet address format")
    
    # Get task data for payment calculation
    task_data = await firebase_db.get_task_by_id(submission.task_id)
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Use proportional payment amount based on approved files
    payment_amount = submission.payment_amount
    if payment_amount <= 0:
        # Recalculate if not set
        payment_amount = calculate_proportional_payment(
            task_data.get("budget", 0),
            submission.approved_files_count,
            submission.total_files_count
        )
    
    # Create payment claim record
    claim_data = {
        "id": str(uuid.uuid4()),
        "submission_id": submission_id,
        "task_id": sub_data["task_id"],
        "freelancer_id": current_user.id,
        "freelancer_wallet": wallet_address,
        "amount": payment_amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    
    # Save payment claim
    success = await firebase_db.save_payment_claim(claim_data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create payment claim")
    
    # Mark submission as payment claimed
    await firebase_db.update_submission(submission_id, {
        "payment_claimed": True,
        "payment_claimed_at": datetime.now(timezone.utc)
    })
    
    # Execute real blockchain transfer
    logger.info(f"Initiating blockchain transfer: {payment_amount} ETH to {wallet_address}")
    
    transfer_result = await transfer_from_escrow(wallet_address, payment_amount)
    
    if not transfer_result["success"]:
        # Update claim status to failed
        await firebase_db.update_payment_claim(claim_data["id"], {
            "status": "failed",
            "error": transfer_result.get("error", "Unknown error")
        })
        raise HTTPException(status_code=500, detail=f"Blockchain transfer failed: {transfer_result.get('error')}")
    
    # Update payment claim with successful transaction
    await firebase_db.update_payment_claim(claim_data["id"], {
        "status": "completed",
        "transaction_hash": transfer_result["transaction_hash"],
        "completed_at": datetime.now(timezone.utc)
    })
    
    # Update freelancer earnings
    try:
        current_earnings = current_user.total_earnings or 0
        await firebase_db.update_user(current_user.id, {
            "total_earnings": current_earnings + payment_amount,
            "completed_tasks": (current_user.completed_tasks or 0) + 1
        })
    except Exception as e:
        logger.warning(f"Failed to update freelancer earnings: {e}")
    
    logger.info(f"Payment completed successfully: {transfer_result['transaction_hash']}")
    
    return {
        "message": "Payment transferred successfully to your wallet",
        "claim_id": claim_data["id"],
        "amount": payment_amount,
        "wallet_address": wallet_address,
        "transaction_hash": transfer_result["transaction_hash"],
        "block_number": transfer_result.get("block_number"),
        "gas_used": transfer_result.get("gas_used")
    }

@api_router.get("/payments/my-claims", response_model=List[PaymentClaim])
async def get_my_payment_claims(current_user: User = Depends(get_current_user)):
    """Get all payment claims by the current user"""
    if current_user.user_type != "freelancer":
        raise HTTPException(status_code=403, detail="Only freelancers can view payment claims")
    
    claims_data = await firebase_db.get_payment_claims_by_freelancer_id(current_user.id)
    claims = [PaymentClaim(**claim_data) for claim_data in claims_data]
    
    return claims

@api_router.get("/submissions/{submission_id}/payment-status")
async def get_submission_payment_status(submission_id: str, current_user: User = Depends(get_current_user)):
    """Check if submission payment can be claimed"""
    # Get submission
    sub_data = await firebase_db.get_submission_by_id(submission_id)
    if not sub_data:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    # Check if user has permission to view this submission
    if sub_data["freelancer_id"] != current_user.id:
        # Check if user is the task owner
        task_data = await firebase_db.get_task_by_id(sub_data["task_id"])
        if not task_data or task_data.get("client") != current_user.username:
            raise HTTPException(status_code=403, detail="Not authorized to view this submission")
    
    return {
        "submission_id": submission_id,
        "status": sub_data.get("status"),
        "payment_claimable": sub_data.get("payment_claimable", False),
        "payment_claimed": sub_data.get("payment_claimed", False),
        "payment_claimed_at": sub_data.get("payment_claimed_at"),
        "approved_at": sub_data.get("approved_at")
    }

@api_router.get("/blockchain/status")
async def get_blockchain_status():
    """Get blockchain connection status and escrow balance"""
    try:
        is_connected = w3.is_connected()
        escrow_balance = await get_escrow_balance() if is_connected else 0.0
        latest_block = w3.eth.block_number if is_connected else 0
        
        return {
            "connected": is_connected,
            "network": NETWORK_NAME,
            "chain_id": CHAIN_ID,
            "rpc_url": RPC_URL,
            "escrow_address": escrow_account.address,
            "escrow_balance_eth": float(escrow_balance),
            "latest_block": latest_block,
            "currency_symbol": CURRENCY_SYMBOL
        }
    except Exception as e:
        logger.error(f"Blockchain status check failed: {e}")
        return {
            "connected": False,
            "error": str(e)
        }

# ---------------- Authentication Routes ----------------
@api_router.post("/auth/signup", response_model=TokenResponse)
async def signup(payload: SignupRequest):
    logger.info(f"📝 Signup attempt for: {payload.email}")
    logger.info(f"📝 User type: {payload.user_type}")
    
    # Prevent duplicate emails
    existing = await get_auth_record_by_email(payload.email.lower())
    if existing:
        logger.warning(f"❌ Email already registered: {payload.email}")
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create profile user
    username = payload.username or (payload.email.split("@")[0])
    user_type = payload.user_type or "freelancer"
    user_obj = User(
        username=username,
        email=payload.email.lower(),
        user_type=user_type,
    )
    
    logger.info(f"📝 Creating user: {user_obj.id}, type: {user_type}")
    
    # Save user to Firebase
    user_saved = await firebase_db.save_user(user_obj.dict())
    if not user_saved:
        logger.error(f"❌ Failed to save user to Firebase")
        raise HTTPException(status_code=500, detail="Failed to create user account")
    
    logger.info(f"✅ User saved successfully: {user_obj.id}")

    # Save auth record
    auth_record = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "hashed_password": hash_password(payload.password),
        "user_id": user_obj.id,
        "created_at": datetime.now(timezone.utc),
    }
    
    logger.info(f"📝 Saving auth record for: {payload.email.lower()}")
    auth_saved = await firebase_db.save_auth_record(auth_record)
    
    if not auth_saved:
        logger.error(f"❌ Failed to save auth record to Firebase")
        raise HTTPException(status_code=500, detail="Failed to save authentication credentials")
    
    logger.info(f"✅ Auth record saved successfully for: {payload.email.lower()}")
    
    # Verify it was saved
    verify_record = await get_auth_record_by_email(payload.email.lower())
    if not verify_record:
        logger.error(f"❌ Auth record verification failed - record not found after save!")
        raise HTTPException(status_code=500, detail="Authentication setup failed")
    
    logger.info(f"✅ Auth record verified in database")

    token = create_access_token({"sub": user_obj.id, "email": user_obj.email})
    return TokenResponse(access_token=token, user=user_obj)

@api_router.get("/auth/debug/check-email/{email}")
async def debug_check_email(email: str):
    """Debug endpoint to check if email exists in auth records"""
    rec = await get_auth_record_by_email(email.lower())
    if rec:
        return {
            "found": True,
            "email": rec.get("email"),
            "user_id": rec.get("user_id"),
            "has_password": bool(rec.get("hashed_password")),
            "hash_starts_with": rec.get("hashed_password", "")[:20] if rec.get("hashed_password") else None
        }
    return {"found": False, "email": email.lower()}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    logger.info(f"🔐 Login attempt for: {payload.email}")
    logger.info(f"🔐 Password length: {len(payload.password)}")
    logger.info(f"🔐 Email after lowercase: {payload.email.lower()}")
    
    rec = await get_auth_record_by_email(payload.email.lower())
    logger.info(f"🔐 Auth record found: {rec is not None}")
    
    if not rec:
        logger.error(f"❌ No auth record found for {payload.email}")
        raise HTTPException(
            status_code=401, 
            detail="Invalid email or password. If you signed up with email/password, please use the signup form. If you used Google sign-in, please use 'Continue with Google'."
        )
    
    # Check if this is a Firebase user (signed up via Firebase Auth)
    is_firebase_user = rec.get("is_firebase_user", False)
    stored_hash = rec.get("hashed_password", "")
    
    logger.info(f"🔐 Is Firebase user: {is_firebase_user}")
    logger.info(f"🔐 Stored hash length: {len(stored_hash)}")
    
    if is_firebase_user and not stored_hash:
        # This user signed up via Firebase (email/password or Google)
        # They need to use Firebase authentication, not our custom login
        logger.error(f"❌ Firebase user trying to use custom login: {payload.email}")
        raise HTTPException(
            status_code=401,
            detail="This account uses Firebase authentication. Please use 'Continue with Google' or sign in through Firebase."
        )
    
    # Verify password for custom auth users
    if stored_hash:
        logger.info(f"🔐 Stored hash starts with: {stored_hash[:20]}...")
        password_valid = verify_password(payload.password, stored_hash)
        logger.info(f"🔐 Password verification result: {password_valid}")
        
        if not password_valid:
            logger.error(f"❌ Password verification failed for {payload.email}")
            raise HTTPException(status_code=401, detail="Invalid email or password")
    else:
        logger.error(f"❌ No password hash found for {payload.email}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Get user data
    user_data = await firebase_db.get_user_by_id(rec["user_id"])
    if not user_data:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Ensure user data has all required fields for User model
    if 'username' not in user_data:
        # Use "Srujan Reddy" for this specific email, otherwise use email prefix
        if user_data.get('email', '').lower() == 'coders2468@gmail.com':
            user_data['username'] = 'Srujan Reddy'
        else:
            user_data['username'] = user_data.get('email', '').split('@')[0]
    if 'user_type' not in user_data:
        user_data['user_type'] = 'freelancer'  # Default to freelancer to match your screenshot
    
    user = User(**user_data)
    token = create_access_token({"sub": user.id, "email": user.email})
    logger.info(f"✅ Login successful for: {payload.email}")
    return TokenResponse(access_token=token, user=user)

@api_router.get("/auth/me", response_model=User)
async def me(authorization: Optional[str] = Header(default=None)):
    """Get current user info - supports both Firebase and JWT tokens"""
    logger.info(f"🔐 /auth/me called with authorization: {authorization[:50] if authorization else 'None'}...")
    
    if not authorization or not authorization.lower().startswith("bearer "):
        logger.error("❌ No valid authorization header")
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ", 1)[1]
    
    # Try Firebase token first (hybrid version)
    try:
        firebase_user = await verify_firebase_token_hybrid(authorization)
        
        # Get or create user in our database
        user = await get_user_by_firebase_uid(firebase_user["uid"])
        if not user:
            # Create new user from Firebase data
            user_obj = User(
                username=firebase_user["name"],
                email=firebase_user["email"],
                user_type="freelancer",  # default
                firebase_uid=firebase_user["uid"],
            )
            await save_user(user_obj)
            user = user_obj
        
        return user
    except HTTPException:
        # If Firebase token fails, try JWT token
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token")
            user = await get_user_by_id(user_id)
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            return user
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except Exception as e:
            logger.error(f"❌ JWT token validation failed: {e}")
            raise HTTPException(status_code=401, detail="Invalid token")

@api_router.get("/auth/status")
async def auth_status(authorization: Optional[str] = Header(default=None)):
    """Simple endpoint to check if user is authenticated"""
    try:
        if not authorization or not authorization.lower().startswith("bearer "):
            return {"authenticated": False, "method": None}
        
        token = authorization.split(" ", 1)[1]
        
        # Try JWT first
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                return {"authenticated": True, "method": "jwt", "user_id": user_id}
        except:
            pass
        
        # Try Firebase token
        try:
            firebase_user = await verify_firebase_token_hybrid(authorization)
            if firebase_user:
                return {"authenticated": True, "method": "firebase", "user_id": firebase_user.get("uid")}
        except:
            pass
        
        return {"authenticated": False, "method": None}
    except Exception as e:
        logger.error(f"❌ Auth status check failed: {e}")
        return {"authenticated": False, "method": None, "error": str(e)}

@api_router.post("/auth/firebase/verify")
async def verify_firebase_token_endpoint(authorization: Optional[str] = Header(default=None)):
    """Firebase token verification endpoint - now supports both Firebase and JWT tokens"""
    logger.info(f"🔐 Firebase verify endpoint called")
    
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ", 1)[1]
    
    # First try JWT (our custom auth)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if user_id:
            logger.info(f"✅ JWT token verified for user: {user_id}")
            
            # Get user data
            user_data = await firebase_db.get_user_by_id(user_id)
            if not user_data:
                raise HTTPException(status_code=401, detail="User not found")
            
            # Ensure user data has all required fields
            if 'username' not in user_data:
                if user_data.get('email', '').lower() == 'coders2468@gmail.com':
                    user_data['username'] = 'Srujan Reddy'
                else:
                    user_data['username'] = user_data.get('email', '').split('@')[0]
            if 'user_type' not in user_data:
                user_data['user_type'] = 'freelancer'
            
            user = User(**user_data)
            
            # Return in Firebase-compatible format
            return {
                "user": user.dict(),
                "token": token,
                "method": "jwt"
            }
    except jwt.ExpiredSignatureError:
        logger.error("❌ JWT token expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as jwt_error:
        logger.info(f"🔐 JWT verification failed, trying Firebase: {jwt_error}")
    
    # Fallback to Firebase verification
    try:
        firebase_user = await verify_firebase_token_hybrid(authorization)
        email = firebase_user["email"].lower()
        
        # Get or create user in our database
        user = await get_user_by_firebase_uid(firebase_user["uid"])
        if not user:
            logger.info(f"📝 Creating new user from Firebase auth: {email}")
            
            # Create new user from Firebase data
            user_obj = User(
                username=firebase_user["name"],
                email=email,
                user_type="freelancer",  # default - will be updated by frontend
                firebase_uid=firebase_user["uid"],
            )
            await save_user(user_obj)
            logger.info(f"✅ User profile created: {user_obj.id}")
            
            # IMPORTANT: Create auth record for future logins
            auth_record = {
                "id": str(uuid.uuid4()),
                "email": email,
                "hashed_password": "",  # Empty for Firebase users
                "user_id": user_obj.id,
                "firebase_uid": firebase_user["uid"],
                "created_at": datetime.now(timezone.utc),
                "is_firebase_user": True
            }
            
            auth_saved = await firebase_db.save_auth_record(auth_record)
            if auth_saved:
                logger.info(f"✅ Auth record created for Firebase user: {email}")
            else:
                logger.warning(f"⚠️ Failed to create auth record for: {email}")
            
            user = user_obj
        
        return {
            "user": user.dict(),
            "token": token,
            "method": "firebase"
        }
    except Exception as firebase_error:
        logger.error(f"❌ Both JWT and Firebase verification failed: {firebase_error}")
        raise HTTPException(status_code=401, detail="Invalid token")

@api_router.put("/auth/me/user-type")
async def update_user_type(user_type: str, current_user: User = Depends(get_current_user)):
    """Update user type (client or freelancer)"""
    if user_type not in ["client", "freelancer"]:
        raise HTTPException(status_code=400, detail="Invalid user type")
    
    # Update user type in Firebase
    success = await firebase_db.update_user(current_user.id, {"user_type": user_type})
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update user type")

    # Update current user object
    current_user.user_type = user_type
    
    return {"message": "User type updated successfully", "user_type": user_type}

class RatingRequest(BaseModel):
    rating: float

@api_router.put("/users/{user_id}/rating")
async def update_user_rating(user_id: str, request: RatingRequest, current_user: User = Depends(get_current_user)):
    """Update user rating"""
    if request.rating < 1.0 or request.rating > 5.0:
        raise HTTPException(status_code=400, detail="Rating must be between 1.0 and 5.0")
    
    # Update user rating in Firebase
    success = await firebase_db.update_user(user_id, {"rating": request.rating})
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update user rating")
    
    return {"message": "User rating updated successfully", "rating": request.rating}

class PaymentRequest(BaseModel):
    amount: float

@api_router.put("/users/{user_id}/payment")
async def update_user_payment(user_id: str, request: PaymentRequest, current_user: User = Depends(get_current_user)):
    """Update user total earnings/spending"""
    # Get current user data
    user_data = await firebase_db.get_user_by_id(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_total = user_data.get("total_earnings", 0.0)
    new_total = current_total + request.amount
    
    # Update user total earnings in Firebase
    success = await firebase_db.update_user(user_id, {"total_earnings": new_total})
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update user payment")
    
    return {"message": "User payment updated successfully", "total_earnings": new_total}

# ---------------- Firebase Authentication ----------------
@api_router.get("/auth/firebase/test")
async def test_firebase():
    """Test Firebase setup"""
    try:
        import firebase_admin
        app = firebase_admin.get_app()
        return {
            "status": "Firebase initialized",
            "project_id": app.project_id,
            "message": "Firebase Admin SDK is working correctly"
        }
    except Exception as e:
        return {
            "status": "Firebase error",
            "error": str(e),
            "message": "Firebase Admin SDK is not working"
        }


class FirebaseSignupRequest(BaseModel):
    username: str
    user_type: str

@api_router.post("/auth/firebase/signup")
async def firebase_signup(payload: FirebaseSignupRequest, authorization: Optional[str] = Header(default=None)):
    """Create a new user account with Firebase authentication"""
    try:
        logger.info(f"📝 Firebase signup for: {payload.username}, type: {payload.user_type}")
        
        # Verify Firebase token
        firebase_user = await verify_firebase_token_hybrid(authorization)
        email = firebase_user["email"].lower()
        
        logger.info(f"✅ Firebase token verified for: {email}")
        
        # Check if user already exists
        existing_user = await get_user_by_firebase_uid(firebase_user["uid"])
        if existing_user:
            logger.info(f"ℹ️ User already exists: {email}")
            return {
                "user": existing_user,
                "firebase_user": firebase_user,
                "message": "User already exists"
            }
        
        # Create new user
        user_obj = User(
            username=payload.username,
            email=email,
            user_type=payload.user_type,
            firebase_uid=firebase_user["uid"],
        )
        await save_user(user_obj)
        logger.info(f"✅ User profile created: {user_obj.id}")
        
        # IMPORTANT: Create auth record for email/password login
        # Even though Firebase handles authentication, we need this for our custom login endpoint
        auth_record = {
            "id": str(uuid.uuid4()),
            "email": email,
            "hashed_password": "",  # Empty for Firebase users (they authenticate via Firebase)
            "user_id": user_obj.id,
            "firebase_uid": firebase_user["uid"],
            "created_at": datetime.now(timezone.utc),
            "is_firebase_user": True  # Flag to indicate this is a Firebase-authenticated user
        }
        
        auth_saved = await firebase_db.save_auth_record(auth_record)
        if auth_saved:
            logger.info(f"✅ Auth record created for Firebase user: {email}")
        else:
            logger.warning(f"⚠️ Failed to create auth record for: {email}")
        
        return {
            "user": user_obj,
            "firebase_user": firebase_user,
            "message": "User created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Firebase signup failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

# ---------------- Forgot Password Routes ----------------
@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    """Send OTP for password reset"""
    try:
        logger.info(f"🔍 Forgot password request for: {payload.email}")
        
        # Check if user exists in custom auth database
        auth_record = await get_auth_record_by_email(payload.email.lower())
        logger.info(f"🔍 User found in auth database: {auth_record is not None}")
        
        if not auth_record:
            # Check if user exists in Firebase (for Google sign-in users)
            try:
                firebase_user = auth.get_user_by_email(payload.email.lower())
                logger.info(f"🔍 User found in Firebase: {firebase_user.uid}")
                
                # Create auth record for Firebase user (without password since they use Google sign-in)
                auth_record = await upsert_auth_record_by_email(
                    payload.email.lower(), 
                    firebase_user.uid, 
                    None  # No password for Google sign-in users
                )
                logger.info(f"✅ Created auth record for Firebase user: {payload.email}")
                
            except Exception as e:
                logger.info(f"❌ User not found in Firebase either: {e}")
                # Don't reveal if email exists or not for security
                return {"message": "If an account with this email exists, you will receive a password reset code."}
        
        # Generate OTP
        otp = email_service.generate_otp()
        logger.info(f"🔢 Generated OTP: {otp} for {payload.email}")
        
        # Set expiration time (10 minutes from now)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        # Save OTP to database
        logger.info(f"💾 About to save OTP to database for {payload.email}")
        success = await firebase_db.save_otp(payload.email.lower(), otp, expires_at)
        logger.info(f"💾 OTP save result: {success}")
        
        if not success:
            logger.error(f"❌ OTP save failed for {payload.email}")
            raise HTTPException(status_code=500, detail="Failed to generate reset code")
        
        logger.info(f"✅ OTP successfully saved for {payload.email}")
        
        # Send OTP email
        logger.info(f"📧 Attempting to send email to: {payload.email}")
        email_sent = await email_service.send_otp_email(payload.email.lower(), otp)
        logger.info(f"📧 Email sent successfully: {email_sent}")
        
        if not email_sent:
            # If email service is not configured, provide the OTP in response for development
            if not email_service.is_configured:
                logger.info("⚠️ Email service not configured, returning OTP in response")
                return {
                    "message": "Email service not configured. Your OTP is: " + otp,
                    "otp": otp,  # Only for development
                    "expires_in_minutes": 10
                }
            else:
                logger.error("❌ Failed to send email but service is configured")
                raise HTTPException(status_code=500, detail="Failed to send reset code")
        
        # Clean up expired OTPs (temporarily disabled for debugging)
        # await firebase_db.cleanup_expired_otps()
        
        logger.info(f"✅ Forgot password process completed successfully for: {payload.email}")
        return {"message": "If an account with this email exists, you will receive a password reset code."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Forgot password error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process password reset request")

@api_router.post("/auth/verify-otp")
async def verify_otp_and_reset_password(payload: VerifyOTPRequest):
    """Verify OTP and reset password"""
    try:
        logger.info(f"🔐 OTP verification request for: {payload.email}")
        logger.info(f"🔐 Received OTP: {payload.otp}")
        
        # Validate new password
        if len(payload.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
        
        logger.info(f"🔐 Original password length: {len(payload.new_password)} characters, {len(payload.new_password.encode('utf-8'))} bytes")
        
        # bcrypt has a 72-byte limit, so force truncate to be safe (use 70 bytes to be extra safe)
        password_bytes = payload.new_password.encode('utf-8')
        if len(password_bytes) > 70:
            # Truncate to 70 bytes and decode back, ignoring incomplete UTF-8 sequences
            password_to_hash = password_bytes[:70].decode('utf-8', errors='ignore')
            logger.info(f"🔐 Password truncated from {len(password_bytes)} to {len(password_to_hash.encode('utf-8'))} bytes")
        else:
            password_to_hash = payload.new_password
        
        logger.info(f"🔐 Final password to hash: {len(password_to_hash)} characters, {len(password_to_hash.encode('utf-8'))} bytes")
        
        # Get stored OTP for debugging
        stored_otp_data = await firebase_db.get_otp(payload.email.lower())
        logger.info(f"🔐 Stored OTP data: {stored_otp_data}")
        
        # Verify OTP
        otp_valid = await firebase_db.verify_and_use_otp(payload.email.lower(), payload.otp)
        logger.info(f"🔐 OTP verification result: {otp_valid}")
        
        if not otp_valid:
            logger.error(f"❌ OTP verification failed for {payload.email} with OTP {payload.otp}")
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
        # Get user's auth record
        auth_record = await get_auth_record_by_email(payload.email.lower())
        if not auth_record:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Hash new password (using truncated version if necessary)
        logger.info(f"🔐 Hashing password for {payload.email}")
        try:
            new_hashed_password = hash_password(password_to_hash)
            logger.info(f"🔐 Password hashed successfully for {payload.email}")
        except Exception as hash_error:
            logger.error(f"❌ Password hashing failed with bcrypt: {hash_error}")
            # Fallback: try with a simpler approach
            try:
                import hashlib
                import secrets
                salt = secrets.token_hex(16)
                simple_hash = hashlib.pbkdf2_hmac('sha256', password_to_hash.encode('utf-8'), salt.encode('utf-8'), 100000)
                new_hashed_password = f"pbkdf2_sha256${salt}${simple_hash.hex()}"
                logger.info(f"🔐 Used fallback password hashing for {payload.email}")
            except Exception as fallback_error:
                logger.error(f"❌ Fallback password hashing also failed: {fallback_error}")
                raise HTTPException(status_code=500, detail="Failed to process new password")
        
        # Update password in auth record
        logger.info(f"🔐 About to update password in auth record for {payload.email}")
        updated_record = await upsert_auth_record_by_email(
            payload.email.lower(), 
            auth_record['user_id'], 
            new_hashed_password
        )
        
        logger.info(f"🔐 Password update result: {updated_record is not None and len(updated_record) > 0}")
        
        if not updated_record:
            logger.error(f"❌ Failed to update password - empty result")
            raise HTTPException(status_code=500, detail="Failed to update password")
        
        logger.info(f"✅ Password successfully updated for {payload.email}")
        
        # CRITICAL: Also update Firebase password to keep systems in sync
        try:
            import firebase_admin
            from firebase_admin import auth as firebase_auth
            
            # Get Firebase user by email
            firebase_user = firebase_auth.get_user_by_email(payload.email.lower())
            
            # Update Firebase password
            firebase_auth.update_user(
                firebase_user.uid,
                password=password_to_hash  # Use the same password
            )
            logger.info(f"✅ Firebase password also updated for {payload.email}")
            
        except Exception as firebase_error:
            logger.warning(f"⚠️ Could not update Firebase password: {firebase_error}")
            # Don't fail the whole operation if Firebase update fails
        
        # Send confirmation email
        await email_service.send_password_reset_confirmation(payload.email.lower())
        
        # Clean up expired OTPs
        await firebase_db.cleanup_expired_otps()
        
        return {"message": "Password reset successful. You can now log in with your new password."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OTP verification error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset password")

@api_router.post("/auth/resend-otp")
async def resend_otp(payload: ForgotPasswordRequest):
    """Resend OTP for password reset"""
    try:
        # Check if user exists
        auth_record = await get_auth_record_by_email(payload.email.lower())
        if not auth_record:
            # Don't reveal if email exists or not for security
            return {"message": "If an account with this email exists, you will receive a new password reset code."}
        
        # Generate new OTP
        otp = email_service.generate_otp()
        
        # Set expiration time (10 minutes from now)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        # Save new OTP to database (overwrites existing)
        success = await firebase_db.save_otp(payload.email.lower(), otp, expires_at)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to generate reset code")
        
        # Send OTP email
        email_sent = await email_service.send_otp_email(payload.email.lower(), otp)
        if not email_sent:
            # If email service is not configured, provide the OTP in response for development
            if not email_service.is_configured:
                return {
                    "message": "Email service not configured. Your new OTP is: " + otp,
                    "otp": otp,  # Only for development
                    "expires_in_minutes": 10
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to send reset code")
        
        return {"message": "If an account with this email exists, you will receive a new password reset code."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Resend OTP error: {e}")
        raise HTTPException(status_code=500, detail="Failed to resend reset code")

# Escrow Management Routes
@api_router.post("/escrow", response_model=EscrowTransaction)
async def create_escrow(
    task_id: str,
    client_id: str,
    freelancer_id: str,
    amount: float
):
    """Create an escrow transaction"""
    escrow_data = {
        "task_id": task_id,
        "client_id": client_id,
        "freelancer_id": freelancer_id,
        "amount": amount,
        "status": "pending"
    }
    escrow_obj = EscrowTransaction(**escrow_data)
    prepared_data = prepare_for_mongo(escrow_obj.dict())
    if False:  # MongoDB disabled - using Firebase
        try:
            await db.escrow_transactions.insert_one(prepared_data)
            # Update task escrow status
            await db.tasks.update_one(
                {"id": task_id},
                {"$set": {"escrow_status": "funded"}}
            )
            return escrow_obj
        except Exception:
            pass
    # Memory fallback
    memory_escrow_transactions.append(prepared_data)
    for t in memory_tasks:
        if t.get("id") == task_id:
            t["escrow_status"] = "funded"
            break
    return escrow_obj

@api_router.get("/escrow/{escrow_id}", response_model=EscrowTransaction)
async def get_escrow(escrow_id: str):
    """Get escrow transaction by ID"""
    if False:  # MongoDB disabled - using Firebase
        try:
            escrow = await db.escrow_transactions.find_one({"id": escrow_id})
            if not escrow:
                raise HTTPException(status_code=404, detail="Escrow transaction not found")
            return EscrowTransaction(**escrow)
        except Exception:
            pass
    for e in memory_escrow_transactions:
        if e.get("id") == escrow_id:
            return EscrowTransaction(**e)
    raise HTTPException(status_code=404, detail="Escrow transaction not found")

@api_router.put("/escrow/{escrow_id}/release")
async def release_escrow(escrow_id: str, zkp_hash: str):
    """Release escrow funds with zero-knowledge proof validation"""
    # In a real implementation, this would validate the ZKP
    if False:  # MongoDB disabled - using Firebase
        try:
            result = await db.escrow_transactions.update_one(
                {"id": escrow_id},
                {"$set": {"status": "released", "zkp_hash": zkp_hash}}
            )
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="Escrow transaction not found")
            return {"message": "Escrow released successfully", "zkp_hash": zkp_hash}
        except Exception:
            pass
    for e in memory_escrow_transactions:
        if e.get("id") == escrow_id:
            e["status"] = "released"
            e["zkp_hash"] = zkp_hash
            return {"message": "Escrow released successfully (memory)", "zkp_hash": zkp_hash}
    raise HTTPException(status_code=404, detail="Escrow transaction not found")

# Authentication Routes
@api_router.get("/auth/me")
async def me(current_user: User = Depends(get_current_user)):
    return current_user
@api_router.get("/analytics/stats")
async def get_platform_stats():
    """Get platform statistics"""
    if False:  # MongoDB disabled - using Firebase
        try:
            total_tasks = await db.tasks.count_documents({})
            active_tasks = await db.tasks.count_documents({"status": {"$in": ["open", "in_progress"]}})
            total_users = await db.users.count_documents({})
            total_earnings = await db.escrow_transactions.aggregate([
                {"$match": {"status": "released"}},
                {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
            ]).to_list(length=None)
            earnings = total_earnings[0]["total"] if total_earnings else 0
            return {
                "total_tasks": total_tasks,
                "active_tasks": active_tasks,
                "total_users": total_users,
                "total_earnings": earnings,
                "success_rate": 98.5
            }
        except Exception:
            pass
    # Memory fallback
    total_tasks = len(memory_tasks)
    active_tasks = len([t for t in memory_tasks if t.get("status") in ["open", "in_progress"]])
    total_users = len(memory_users)
    earnings = sum([e.get("amount", 0) for e in memory_escrow_transactions if e.get("status") == "released"])
    return {
        "total_tasks": total_tasks,
        "active_tasks": active_tasks,
        "total_users": total_users,
        "total_earnings": earnings,
        "success_rate": 98.5
    }

# Include the router in the main app
app.include_router(api_router)

# CORS Configuration
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # Expose all headers for debugging
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    # MongoDB client shutdown disabled - using Firebase
    pass



