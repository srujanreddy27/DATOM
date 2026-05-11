#!/bin/bash

echo "Starting Anvil node in the background..."
anvil --host 0.0.0.0 &

echo "Waiting for Anvil to initialize..."
sleep 3

echo "Deploying Escrow Contract to local Anvil node..."
export ESCROW_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export RPC_URL="http://127.0.0.1:8545"
export CHAIN_ID=31337

# Install solc explicitly to avoid runtime downloads
python -c "from solcx import install_solc; install_solc('0.8.0')"

# Deploy the contract
python scripts/deploy_escrow_contract.py

echo "Starting FastAPI Backend Server..."
cd backend
python -m uvicorn server:app --host 0.0.0.0 --port 8000
