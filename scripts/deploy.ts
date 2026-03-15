import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;
  const networkName = chainId === 11155111n ? "sepolia" : "localhost";

  console.log("═══════════════════════════════════════════");
  console.log("  CipherRoll — Confidential Payroll");
  console.log("═══════════════════════════════════════════");
  console.log("  Deployer :", deployer.address);
  console.log("  Network  :", networkName);
  console.log("  Balance  :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("───────────────────────────────────────────");

  // Deploy factory — it internally deploys ConfidentialPayToken
  console.log("\n▸ Deploying CipherRollFactory…");
  const Factory = await ethers.getContractFactory("CipherRollFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("  CipherRollFactory →", factoryAddress);

  // Read cUSD token address from factory
  const payTokenAddress = await factory.payToken();
  console.log("  ConfidentialPayToken (cUSD) →", payTokenAddress);

  // Save deployment manifest
  const deployment = {
    network: networkName,
    chainId: chainId.toString(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      CipherRollFactory: { address: factoryAddress },
      ConfidentialPayToken: { address: payTokenAddress },
    },
  };

  const dir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${networkName}.json`), JSON.stringify(deployment, null, 2));

  // Write frontend .env.local
  const envContent = [
    `NEXT_PUBLIC_FACTORY_ADDRESS=${factoryAddress}`,
    `NEXT_PUBLIC_PAY_TOKEN_ADDRESS=${payTokenAddress}`,
  ].join("\n") + "\n";
  fs.writeFileSync(path.join(__dirname, "../frontend/.env.local"), envContent);

  console.log("\n═══════════════════════════════════════════");
  console.log("  Deployment complete ✓");
  console.log("═══════════════════════════════════════════");
  console.log("  Factory  :", factoryAddress);
  console.log("  cUSD     :", payTokenAddress);
  console.log("  Saved to : deployments/", networkName + ".json");
  console.log("  .env.local updated for frontend");

  if (chainId === 11155111n) {
    console.log("\n  Verify:");
    console.log(`  npx hardhat verify --network sepolia ${factoryAddress}`);
    console.log(`  npx hardhat verify --network sepolia ${payTokenAddress}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
