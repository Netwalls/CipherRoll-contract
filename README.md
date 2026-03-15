# CipherRoll — Confidential Payroll on Ethereum

> A fully on-chain confidential payroll system built with [Zama fhEVM](https://docs.zama.ai/fhevm).
> Every salary and payment amount is encrypted end-to-end using Fully Homomorphic Encryption.
> Built for the **Zama Developer Program — Special Bounty Track**.

---

## The Problem

Public blockchains make enterprise payroll impossible. When a company pays employees on-chain:
- **Every salary is visible** to competitors, coworkers, and anyone with a block explorer
- **Compensation gaps** between employees are exposed automatically
- **Company financial data** leaks — permanently, immutably

## The Solution: CipherRoll

CipherRoll uses **Zama's fhEVM** to keep all salary data encrypted at every step — on-chain, in transfers, and in storage.

| Who | What they can see |
|-----|------------------|
| Blockchain / public | Transaction happened ✓ — amount: 🔒 encrypted |
| Employer | Can set salaries, run payroll |
| Employee | **Only their own salary** (client-side reencryption via Zama KMS) |
| Everyone else | Nothing — FHE ciphertexts only |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CipherRoll dApp                         │
│                                                              │
│  ┌─────────────┐    encrypt (fhevmjs)   ┌─────────────────┐ │
│  │  Employer   │ ──────────────────────▶│ConfidentialPayr-│ │
│  │   (owner)   │                        │  oll.sol        │ │
│  └─────────────┘  executePayroll()      │                 │ │
│                ──────────────────────▶  │  euint64 salary │ │
│                                         │  FHE transfers  │ │
│  ┌─────────────┐   reencrypt + decrypt  │                 │ │
│  │  Employee   │ ◀──────────────────────│                 │ │
│  │  (wallet)   │   Zama KMS → browser   └─────────────────┘ │
│  └─────────────┘                                │            │
│                                                 ▼            │
│                                  ┌──────────────────────┐   │
│                                  │ConfidentialPayToken  │   │
│                                  │  (ERC-7984 / cUSD)   │   │
│                                  │  encrypted balances  │   │
│                                  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Smart Contracts

| Contract | Description |
|----------|-------------|
| `CipherRollFactory` | Deploys per-employer payroll contracts; registers minters |
| `ConfidentialPayroll` | Core payroll — stores FHE-encrypted salaries, invite codes, executes payroll |
| `ConfidentialPayToken` | ERC-7984 cUSD token with fully encrypted balances and transfers |

### Frontend

- **Next.js 14** + TypeScript
- **wagmi v2** + **viem** for contract interactions
- **RainbowKit** for wallet connection
- **fhevmjs v0.6** for client-side FHE encryption and decryption

---

## Live Deployment (Sepolia)

| Contract | Address |
|----------|---------|
| CipherRollFactory | `0xF8fC0B620487D19154Dc1b45b59Dc6C8AC67e664` |
| ConfidentialPayToken (cUSD) | `0x912db637B3caE5392a58a8E928e75ac80f6385F2` |

---

## How It Works

### 1. Employer deploys their payroll contract

```
Employer calls createOrganization("Acme Corp")
  → Factory deploys ConfidentialPayroll with employer as owner
  → Factory registers the new contract as a cUSD minter
  → Employer dashboard unlocks
```

### 2. Employee onboarding via invite codes

```
Employer generates invite: createInvite(keccak256(code), name, dept)
  → Employer shares plaintext code (e.g. CR-ABCD-EFGH) off-chain
Employee claims: claimInvite(bytes32Code)
  → Wallet registered as Pending employee
  → Employer sets salary → status becomes Active
```

### 3. Salary encryption

```
Employer enters $5,000
  → fhevmjs.createEncryptedInput(payrollAddress, employerAddress)
  → input.add64(5_000_000n)  // 6 decimal places
  → input.encrypt() → { handle, inputProof }
  → tx: setSalary(employeeAddr, handle, inputProof)
  → Contract stores euint64 ciphertext
  → ACL: contract ✓, employer ✓, employee ✓
```

### 4. Payroll execution

```
Employer funds: fundPayroll(amount) → mints cUSD to payroll contract
Employer runs:  executePayroll()
  → Iterates all Active + salarySet employees
  → paymentToken.transfer(emp, encryptedSalary)
  → All amounts stay encrypted on-chain
  → Observers see: transfer happened — amount: 🔒
```

### 5. Employee decrypts their salary

```
Employee clicks "Decrypt My Salary"
  → fhevmjs generates ephemeral keypair
  → Employee signs EIP-712 message (proves wallet ownership)
  → Zama KMS reencrypts ciphertext under employee's public key
  → Browser decrypts locally: $5,000.00
  → Nothing leaves the browser in plaintext
```

---

## Privacy Guarantees

- **FHE storage**: Salaries stored as `euint64` ciphertexts — computationally infeasible to break
- **ACL-controlled access**: Each ciphertext has an explicit on-chain access control list
- **Zero-knowledge transfers**: ERC-7984 token transfers reveal no amount
- **Local decryption**: Reencryption — the plaintext salary never reaches any server

---

## Setup

### Prerequisites

- Node.js 18+
- MetaMask connected to Sepolia ([faucet](https://sepoliafaucet.com))

### Smart contracts

```bash
npm install
npm run compile
```

### Deploy to Sepolia

```bash
cp .env.example .env
# Fill: PRIVATE_KEY, SEPOLIA_RPC_URL

npm run deploy:sepolia
# Outputs factory + token addresses
```

### Frontend

```bash
cd frontend
npm install

# Create frontend/.env.local:
# NEXT_PUBLIC_FACTORY_ADDRESS=0x...
# NEXT_PUBLIC_PAY_TOKEN_ADDRESS=0x...
# NEXT_PUBLIC_GATEWAY_URL=https://gateway.sepolia.zama.ai

npm run dev
# → http://localhost:3000
```

---

## Key FHE Code

```solidity
// Store encrypted salary
euint64 salary = TFHE.asEuint64(encryptedSalary, inputProof);
TFHE.allowThis(salary);      // contract can use it in transfers
TFHE.allow(salary, owner()); // employer can see it
TFHE.allow(salary, emp);     // employee can see their own

// Confidential payroll transfer
paymentToken.transfer(employee, emp.encryptedSalary);
// Internally: encrypted sub from contract balance, encrypted add to employee balance
```

```typescript
// Client-side encryption (fhevmjs v0.6)
const input = instance.createEncryptedInput(payrollAddr, employerAddr);
input.add64(BigInt(salary * 1_000_000));
const { handles, inputProof } = await input.encrypt();

// Client-side decryption (reencryption via Zama KMS)
const { publicKey, privateKey } = instance.generateKeypair();
const sig = await wallet.signTypedData(instance.createEIP712(publicKey, payrollAddr));
const clearValue = await instance.reencrypt(handle, privateKey, publicKey, sig, payrollAddr, userAddr);
```

---

## Built With

- [Zama fhEVM](https://github.com/zama-ai/fhevm) — Fully Homomorphic Encryption for EVM
- [fhevm-contracts](https://github.com/zama-ai/fhevm-contracts) — ConfidentialERC20 (ERC-7984)
- [fhevmjs](https://github.com/zama-ai/fhevmjs) — Client-side FHE encryption & KMS reencryption
- [OpenZeppelin](https://github.com/OpenZeppelin/openzeppelin-contracts) — Ownable, ReentrancyGuard
- [Hardhat](https://hardhat.org/) — Smart contract toolchain
- [Next.js](https://nextjs.org/) + [wagmi](https://wagmi.sh/) + [RainbowKit](https://www.rainbowkit.com/) — Frontend

---

*CipherRoll — Because payroll privacy shouldn't require trust.*
