# Partial Approval System API Documentation

## Overview
The partial approval system allows clients to approve individual files within a submission rather than approving the entire submission at once. Freelancers receive proportional payments based on the percentage of approved work.

## Key Features
- **File-level approval**: Approve or reject individual files
- **Proportional payments**: Payment calculated based on approved files ratio
- **Resubmission capability**: Freelancers can resubmit rejected files
- **Bulk operations**: Approve multiple files at once
- **Real-time statistics**: Track approval percentages and payment amounts

## Data Models

### FileSubmission
```json
{
  "id": "uuid",
  "file_path": "string",
  "file_name": "string", 
  "file_type": "string",
  "file_size": "integer",
  "status": "pending|approved|rejected",
  "feedback": "string|null",
  "approved_at": "datetime|null",
  "rejected_at": "datetime|null"
}
```

### Submission (Updated)
```json
{
  "id": "uuid",
  "task_id": "string",
  "freelancer_id": "string",
  "freelancer_name": "string",
  "description": "string",
  "files": [FileSubmission],
  "overall_status": "pending|partially_approved|fully_approved|rejected",
  "approved_files_count": "integer",
  "total_files_count": "integer", 
  "approval_percentage": "float",
  "created_at": "datetime",
  "last_updated_at": "datetime|null",
  "payment_claimable": "boolean",
  "payment_claimed": "boolean",
  "payment_claimed_at": "datetime|null",
  "payment_amount": "float",
  "can_resubmit": "boolean"
}
```

## API Endpoints

### 1. Approve Individual File
**PUT** `/api/submissions/{submission_id}/files/{file_id}/approve`

Approve a specific file within a submission.

**Parameters:**
- `submission_id`: UUID of the submission
- `file_id`: UUID of the file to approve
- `feedback`: Optional feedback text

**Response:**
```json
{
  "message": "File approved successfully",
  "file_id": "uuid",
  "submission_status": "partially_approved",
  "approved_files": 3,
  "total_files": 5,
  "approval_percentage": 60.0,
  "payment_amount": 60.0
}
```

### 2. Reject Individual File
**PUT** `/api/submissions/{submission_id}/files/{file_id}/reject`

Reject a specific file within a submission.

**Parameters:**
- `submission_id`: UUID of the submission
- `file_id`: UUID of the file to reject
- `feedback`: Optional feedback text

**Response:**
```json
{
  "message": "File rejected successfully",
  "file_id": "uuid",
  "submission_status": "partially_approved",
  "approved_files": 2,
  "total_files": 5,
  "approval_percentage": 40.0,
  "can_resubmit": true
}
```

### 3. Bulk Approve Files
**PUT** `/api/submissions/{submission_id}/bulk-approve`

Approve multiple files at once.

**Parameters:**
- `submission_id`: UUID of the submission
- `file_ids`: Array of file UUIDs to approve
- `feedback`: Optional feedback text

**Response:**
```json
{
  "message": "Approved 3 files successfully",
  "approved_files": 3,
  "submission_status": "partially_approved",
  "total_approved": 4,
  "total_files": 5,
  "approval_percentage": 80.0,
  "payment_amount": 80.0
}
```

### 4. Resubmit Rejected Files
**POST** `/api/submissions/{submission_id}/resubmit`

Resubmit new files to replace rejected ones.

**Parameters:**
- `submission_id`: UUID of the submission
- `files`: Array of new files to upload
- `replace_file_ids`: Array of file UUIDs to replace

**Response:**
```json
{
  "message": "Successfully resubmitted 2 files",
  "submission_id": "uuid",
  "resubmitted_files": 2,
  "submission_status": "pending"
}
```

### 5. Claim Proportional Payment
**POST** `/api/payments/claim`

Claim payment for approved work (updated to handle proportional payments).

**Parameters:**
- `submission_id`: UUID of the submission
- `wallet_address`: Ethereum wallet address

**Response:**
```json
{
  "message": "Payment transferred successfully to your wallet",
  "claim_id": "uuid",
  "amount": 60.0,
  "wallet_address": "0x...",
  "transaction_hash": "0x...",
  "block_number": 12345
}
```

## Payment Calculation

### Formula
```
payment_amount = (task_budget * approved_files) / total_files
```

### Example
- Task Budget: 100 ETH
- Total Files: 100 images
- Approved Files: 50 images
- Payment: (100 * 50) / 100 = 50 ETH

## Workflow Examples

### 1. Client Partial Approval Workflow
```
1. Client receives submission with 10 files
2. Client reviews each file individually
3. Client approves 7 files, rejects 3 files
4. System calculates: 70% approval = 70 ETH payment
5. Freelancer can claim 70 ETH immediately
6. Freelancer can resubmit the 3 rejected files
```

### 2. Multiple Freelancers Scenario
```
Task: 1000 ETH budget for 1000 images

Freelancer A: Submits 300 images, 250 approved
- Payment: (1000 * 250) / 1000 = 250 ETH

Freelancer B: Submits 400 images, 300 approved  
- Payment: (1000 * 300) / 1000 = 300 ETH

Freelancer C: Submits 300 images, 200 approved
- Payment: (1000 * 200) / 1000 = 200 ETH

Total paid: 750 ETH
Remaining budget: 250 ETH (returned to client)
```

## Status Definitions

### File Status
- **pending**: Awaiting client review
- **approved**: Accepted by client
- **rejected**: Rejected by client, can be resubmitted

### Submission Status
- **pending**: No files reviewed yet
- **partially_approved**: Some files approved, some pending/rejected
- **fully_approved**: All files approved
- **rejected**: All files rejected

## Error Handling

### Common Error Responses
```json
{
  "detail": "Only task owner can approve files",
  "status_code": 403
}
```

```json
{
  "detail": "File is already approved",
  "status_code": 400
}
```

```json
{
  "detail": "Can only resubmit rejected files",
  "status_code": 400
}
```

## Integration Notes

### Frontend Integration
1. Display file-level approval interface
2. Show real-time approval statistics
3. Enable bulk selection for approvals
4. Provide resubmission interface for freelancers

### Smart Contract Integration
- Uses `PartialPaymentEscrow.sol` contract
- Handles proportional payment calculations on-chain
- Supports multiple payments per task
- Automatic remaining fund return to client

### Security Considerations
- Only task owners can approve/reject files
- Only freelancers can resubmit their own files
- Payment claims validated against approved file count
- Blockchain transactions for payment security

## Testing

### Test Scenarios
1. Approve individual files and verify payment calculation
2. Reject files and test resubmission workflow
3. Bulk approve multiple files
4. Multiple freelancers with different approval rates
5. Edge cases: 0% approval, 100% approval
6. Resubmission of rejected files
7. Payment claiming with partial approvals

### Example Test Data
```json
{
  "task_budget": 100,
  "submissions": [
    {
      "freelancer": "freelancer1",
      "files": 10,
      "approved": 7,
      "expected_payment": 70
    },
    {
      "freelancer": "freelancer2", 
      "files": 5,
      "approved": 3,
      "expected_payment": 60
    }
  ]
}
```
