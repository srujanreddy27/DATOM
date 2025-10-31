// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title PartialPaymentEscrow
 * @dev Smart contract for handling partial payments based on approved work
 */
contract PartialPaymentEscrow {
    address public owner;
    
    struct Task {
        address client;
        uint256 totalBudget;
        uint256 remainingBudget;
        bool isActive;
        mapping(address => uint256) freelancerPayments;
        mapping(address => bool) hasBeenPaid;
    }
    
    struct PaymentRequest {
        bytes32 taskId;
        address freelancer;
        uint256 amount;
        uint256 approvedFiles;
        uint256 totalFiles;
        bool isPaid;
        uint256 timestamp;
    }
    
    mapping(bytes32 => Task) public tasks;
    mapping(bytes32 => PaymentRequest) public paymentRequests;
    
    event TaskCreated(bytes32 indexed taskId, address indexed client, uint256 budget);
    event TaskFunded(bytes32 indexed taskId, uint256 amount);
    event PaymentRequested(bytes32 indexed requestId, bytes32 indexed taskId, address indexed freelancer, uint256 amount);
    event PaymentReleased(bytes32 indexed requestId, address indexed freelancer, uint256 amount);
    event TaskCompleted(bytes32 indexed taskId);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyClient(bytes32 taskId) {
        require(msg.sender == tasks[taskId].client, "Only task client can call this function");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Create a new task with escrow
     */
    function createTask(bytes32 taskId, uint256 budget) external payable {
        require(tasks[taskId].client == address(0), "Task already exists");
        require(msg.value == budget, "Must send exact budget amount");
        require(budget > 0, "Budget must be greater than 0");
        
        Task storage newTask = tasks[taskId];
        newTask.client = msg.sender;
        newTask.totalBudget = budget;
        newTask.remainingBudget = budget;
        newTask.isActive = true;
        
        emit TaskCreated(taskId, msg.sender, budget);
        emit TaskFunded(taskId, msg.value);
    }
    
    /**
     * @dev Request partial payment for approved work
     */
    function requestPayment(
        bytes32 taskId,
        bytes32 requestId,
        address freelancer,
        uint256 approvedFiles,
        uint256 totalFiles
    ) external onlyClient(taskId) {
        require(tasks[taskId].isActive, "Task is not active");
        require(approvedFiles > 0, "Must have approved files");
        require(totalFiles > 0, "Total files must be greater than 0");
        require(approvedFiles <= totalFiles, "Approved files cannot exceed total files");
        require(paymentRequests[requestId].freelancer == address(0), "Payment request already exists");
        require(!tasks[taskId].hasBeenPaid[freelancer], "Freelancer already paid for this task");
        
        // Calculate proportional payment
        uint256 paymentAmount = (tasks[taskId].totalBudget * approvedFiles) / totalFiles;
        require(paymentAmount <= tasks[taskId].remainingBudget, "Insufficient remaining budget");
        
        // Create payment request
        PaymentRequest storage request = paymentRequests[requestId];
        request.taskId = taskId;
        request.freelancer = freelancer;
        request.amount = paymentAmount;
        request.approvedFiles = approvedFiles;
        request.totalFiles = totalFiles;
        request.isPaid = false;
        request.timestamp = block.timestamp;
        
        emit PaymentRequested(requestId, taskId, freelancer, paymentAmount);
    }
    
    /**
     * @dev Release payment to freelancer
     */
    function releasePayment(bytes32 requestId) external {
        PaymentRequest storage request = paymentRequests[requestId];
        require(request.freelancer != address(0), "Payment request does not exist");
        require(!request.isPaid, "Payment already released");
        require(msg.sender == tasks[request.taskId].client || msg.sender == owner, "Unauthorized");
        
        Task storage task = tasks[request.taskId];
        require(task.isActive, "Task is not active");
        require(request.amount <= task.remainingBudget, "Insufficient remaining budget");
        
        // Update task state
        task.remainingBudget -= request.amount;
        task.freelancerPayments[request.freelancer] += request.amount;
        task.hasBeenPaid[request.freelancer] = true;
        
        // Mark payment as completed
        request.isPaid = true;
        
        // Transfer payment
        payable(request.freelancer).transfer(request.amount);
        
        emit PaymentReleased(requestId, request.freelancer, request.amount);
    }
    
    /**
     * @dev Complete task and return remaining funds to client
     */
    function completeTask(bytes32 taskId) external onlyClient(taskId) {
        Task storage task = tasks[taskId];
        require(task.isActive, "Task is not active");
        
        // Return remaining budget to client
        if (task.remainingBudget > 0) {
            uint256 refundAmount = task.remainingBudget;
            task.remainingBudget = 0;
            payable(task.client).transfer(refundAmount);
        }
        
        task.isActive = false;
        emit TaskCompleted(taskId);
    }
    
    /**
     * @dev Emergency withdrawal (only owner)
     */
    function emergencyWithdraw(bytes32 taskId) external onlyOwner {
        Task storage task = tasks[taskId];
        require(task.remainingBudget > 0, "No funds to withdraw");
        
        uint256 amount = task.remainingBudget;
        task.remainingBudget = 0;
        task.isActive = false;
        
        payable(owner).transfer(amount);
    }
    
    /**
     * @dev Get task details
     */
    function getTask(bytes32 taskId) external view returns (
        address client,
        uint256 totalBudget,
        uint256 remainingBudget,
        bool isActive
    ) {
        Task storage task = tasks[taskId];
        return (task.client, task.totalBudget, task.remainingBudget, task.isActive);
    }
    
    /**
     * @dev Get payment request details
     */
    function getPaymentRequest(bytes32 requestId) external view returns (
        bytes32 taskId,
        address freelancer,
        uint256 amount,
        uint256 approvedFiles,
        uint256 totalFiles,
        bool isPaid,
        uint256 timestamp
    ) {
        PaymentRequest storage request = paymentRequests[requestId];
        return (
            request.taskId,
            request.freelancer,
            request.amount,
            request.approvedFiles,
            request.totalFiles,
            request.isPaid,
            request.timestamp
        );
    }
    
    /**
     * @dev Get freelancer payment amount for a task
     */
    function getFreelancerPayment(bytes32 taskId, address freelancer) external view returns (uint256) {
        return tasks[taskId].freelancerPayments[freelancer];
    }
    
    /**
     * @dev Check if freelancer has been paid for a task
     */
    function hasFreelancerBeenPaid(bytes32 taskId, address freelancer) external view returns (bool) {
        return tasks[taskId].hasBeenPaid[freelancer];
    }
    
    /**
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
