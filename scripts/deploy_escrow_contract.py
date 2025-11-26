"""
Smart Contract Deployment Script for Partial Payment Escrow
"""
import os
import json
from pathlib import Path
from web3 import Web3
from eth_account import Account
from solcx import compile_standard, install_solc

# Install Solidity compiler
install_solc('0.8.0')

# Configuration
RPC_URL = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
CHAIN_ID = int(os.environ.get("CHAIN_ID", "31337"))
DEPLOYER_PRIVATE_KEY = os.environ.get("ESCROW_PRIVATE_KEY")

if not DEPLOYER_PRIVATE_KEY:
    raise ValueError("ESCROW_PRIVATE_KEY must be set in environment variables")

# Connect to blockchain
w3 = Web3(Web3.HTTPProvider(RPC_URL))
deployer_account = Account.from_key(DEPLOYER_PRIVATE_KEY)

print(f"Deploying from account: {deployer_account.address}")
print(f"Account balance: {w3.from_wei(w3.eth.get_balance(deployer_account.address), 'ether')} ETH")

# Read contract source
contract_path = Path(__file__).parent.parent / "contracts" / "PartialPaymentEscrow.sol"
with open(contract_path, 'r') as file:
    contract_source = file.read()

# Compile contract
print("Compiling contract...")
compiled_sol = compile_standard({
    "language": "Solidity",
    "sources": {
        "PartialPaymentEscrow.sol": {
            "content": contract_source
        }
    },
    "settings": {
        "outputSelection": {
            "*": {
                "*": ["abi", "metadata", "evm.bytecode", "evm.sourceMap"]
            }
        }
    }
}, solc_version="0.8.0")

# Get bytecode and ABI
contract_data = compiled_sol["contracts"]["PartialPaymentEscrow.sol"]["PartialPaymentEscrow"]
bytecode = contract_data["evm"]["bytecode"]["object"]
abi = contract_data["abi"]

print("Contract compiled successfully!")

# Deploy contract
print("Deploying contract...")
Contract = w3.eth.contract(abi=abi, bytecode=bytecode)

# Build deployment transaction
deploy_txn = Contract.constructor().build_transaction({
    'from': deployer_account.address,
    'nonce': w3.eth.get_transaction_count(deployer_account.address),
    'gas': 3000000,
    'gasPrice': w3.eth.gas_price,
    'chainId': CHAIN_ID
})

# Sign and send transaction
signed_txn = w3.eth.account.sign_transaction(deploy_txn, DEPLOYER_PRIVATE_KEY)
tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)

print(f"Transaction hash: {tx_hash.hex()}")
print("Waiting for transaction receipt...")

# Wait for deployment
tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
contract_address = tx_receipt.contractAddress

print(f"✅ Contract deployed successfully!")
print(f"Contract address: {contract_address}")
print(f"Gas used: {tx_receipt.gasUsed}")
print(f"Block number: {tx_receipt.blockNumber}")

# Save deployment info
deployment_dir = Path(__file__).parent.parent / "deployment"
deployment_dir.mkdir(exist_ok=True)

deployment_info = {
    "contractAddress": contract_address,
    "transactionHash": tx_receipt.transactionHash.hex(),
    "blockNumber": tx_receipt.blockNumber,
    "gasUsed": tx_receipt.gasUsed,
    "deployer": deployer_account.address,
    "chainId": CHAIN_ID,
    "rpcUrl": RPC_URL,
    "abi": abi
}

deployment_file = deployment_dir / "partial_escrow_deployment.json"
with open(deployment_file, 'w') as f:
    json.dump(deployment_info, f, indent=2)

print(f"\n📝 Deployment info saved to: {deployment_file}")

# Save full ABI separately
abi_file = deployment_dir / "PartialPaymentEscrow.abi.json"
with open(abi_file, 'w') as f:
    json.dump(abi, f, indent=2)

print(f"📝 ABI saved to: {abi_file}")

print("\n" + "="*80)
print("DEPLOYMENT COMPLETE")
print("="*80)
print(f"Contract Address: {contract_address}")
print(f"Network: {RPC_URL}")
print(f"Chain ID: {CHAIN_ID}")
print("="*80)
print("\n⚠️  IMPORTANT: Update your .env file with:")
print(f"PARTIAL_ESCROW_CONTRACT_ADDRESS={contract_address}")
print("="*80)
