"""
Blockchain integration for partial payment escrow system
"""

import os
import json
import logging
from typing import Dict, Optional, Tuple
from web3 import Web3
from eth_account import Account
import hashlib

logger = logging.getLogger(__name__)

class PartialPaymentEscrow:
    def __init__(self):
        # Blockchain Configuration
        self.rpc_url = os.environ.get("RPC_URL", "http://127.0.0.1:8545")
        self.chain_id = int(os.environ.get("CHAIN_ID", "31337"))
        self.private_key = os.environ.get("ESCROW_PRIVATE_KEY", "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80")
        
        # Initialize Web3
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.account = Account.from_key(self.private_key)
        
        # Load contract ABI and address
        self.contract_abi = self._load_contract_abi()
        self.contract_address = self._load_contract_address()
        
        if self.contract_address:
            self.contract = self.w3.eth.contract(
                address=self.contract_address,
                abi=self.contract_abi
            )
        else:
            self.contract = None
            logger.warning("Partial payment escrow contract not deployed yet")
    
    def _load_contract_abi(self) -> list:
        """Load contract ABI"""
        try:
            # In a real deployment, you'd load this from the compiled contract
            # For now, we'll define the essential functions
            return [
                {
                    "inputs": [
                        {"name": "taskId", "type": "bytes32"},
                        {"name": "budget", "type": "uint256"}
                    ],
                    "name": "createTask",
                    "outputs": [],
                    "stateMutability": "payable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {"name": "taskId", "type": "bytes32"},
                        {"name": "requestId", "type": "bytes32"},
                        {"name": "freelancer", "type": "address"},
                        {"name": "approvedFiles", "type": "uint256"},
                        {"name": "totalFiles", "type": "uint256"}
                    ],
                    "name": "requestPayment",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "requestId", "type": "bytes32"}],
                    "name": "releasePayment",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "taskId", "type": "bytes32"}],
                    "name": "completeTask",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "taskId", "type": "bytes32"}],
                    "name": "getTask",
                    "outputs": [
                        {"name": "client", "type": "address"},
                        {"name": "totalBudget", "type": "uint256"},
                        {"name": "remainingBudget", "type": "uint256"},
                        {"name": "isActive", "type": "bool"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "inputs": [{"name": "requestId", "type": "bytes32"}],
                    "name": "getPaymentRequest",
                    "outputs": [
                        {"name": "taskId", "type": "bytes32"},
                        {"name": "freelancer", "type": "address"},
                        {"name": "amount", "type": "uint256"},
                        {"name": "approvedFiles", "type": "uint256"},
                        {"name": "totalFiles", "type": "uint256"},
                        {"name": "isPaid", "type": "bool"},
                        {"name": "timestamp", "type": "uint256"}
                    ],
                    "stateMutability": "view",
                    "type": "function"
                }
            ]
        except Exception as e:
            logger.error(f"Failed to load contract ABI: {e}")
            return []
    
    def _load_contract_address(self) -> Optional[str]:
        """Load contract address from deployment file"""
        try:
            deployment_file = os.path.join(
                os.path.dirname(__file__), 
                "../deployment/partial_escrow_deployment.json"
            )
            if os.path.exists(deployment_file):
                with open(deployment_file, 'r') as f:
                    deployment_info = json.load(f)
                    return deployment_info.get("contractAddress")
        except Exception as e:
            logger.error(f"Failed to load contract address: {e}")
        return None
    
    def generate_task_id(self, task_id: str) -> bytes:
        """Generate bytes32 task ID from string"""
        return self.w3.keccak(text=task_id)
    
    def generate_request_id(self, submission_id: str, freelancer_address: str) -> bytes:
        """Generate unique request ID"""
        combined = f"{submission_id}_{freelancer_address}"
        return self.w3.keccak(text=combined)
    
    async def create_task_escrow(self, task_id: str, budget_eth: float, client_address: str) -> Dict:
        """Create a new task with escrow funding"""
        try:
            if not self.contract:
                raise Exception("Contract not available")
            
            task_id_bytes = self.generate_task_id(task_id)
            budget_wei = self.w3.to_wei(budget_eth, 'ether')
            
            # Build transaction
            transaction = self.contract.functions.createTask(
                task_id_bytes,
                budget_wei
            ).build_transaction({
                'from': client_address,
                'value': budget_wei,
                'gas': 300000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(client_address),
                'chainId': self.chain_id
            })
            
            return {
                "success": True,
                "transaction": transaction,
                "task_id_bytes": task_id_bytes.hex()
            }
            
        except Exception as e:
            logger.error(f"Failed to create task escrow: {e}")
            return {"success": False, "error": str(e)}
    
    async def request_partial_payment(
        self, 
        task_id: str, 
        submission_id: str,
        freelancer_address: str, 
        approved_files: int, 
        total_files: int,
        client_private_key: str
    ) -> Dict:
        """Request partial payment for approved work"""
        try:
            if not self.contract:
                raise Exception("Contract not available")
            
            task_id_bytes = self.generate_task_id(task_id)
            request_id_bytes = self.generate_request_id(submission_id, freelancer_address)
            
            # Build transaction
            client_account = Account.from_key(client_private_key)
            transaction = self.contract.functions.requestPayment(
                task_id_bytes,
                request_id_bytes,
                freelancer_address,
                approved_files,
                total_files
            ).build_transaction({
                'from': client_account.address,
                'gas': 200000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(client_account.address),
                'chainId': self.chain_id
            })
            
            # Sign and send transaction
            signed_txn = self.w3.eth.account.sign_transaction(transaction, client_private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            
            return {
                "success": True,
                "transaction_hash": receipt.transactionHash.hex(),
                "request_id": request_id_bytes.hex(),
                "gas_used": receipt.gasUsed
            }
            
        except Exception as e:
            logger.error(f"Failed to request partial payment: {e}")
            return {"success": False, "error": str(e)}
    
    async def release_payment(self, submission_id: str, freelancer_address: str) -> Dict:
        """Release payment to freelancer"""
        try:
            if not self.contract:
                raise Exception("Contract not available")
            
            request_id_bytes = self.generate_request_id(submission_id, freelancer_address)
            
            # Build transaction
            transaction = self.contract.functions.releasePayment(
                request_id_bytes
            ).build_transaction({
                'from': self.account.address,
                'gas': 150000,
                'gasPrice': self.w3.eth.gas_price,
                'nonce': self.w3.eth.get_transaction_count(self.account.address),
                'chainId': self.chain_id
            })
            
            # Sign and send transaction
            signed_txn = self.w3.eth.account.sign_transaction(transaction, self.private_key)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            
            return {
                "success": True,
                "transaction_hash": receipt.transactionHash.hex(),
                "gas_used": receipt.gasUsed
            }
            
        except Exception as e:
            logger.error(f"Failed to release payment: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_task_info(self, task_id: str) -> Dict:
        """Get task information from blockchain"""
        try:
            if not self.contract:
                raise Exception("Contract not available")
            
            task_id_bytes = self.generate_task_id(task_id)
            result = self.contract.functions.getTask(task_id_bytes).call()
            
            return {
                "success": True,
                "client": result[0],
                "total_budget": self.w3.from_wei(result[1], 'ether'),
                "remaining_budget": self.w3.from_wei(result[2], 'ether'),
                "is_active": result[3]
            }
            
        except Exception as e:
            logger.error(f"Failed to get task info: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_payment_request_info(self, submission_id: str, freelancer_address: str) -> Dict:
        """Get payment request information"""
        try:
            if not self.contract:
                raise Exception("Contract not available")
            
            request_id_bytes = self.generate_request_id(submission_id, freelancer_address)
            result = self.contract.functions.getPaymentRequest(request_id_bytes).call()
            
            return {
                "success": True,
                "task_id": result[0].hex(),
                "freelancer": result[1],
                "amount": self.w3.from_wei(result[2], 'ether'),
                "approved_files": result[3],
                "total_files": result[4],
                "is_paid": result[5],
                "timestamp": result[6]
            }
            
        except Exception as e:
            logger.error(f"Failed to get payment request info: {e}")
            return {"success": False, "error": str(e)}

# Global instance
partial_payment_escrow = PartialPaymentEscrow()
