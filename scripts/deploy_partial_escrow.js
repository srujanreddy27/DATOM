const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying PartialPaymentEscrow contract...");

    // Get the contract factory
    const PartialPaymentEscrow = await ethers.getContractFactory("PartialPaymentEscrow");

    // Deploy the contract
    const escrow = await PartialPaymentEscrow.deploy();
    await escrow.deployed();

    console.log("PartialPaymentEscrow deployed to:", escrow.address);
    console.log("Transaction hash:", escrow.deployTransaction.hash);

    // Verify deployment
    const owner = await escrow.owner();
    console.log("Contract owner:", owner);
    console.log("Contract balance:", ethers.utils.formatEther(await ethers.provider.getBalance(escrow.address)), "ETH");

    // Save deployment info
    const deploymentInfo = {
        contractAddress: escrow.address,
        deploymentHash: escrow.deployTransaction.hash,
        owner: owner,
        deployedAt: new Date().toISOString(),
        network: process.env.HARDHAT_NETWORK || "localhost"
    };

    console.log("\nDeployment Info:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    // Save to file for backend integration
    const fs = require('fs');
    const path = require('path');
    
    const deploymentPath = path.join(__dirname, '../deployment/partial_escrow_deployment.json');
    
    // Create deployment directory if it doesn't exist
    const deploymentDir = path.dirname(deploymentPath);
    if (!fs.existsSync(deploymentDir)) {
        fs.mkdirSync(deploymentDir, { recursive: true });
    }
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\nDeployment info saved to: ${deploymentPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
