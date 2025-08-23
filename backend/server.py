from fastapi import FastAPI, APIRouter, HTTPException
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
    deadline: str
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

# Routes
@api_router.get("/")
async def root():
    return {"message": "DecentraTask API - Decentralized Task Outsourcing Platform"}

# Task Management Routes
@api_router.post("/tasks", response_model=Task)
async def create_task(task: TaskCreate):
    """Create a new task"""
    task_dict = task.dict()
    task_obj = Task(**task_dict)
    prepared_data = prepare_for_mongo(task_obj.dict())
    await db.tasks.insert_one(prepared_data)
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
    
    tasks = await db.tasks.find(filter_query).limit(limit).to_list(length=None)
    return [Task(**task) for task in tasks]

@api_router.get("/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get a specific task by ID"""
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Task(**task)

@api_router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, status: str):
    """Update task status"""
    result = await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task status updated successfully"}

# User Management Routes
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    """Create a new user"""
    user_dict = user.dict()
    user_obj = User(**user_dict)
    prepared_data = prepare_for_mongo(user_obj.dict())
    await db.users.insert_one(prepared_data)
    return user_obj

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    """Get user by ID"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

@api_router.get("/users", response_model=List[User])
async def get_users(user_type: Optional[str] = None, limit: int = 50):
    """Get all users with optional filtering"""
    filter_query = {}
    if user_type:
        filter_query["user_type"] = user_type
    
    users = await db.users.find(filter_query).limit(limit).to_list(length=None)
    return [User(**user) for user in users]

# Application Management Routes
@api_router.post("/applications", response_model=Application)
async def create_application(application: ApplicationCreate):
    """Create a new task application"""
    app_dict = application.dict()
    app_obj = Application(**app_dict)
    prepared_data = prepare_for_mongo(app_obj.dict())
    
    # Update task applicant count
    await db.tasks.update_one(
        {"id": application.task_id},
        {"$inc": {"applicants": 1}}
    )
    
    await db.applications.insert_one(prepared_data)
    return app_obj

@api_router.get("/applications/task/{task_id}", response_model=List[Application])
async def get_task_applications(task_id: str):
    """Get all applications for a specific task"""
    applications = await db.applications.find({"task_id": task_id}).to_list(length=None)
    return [Application(**app) for app in applications]

@api_router.get("/applications/user/{user_id}", response_model=List[Application])
async def get_user_applications(user_id: str):
    """Get all applications by a specific user"""
    applications = await db.applications.find({"freelancer_id": user_id}).to_list(length=None)
    return [Application(**app) for app in applications]

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
    await db.escrow_transactions.insert_one(prepared_data)
    
    # Update task escrow status
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"escrow_status": "funded"}}
    )
    
    return escrow_obj

@api_router.get("/escrow/{escrow_id}", response_model=EscrowTransaction)
async def get_escrow(escrow_id: str):
    """Get escrow transaction by ID"""
    escrow = await db.escrow_transactions.find_one({"id": escrow_id})
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow transaction not found")
    return EscrowTransaction(**escrow)

@api_router.put("/escrow/{escrow_id}/release")
async def release_escrow(escrow_id: str, zkp_hash: str):
    """Release escrow funds with zero-knowledge proof validation"""
    # In a real implementation, this would validate the ZKP
    result = await db.escrow_transactions.update_one(
        {"id": escrow_id},
        {"$set": {"status": "released", "zkp_hash": zkp_hash}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Escrow transaction not found")
    
    return {"message": "Escrow released successfully", "zkp_hash": zkp_hash}

# Analytics Routes
@api_router.get("/analytics/stats")
async def get_platform_stats():
    """Get platform statistics"""
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
        "success_rate": 98.5  # Mock success rate
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