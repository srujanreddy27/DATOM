from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import jwt
from passlib.context import CryptContext
from fastapi.responses import JSONResponse
from firebase_auth import initialize_firebase, verify_firebase_token, get_user_from_firebase_token

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Initialize Firebase Admin SDK
initialize_firebase()

# MongoDB connection
USE_MEMORY_DB = os.environ.get('USE_MEMORY_DB', 'false').lower() == 'true'

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'decentratask')

client = AsyncIOMotorClient(mongo_url) if not USE_MEMORY_DB else None
db = client[db_name] if client else None

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# In-memory fallback stores (used if MongoDB is unavailable or USE_MEMORY_DB=true)
memory_tasks = []
memory_users = []
memory_applications = []
memory_escrow_transactions = []

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

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
    applicants: int = 0
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

class Application(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    task_id: str
    freelancer_id: str
    proposal: str
    bid_amount: float
    estimated_completion: str
    status: str = "pending"  # pending, accepted, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ApplicationCreate(BaseModel):
    task_id: str
    freelancer_id: str
    proposal: str
    bid_amount: float
    estimated_completion: str

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

# Minimal auth storage separate from public user profile
memory_auth_users = []  # {id, email, hashed_password, user_id}

# Frontend configuration
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")

# Blockchain Configuration
NETWORK_NAME = os.environ.get("NETWORK_NAME", "Datom Test Network")
RPC_URL = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
CHAIN_ID = int(os.environ.get("CHAIN_ID", "31337"))
CHAIN_ID_HEX = os.environ.get("CHAIN_ID_HEX", "0x7a69")
CURRENCY_SYMBOL = os.environ.get("CURRENCY_SYMBOL", "ETH")
ESCROW_ADDRESS = os.environ.get("ESCROW_ADDRESS", "0xA54130603Aed8B222f9BE8F22F4F8ED458505A27")

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
    if db is not None:
        try:
            rec = await db.auth_users.find_one({"email": email})
            if rec:
                return rec
        except Exception:
            pass
    for u in memory_auth_users:
        if u.get("email") == email:
            return u
    return None

async def save_auth_record(record: dict):
    prepared = prepare_for_mongo(record)
    if db is not None:
        try:
            await db.auth_users.insert_one(prepared)
            return
        except Exception:
            pass
    memory_auth_users.append(prepared)

async def upsert_auth_record_by_email(email: str, user_id: str, hashed_password: Optional[str] = None) -> dict:
    email_l = email.lower()
    # Try update in Mongo
    if db is not None:
        try:
            existing = await db.auth_users.find_one({"email": email_l})
            if existing:
                update = {"user_id": user_id}
                if hashed_password:
                    update["hashed_password"] = hashed_password
                await db.auth_users.update_one({"email": email_l}, {"$set": update})
                return {**existing, **update}
            rec = {"id": str(uuid.uuid4()), "email": email_l, "user_id": user_id, "hashed_password": hashed_password}
            await db.auth_users.insert_one(prepare_for_mongo(rec))
            return rec
        except Exception:
            pass
    # Memory fallback
    for u in memory_auth_users:
        if u.get("email") == email_l:
            u["user_id"] = user_id
            if hashed_password:
                u["hashed_password"] = hashed_password
            return u
    rec = {"id": str(uuid.uuid4()), "email": email_l, "user_id": user_id, "hashed_password": hashed_password}
    memory_auth_users.append(rec)
    return rec

async def get_user_by_id(user_id: str) -> Optional[User]:
    if db is not None:
        try:
            doc = await db.users.find_one({"id": user_id})
            if doc:
                return User(**doc)
        except Exception:
            pass
    for u in memory_users:
        if u.get("id") == user_id:
            return User(**u)
    return None

async def get_user_by_firebase_uid(firebase_uid: str) -> Optional[User]:
    """Get user by Firebase UID"""
    if db is not None:
        try:
            doc = await db.users.find_one({"firebase_uid": firebase_uid})
            if doc:
                return User(**doc)
        except Exception:
            pass
    for u in memory_users:
        if u.get("firebase_uid") == firebase_uid:
            return User(**u)
    return None

async def save_user(user: User):
    """Save user to database"""
    prepared_data = prepare_for_mongo(user.dict())
    if db is not None:
        try:
            await db.users.insert_one(prepared_data)
            return
        except Exception:
            pass
    memory_users.append(prepared_data)

async def get_current_user(authorization: Optional[str] = Header(default=None)) -> User:
    # Verify Firebase token
    decoded_token = await verify_firebase_token(authorization)
    firebase_user = get_user_from_firebase_token(decoded_token)
    
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

# Helper function to prepare data for MongoDB
def prepare_for_mongo(data):
    if isinstance(data, dict):
        prepared = {}
        for key, value in data.items():
            if isinstance(value, datetime):
                prepared[key] = value.isoformat()
            elif isinstance(value, dict):
                prepared[key] = prepare_for_mongo(value)
            elif isinstance(value, list):
                prepared[key] = [prepare_for_mongo(item) if isinstance(item, dict) else item for item in value]
            else:
                prepared[key] = value
        return prepared
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

async def cleanup_tasks():
    """Remove tasks that are completed or past their deadline."""
    # Mongo cleanup
    if db is not None:
        try:
            # Remove completed
            await db.tasks.delete_many({"status": "completed"})
            # Remove expired (deadline strictly before today)
            all_tasks = await db.tasks.find({}).to_list(length=None)
            for t in all_tasks:
                d = t.get("deadline")
                if isinstance(d, str) and is_past_deadline(d):
                    await db.tasks.delete_one({"id": t.get("id")})
        except Exception:
            pass
    # Memory cleanup
    global memory_tasks
    memory_tasks = [t for t in memory_tasks if t.get("status") != "completed" and not is_past_deadline(str(t.get("deadline")))]

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
    prepared_data = prepare_for_mongo(task_obj.dict())
    # Try MongoDB first; on failure use in-memory
    if db is not None:
        try:
            await db.tasks.insert_one(prepared_data)
            await cleanup_tasks()
            return task_obj
        except Exception:
            pass
    memory_tasks.append(prepared_data)
    await cleanup_tasks()
    return task_obj

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(
    category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get all tasks with optional filtering"""
    filter_query = {}
    if category and category != "all":
        filter_query["category"] = category
    if status:
        filter_query["status"] = status

    await cleanup_tasks()
    if db is not None:
        try:
            tasks = await db.tasks.find(filter_query).limit(limit).to_list(length=None)
            return [Task(**task) for task in tasks]
        except Exception:
            pass

    # Memory fallback
    filtered = [t for t in memory_tasks if all(
        [
            ("category" not in filter_query or t.get("category") == filter_query["category"]),
            ("status" not in filter_query or t.get("status") == filter_query["status"]),
        ]
    )]
    return [Task(**t) for t in filtered[:limit]]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get a specific task by ID"""
    await cleanup_tasks()
    if db is not None:
        try:
            task = await db.tasks.find_one({"id": task_id})
            if not task:
                raise HTTPException(status_code=404, detail="Task not found")
            return Task(**task)
        except Exception:
            pass
    for t in memory_tasks:
        if t.get("id") == task_id:
            return Task(**t)
    raise HTTPException(status_code=404, detail="Task not found")

@api_router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, status: str):
    """Update task status"""
    if db is not None:
        try:
            result = await db.tasks.update_one(
                {"id": task_id},
                {"$set": {"status": status}}
            )
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="Task not found")
            return {"message": "Task status updated successfully"}
        except Exception:
            pass
    for t in memory_tasks:
        if t.get("id") == task_id:
            t["status"] = status
            return {"message": "Task status updated successfully (memory)"}
    raise HTTPException(status_code=404, detail="Task not found")

