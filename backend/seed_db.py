import asyncio
import uuid
import random
from datetime import datetime, timedelta, timezone

from firebase_db import get_firestore_client, USERS_COLLECTION, TASKS_COLLECTION, BIDS_COLLECTION, MESSAGES_COLLECTION, TEAMS_COLLECTION

db = get_firestore_client()
if not db:
    print("Cannot seed without a valid Firestore connection.")
    exit(1)

print("Starting to seed database with realistic mocking data...")

# -----------------
# 1. CREATE USERS
# -----------------
clients = [
    {
        "id": f"client_{uuid.uuid4()}",
        "firebase_uid": f"uid_c_{random.randint(1000, 9999)}",
        "username": "Alex Carter",
        "email": "alex.carter@startup.io",
        "user_type": "client",
        "wallet_address": "0x1234567890abcdef1234567890abcdef12345678"
    },
    {
        "id": f"client_{uuid.uuid4()}",
        "firebase_uid": f"uid_c_{random.randint(1000, 9999)}",
        "username": "Sarah Miller",
        "email": "sarah.miller@creativeagency.com",
        "user_type": "client",
        "wallet_address": "0xabcdef1234567890abcdef1234567890abcdef12"
    }
]

freelancers = [
    {
        "id": f"freelancer_{uuid.uuid4()}",
        "firebase_uid": f"uid_f_{random.randint(1000, 9999)}",
        "username": "DevGuru",
        "email": "devguru@freelance.net",
        "user_type": "freelancer",
        "skills": ["React", "Node.js", "Python"],
        "wallet_address": "0x1111222233334444555566667777888899990000"
    },
    {
        "id": f"freelancer_{uuid.uuid4()}",
        "firebase_uid": f"uid_f_{random.randint(1000, 9999)}",
        "username": "PixelPerfect",
        "email": "designer@pixelperfect.studio",
        "user_type": "freelancer",
        "skills": ["UI/UX", "Figma", "Illustrator"],
        "wallet_address": "0x0000999988887777666655554444333322221111"
    },
    {
        "id": f"freelancer_{uuid.uuid4()}",
        "firebase_uid": f"uid_f_{random.randint(1000, 9999)}",
        "username": "CryptoNinja",
        "email": "ninja@web3.dev",
        "user_type": "freelancer",
        "skills": ["Solidity", "Web3.js", "Smart Contracts"],
        "wallet_address": "0xabababababababababababababababababababab"
    }
]

all_users = clients + freelancers
for user in all_users:
    db.collection(USERS_COLLECTION).document(user["id"]).set(user)
print(f"✅ Created {len(all_users)} mock users.")


# -----------------
# 2. CREATE TASKS
# -----------------
now = datetime.now(timezone.utc)
tasks = [
    {
        "id": f"task_{uuid.uuid4()}",
        "title": "Build a React Dashboard",
        "description": "I need a scalable React dashboard for our internal analytics app. Needs charts, data tables, and dark mode support.",
        "category": "Development",
        "budget": 1500.0,
        "deadline": (now + timedelta(days=14)).strftime("%Y-%m-%d"),
        "client": clients[0]["username"],
        "client_id": clients[0]["id"],
        "skills": ["React", "Node.js", "Tailwind CSS"],
        "status": "open",
        "created_at": now.isoformat(),
        "client_rating": 4.8,
        "expected_files_count": 3
    },
    {
        "id": f"task_{uuid.uuid4()}",
        "title": "Mobile App UI/UX Design",
        "description": "Looking for a talented designer to create 15 screens for a new fintech mobile application. Need high fidelity prototypes in Figma.",
        "category": "Design",
        "budget": 800.0,
        "deadline": (now + timedelta(days=7)).strftime("%Y-%m-%d"),
        "client": clients[1]["username"],
        "client_id": clients[1]["id"],
        "skills": ["Figma", "UI/UX", "Mobile Design"],
        "status": "open",
        "created_at": (now - timedelta(days=2)).isoformat(),
        "client_rating": 5.0,
        "expected_files_count": 15
    },
    {
        "id": f"task_{uuid.uuid4()}",
        "title": "Smart Contract Audit & Optimization",
        "description": "We have an ERC20 and a staking contract that needs a professional audit and gas optimization before mainnet deployment.",
        "category": "Blockchain",
        "budget": 2500.0,
        "deadline": (now + timedelta(days=10)).strftime("%Y-%m-%d"),
        "client": clients[0]["username"],
        "client_id": clients[0]["id"],
        "skills": ["Solidity", "Smart Contracts", "Security"],
        "status": "open",
        "created_at": (now - timedelta(days=1)).isoformat(),
        "client_rating": 4.8,
        "expected_files_count": 1
    }
]

