# 🚀 DATOM Project - Startup Guide

## Quick Start (3 Commands)

### Terminal 1: Blockchain (Anvil)
```bash
anvil
```

### Terminal 2: Backend API
```bash
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 3: Frontend
```bash
cd frontend
npm start
```

### Access Application
http://localhost:3000

---

## First-Time Setup

### 1. Install Dependencies

**Backend:**
```bash
cd backend
pip install -r requirements.txt
cd ..
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

**Python Blockchain Tools:**
```bash
pip install web3 eth-account py-solc-x
```

---

## Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api |
| API Docs | http://localhost:8000/docs |
| Blockchain (Anvil) | http://127.0.0.1:8545 |

---

## Features & Fixes Applied

### ✅ User Type Selection Fixed
- Login now respects profile choice (Client/Freelancer)
- Default is "client" but changeable during onboarding

### ✅ File Size Validation - Now User-Friendly!
Use MB/KB units in validation codes:
```
file_size > 1MB      (instead of file_size > 1048576)
file_size > 100KB    (instead of file_size > 102400)
```

### ✅ Auto-Approval Protection
- Clients cannot reject files auto-approved via validation code
- Ensures integrity of automated validation

### ✅ Task Deadline & Closure
- Tasks auto-close when deadline passes
- Tasks auto-close when requirements met
- Button shows specific reason: "Deadline Passed", "Requirements Met", etc.

### ✅ Client Refund on Task Completion
- Remaining escrow funds automatically refund to client
- Endpoint: `POST /api/tasks/{task_id}/complete`

### ✅ Smart Contract Integration
- Solidity contract: `contracts/PartialPaymentEscrow.sol`
- Deploy script: `scripts/deploy_escrow_contract.py`
- Partial payment based on approved work

---

## Troubleshooting

### Port Already in Use
```bash
# Find process
netstat -ano | findstr :8545

# Kill process
taskkill /PID <PID> /F
```

### Module Not Found
```bash
# Backend
cd backend && pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### Anvil Not Found
Install Foundry (includes Anvil):
https://book.getfoundry.sh/getting-started/installation

---

## Documentation

- **File Validation**: `FILE_SIZE_VALIDATION_EXPLAINED.md`
- **All Fixes**: `FIXES_SUMMARY.md`
- **Smart Contract**: `contracts/PartialPaymentEscrow.sol`

---

**Happy Coding! 🎉**