# User Management Routes
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    """Create a new user"""
    user_dict = user.dict()
    user_obj = User(**user_dict)
    prepared_data = prepare_for_mongo(user_obj.dict())
    if db is not None:
        try:
            await db.users.insert_one(prepared_data)
            return user_obj
        except Exception:
            pass
    memory_users.append(prepared_data)
    return user_obj

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    """Get user by ID"""
    if db is not None:
        try:
            user = await db.users.find_one({"id": user_id})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            return User(**user)
        except Exception:
            pass
    for u in memory_users:
        if u.get("id") == user_id:
            return User(**u)
    raise HTTPException(status_code=404, detail="User not found")

@api_router.get("/users", response_model=List[User])
async def get_users(user_type: Optional[str] = None, limit: int = 50):
    """Get all users with optional filtering"""
    filter_query = {}
    if user_type:
        filter_query["user_type"] = user_type
    if db is not None:
        try:
            users = await db.users.find(filter_query).limit(limit).to_list(length=None)
            return [User(**user) for user in users]
        except Exception:
            pass
    filtered = [u for u in memory_users if ("user_type" not in filter_query or u.get("user_type") == filter_query["user_type"])]
    return [User(**u) for u in filtered[:limit]]

# Application Management Routes
@api_router.post("/applications", response_model=Application)
async def create_application(application: ApplicationCreate):
    """Create a new task application"""
    app_dict = application.dict()
    app_obj = Application(**app_dict)
    prepared_data = prepare_for_mongo(app_obj.dict())
    
    if db is not None:
        try:
            # Update task applicant count
            await db.tasks.update_one(
                {"id": application.task_id},
                {"$inc": {"applicants": 1}}
            )
            await db.applications.insert_one(prepared_data)
            return app_obj
        except Exception:
            pass

    # Memory fallback
    for t in memory_tasks:
        if t.get("id") == application.task_id:
            t["applicants"] = (t.get("applicants") or 0) + 1
            break
    memory_applications.append(prepared_data)
    return app_obj

