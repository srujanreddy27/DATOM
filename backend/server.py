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
import logging
from web3 import Web3
from eth_account import Account
import json

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
class TaskCreate(BaseModel):
    title: str
    description: str
    category: str
    budget: float
    deadline: str  # ISO date string YYYY-MM-DD
    client: str
    skills: List[str] = []

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

class Submission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    freelancer_id: str
    freelancer_name: str
    description: str
    files: List[str] = []  # File paths on server
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None
    payment_claimable: bool = False  # True when freelancer can claim payment
    payment_claimed: bool = False  # True when payment has been claimed
    payment_claimed_at: Optional[datetime] = None

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

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(password, hashed)
    except Exception:
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
    
    # Validate and save uploaded files
    saved_files = []
    for file in files:
        if file.filename:  # Skip empty files
            file_path = await save_uploaded_file(file, task_id, current_user.id)
            saved_files.append(file_path)
    
    if not saved_files:
        raise HTTPException(status_code=400, detail="No valid files uploaded")
    
    # Create submission with current user as freelancer
    sub_obj = Submission(
        task_id=task_id,
        freelancer_id=current_user.id,
        freelancer_name=current_user.username,
        description=description.strip(),
        files=saved_files
    )
    
    # Save submission to Firebase
    success = await firebase_db.save_submission(sub_obj.dict())
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save submission")
    
    # Update task submission count
    current_submissions = task_data.get("submissions", 0)
    await firebase_db.update_task(task_id, {"submissions": current_submissions + 1})
    
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
        except Exception as e:
            logger.warning(f"Could not verify file access for {filename}: {e}")
            raise HTTPException(status_code=403, detail="Access denied")
        
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
    
    # Check if submission is approved and payment is claimable
    if sub_data.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Submission must be approved to claim payment")
    
    if not sub_data.get("payment_claimable", False):
        raise HTTPException(status_code=400, detail="Payment is not yet claimable")
    
    if sub_data.get("payment_claimed", False):
        raise HTTPException(status_code=400, detail="Payment has already been claimed")
    
    # Validate wallet address format (basic validation)
    if not wallet_address.startswith("0x") or len(wallet_address) != 42:
        raise HTTPException(status_code=400, detail="Invalid wallet address format")
    
    # Get task data for payment amount
    task_data = await firebase_db.get_task_by_id(sub_data["task_id"])
    if not task_data:
        raise HTTPException(status_code=404, detail="Task not found")
    
    payment_amount = task_data.get("budget", 0)
    
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
    # Prevent duplicate emails
    existing = await get_auth_record_by_email(payload.email.lower())
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create profile user
    username = payload.username or (payload.email.split("@")[0])
    user_type = payload.user_type or "freelancer"
    user_obj = User(
        username=username,
        email=payload.email.lower(),
        user_type=user_type,
    )
    
    # Save user to Firebase
    await firebase_db.save_user(user_obj.dict())

    # Save auth record
    auth_record = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "hashed_password": hash_password(payload.password),
        "user_id": user_obj.id,
        "created_at": datetime.now(timezone.utc),
    }
    await save_auth_record(auth_record)

    token = create_access_token({"sub": user_obj.id, "email": user_obj.email})
    return TokenResponse(access_token=token, user=user_obj)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest):
    rec = await get_auth_record_by_email(payload.email.lower())
    if not rec or not verify_password(payload.password, rec.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = await get_user_by_id(rec["user_id"])  # type: ignore[index]
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    token = create_access_token({"sub": user.id, "email": user.email})
    return TokenResponse(access_token=token, user=user)

@api_router.get("/auth/me", response_model=User)
async def me(authorization: Optional[str] = Header(default=None)):
    """Get current user info - supports both Firebase and JWT tokens"""
    if not authorization or not authorization.lower().startswith("bearer "):
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
        except Exception:
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

@api_router.post("/auth/firebase/verify")
async def verify_firebase_auth(authorization: Optional[str] = Header(default=None)):
    """Verify Firebase token and return user info"""
    try:
        # Verify Firebase token
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

        
        return {
            "user": user,
            "firebase_user": firebase_user
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

class FirebaseSignupRequest(BaseModel):
    username: str
    user_type: str

@api_router.post("/auth/firebase/signup")
async def firebase_signup(payload: FirebaseSignupRequest, authorization: Optional[str] = Header(default=None)):
    """Create a new user account with Firebase authentication"""
    try:
        # Verify Firebase token
        firebase_user = await verify_firebase_token_hybrid(authorization)
        
        # Check if user already exists
        existing_user = await get_user_by_firebase_uid(firebase_user["uid"])
        if existing_user:
            return {
                "user": existing_user,
                "firebase_user": firebase_user,
                "message": "User already exists"
            }
        
        # Create new user
        user_obj = User(
            username=payload.username,
            email=firebase_user["email"],
            user_type=payload.user_type,
            firebase_uid=firebase_user["uid"],
        )
        await save_user(user_obj)
        
        return {
            "user": user_obj,
            "firebase_user": firebase_user,
            "message": "User created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

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
    allow_credentials=True,
    allow_origins=CORS_ORIGINS + ["*"],  # Add wildcard for development
    allow_methods=["*"],
    allow_headers=["*"],
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