for task in tasks:
    db.collection(TASKS_COLLECTION).document(task["id"]).set(task)
print(f"✅ Created {len(tasks)} realistic tasks.")


# -----------------
# 3. CREATE BIDS
# -----------------
bids = [
    {
        "id": f"bid_{uuid.uuid4()}",
        "task_id": tasks[0]["id"],
        "freelancer_id": freelancers[0]["id"],
        "freelancer_name": freelancers[0]["username"],
        "amount": 1400.0,
        "timeline_days": 10,
        "proposal": "I have built dozens of React dashboards. I can use Recharts for the analytics and Tailwind for the dark mode. Setup will be blazing fast.",
        "status": "pending",
        "created_at": (now - timedelta(hours=5)).isoformat()
    },
    {
        "id": f"bid_{uuid.uuid4()}",
        "task_id": tasks[1]["id"],
        "freelancer_id": freelancers[1]["id"],
        "freelancer_name": freelancers[1]["username"],
        "amount": 850.0,
        "timeline_days": 6,
        "proposal": "I specialize in clean, minimal fintech designs. Check out my portfolio. I will deliver 15 highly interactive Figma screens.",
        "status": "pending",
        "created_at": (now - timedelta(hours=24)).isoformat()
    },
    {
         "id": f"bid_{uuid.uuid4()}",
        "task_id": tasks[2]["id"],
        "freelancer_id": freelancers[2]["id"],
        "freelancer_name": freelancers[2]["username"],
        "amount": 2800.0,
        "timeline_days": 14,
        "proposal": "Senior auditor here. I found vulnerabilities in multiple high-profile projects. Optimization is my middle name.",
        "status": "pending",
        "created_at": (now - timedelta(minutes=45)).isoformat()
    }
]

for bid in bids:
    db.collection(BIDS_COLLECTION).document(bid["id"]).set(bid)
print(f"✅ Placed {len(bids)} realistic bids.")


# -----------------
# 4. CREATE TEAMS
# -----------------
team_id = f"team_{uuid.uuid4()}"
team = {
    "id": team_id,
    "name": "Web3 Pioneers",
    "leader_id": freelancers[0]["id"],
    "leader_name": freelancers[0]["username"],
    "required_skills": ["Solidity", "UI/UX", "Marketing"],
    "members": [
        freelancers[0]["id"],
        freelancers[2]["id"]
    ],
    "created_at": (now - timedelta(days=5)).isoformat()
}
db.collection(TEAMS_COLLECTION).document(team_id).set(team)
print("✅ Created 1 freelance team.")


# -----------------
# 5. CREATE MESSAGES (Negotiation Chat)
# -----------------
messages = [
    {
        "id": f"msg_{uuid.uuid4()}",
        "task_id": tasks[0]["id"],
        "sender_id": clients[0]["id"],
        "sender_name": clients[0]["username"],
        "recipient_id": freelancers[0]["id"],
        "recipient_name": freelancers[0]["username"],
        "text": f"Hi {freelancers[0]['username']}, I liked your proposal for the dashboard. Are you sure you can finish it in 10 days?",
        "created_at": (now - timedelta(hours=4)).isoformat()
    },
    {
        "id": f"msg_{uuid.uuid4()}",
        "task_id": tasks[0]["id"],
        "sender_id": freelancers[0]["id"],
        "sender_name": freelancers[0]["username"],
        "recipient_id": clients[0]["id"],
        "recipient_name": clients[0]["username"],
        "text": f"Hey {clients[0]['username']}! Yes, absolutely. I already have a few boilerplate components ready that match your exact description.",
        "created_at": (now - timedelta(hours=3, minutes=45)).isoformat()
    },
    {
        "id": f"msg_{uuid.uuid4()}",
        "task_id": tasks[0]["id"],
        "sender_id": clients[0]["id"],
        "sender_name": clients[0]["username"],
        "recipient_id": freelancers[0]["id"],
        "recipient_name": freelancers[0]["username"],
        "text": "Sounds great. I'll accept the bid and fund the escrow now.",
        "created_at": (now - timedelta(hours=1)).isoformat()
    }
]

for msg in messages:
    db.collection(MESSAGES_COLLECTION).document(msg["id"]).set(msg)
print(f"✅ Generated {len(messages)} chat messages.")

print("\n🎉 Database Seeding Complete! Fire up the frontend to view the data.")