@api_router.get("/applications/task/{task_id}", response_model=List[Application])
async def get_task_applications(task_id: str):
    """Get all applications for a specific task"""
    if db is not None:
        try:
            applications = await db.applications.find({"task_id": task_id}).to_list(length=None)
            return [Application(**app) for app in applications]
        except Exception:
            pass
    return [Application(**app) for app in memory_applications if app.get("task_id") == task_id]

@api_router.get("/applications/user/{user_id}", response_model=List[Application])
async def get_user_applications(user_id: str):
    """Get all applications by a specific user"""
    if db is not None:
        try:
            applications = await db.applications.find({"freelancer_id": user_id}).to_list(length=None)
            return [Application(**app) for app in applications]
        except Exception:
            pass
    return [Application(**app) for app in memory_applications if app.get("freelancer_id") == user_id]

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
    prepared_user = prepare_for_mongo(user_obj.dict())
    if db is not None:
        try:
            await db.users.insert_one(prepared_user)
        except Exception:
            pass
    else:
        memory_users.append(prepared_user)

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
    
    # Try Firebase token first
    try:
        decoded_token = await verify_firebase_token(authorization)
        firebase_user = get_user_from_firebase_token(decoded_token)
        
        # Get or create user in our database
        user = await get_user_by_firebase_uid(firebase_user["uid"])
        if not user:
            # Create new user from Firebase data
            user_obj = User(
                username=firebase_user["name"],
                email=firebase_user["email"],
                user_type="freelancer",  # default
                firebase_uid=firebase_user["uid"]
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
        raise HTTPException(status_code=400, detail="Invalid user type. Must be 'client' or 'freelancer'")
    
    # Update in database
    if db is not None:
        try:
            result = await db.users.update_one(
                {"id": current_user.id},
                {"$set": {"user_type": user_type}}
            )
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="User not found")
        except Exception:
            pass
    else:
        # Memory fallback
        for u in memory_users:
            if u.get("id") == current_user.id:
                u["user_type"] = user_type
                break
    
    return {"message": "User type updated successfully", "user_type": user_type}

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
        decoded_token = await verify_firebase_token(authorization)
        firebase_user = get_user_from_firebase_token(decoded_token)
        
        # Get or create user in our database
        user = await get_user_by_firebase_uid(firebase_user["uid"])
        if not user:
            # Create new user from Firebase data
            user_obj = User(
                username=firebase_user["name"],
                email=firebase_user["email"],
                user_type="freelancer",  # default
                firebase_uid=firebase_user["uid"]
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
        decoded_token = await verify_firebase_token(authorization)
        firebase_user = get_user_from_firebase_token(decoded_token)
        
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
            firebase_uid=firebase_user["uid"]
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
    if db is not None:
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
    if db is not None:
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
    if db is not None:
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
    if db is not None:
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
    client.close()