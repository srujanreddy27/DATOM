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
from requests_oauthlib import OAuth2Session
from fastapi.responses import RedirectResponse, JSONResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
USE_MEMORY_DB = os.environ.get('USE_MEMORY_DB', 'false').lower() == 'true'

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'decentratask')

client = AsyncIOMotorClient(mongo_url) if not USE_MEMORY_DB else None
db = client[db_name] if client else None

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

# Google OAuth config
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
OAUTH_REDIRECT_URI = os.environ.get("OAUTH_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
GOOGLE_AUTHORIZATION_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

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

async def get_current_user(authorization: Optional[str] = Header(default=None)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
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
async def me(current_user: User = Depends(get_current_user)):
    return current_user

# ---------------- Google OAuth ----------------
def build_google_session(state: Optional[str] = None):
    scope = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ]
    return OAuth2Session(
        GOOGLE_CLIENT_ID,
        scope=scope,
        redirect_uri=OAUTH_REDIRECT_URI,
        state=state,
    )

@api_router.get("/auth/google/login")
async def google_login(redirect: Optional[str] = None):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    oauth = build_google_session()
    authorization_url, state = oauth.authorization_url(
        GOOGLE_AUTHORIZATION_BASE_URL,
        access_type="offline",
        prompt="select_account",
        include_granted_scopes="true",
    )
    # Store state and next redirect in a signed-less memory cookie via query (simple demo)
    # In production, use server-side session/state store.
    target = redirect or FRONTEND_ORIGIN
    response = RedirectResponse(url=authorization_url)
    response.set_cookie(key="oauth_state", value=state, httponly=True, secure=False, samesite="lax")
    response.set_cookie(key="post_login_redirect", value=target, httponly=True, secure=False, samesite="lax")
    return response

@api_router.get("/auth/google/callback")
async def google_callback(request: Request):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
    state_cookie = request.cookies.get("oauth_state")
    oauth = build_google_session(state=state_cookie)
    try:
        token = oauth.fetch_token(
            GOOGLE_TOKEN_URL,
            client_secret=GOOGLE_CLIENT_SECRET,
            authorization_response=str(request.url),
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to exchange token")

    # Get user info
    try:
        resp = oauth.get(GOOGLE_USERINFO_URL)
        info = resp.json()
        email = info.get("email")
        name = info.get("name") or (email.split("@")[0] if email else "user")
        picture = info.get("picture")
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    if not email:
        raise HTTPException(status_code=400, detail="Email not available from Google")

    # Ensure User profile
    user_doc = None
    if db is not None:
        try:
            existing = await db.users.find_one({"email": email.lower()})
            if existing:
                user_doc = User(**existing)
            else:
                user_obj = User(username=name, email=email.lower(), user_type="freelancer")
                await db.users.insert_one(prepare_for_mongo(user_obj.dict()))
                user_doc = user_obj
        except Exception:
            pass
    if user_doc is None:
        # Memory fallback
        for u in memory_users:
            if u.get("email") == email.lower():
                user_doc = User(**u)
                break
        if user_doc is None:
            user_obj = User(username=name, email=email.lower(), user_type="freelancer")
            memory_users.append(prepare_for_mongo(user_obj.dict()))
            user_doc = user_obj

    # Upsert auth record
    await upsert_auth_record_by_email(email, user_doc.id)

    # Issue JWT and redirect back
    token_jwt = create_access_token({"sub": user_doc.id, "email": user_doc.email})
    post_redirect = request.cookies.get("post_login_redirect") or FRONTEND_ORIGIN
    # Append token as query param
    sep = "&" if ("?" in post_redirect) else "?"
    return RedirectResponse(url=f"{post_redirect}{sep}token={token_jwt}")

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

# Analytics Routes
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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