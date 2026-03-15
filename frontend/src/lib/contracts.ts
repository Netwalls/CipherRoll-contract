// ─────────────────────────────────────────────────────────────────────────────
//  CipherRoll contract addresses & ABIs
// ─────────────────────────────────────────────────────────────────────────────

export const FACTORY_ADDRESS = (
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? (() => { throw new Error("NEXT_PUBLIC_FACTORY_ADDRESS not set"); })()
) as `0x${string}`;

export const PAY_TOKEN_ADDRESS = (
  process.env.NEXT_PUBLIC_PAY_TOKEN_ADDRESS ?? (() => { throw new Error("NEXT_PUBLIC_PAY_TOKEN_ADDRESS not set"); })()
) as `0x${string}`;

// ─────────────────────────────────────────────
//  Factory ABI
// ─────────────────────────────────────────────
export const FACTORY_ABI = [
  { name: "payToken",            type: "function", stateMutability: "view",       inputs: [],                                     outputs: [{ type: "address" }] },
  { name: "employerToContract",  type: "function", stateMutability: "view",       inputs: [{ name: "employer", type: "address" }], outputs: [{ type: "address" }] },
  { name: "inviteCodeToContract",type: "function", stateMutability: "view",       inputs: [{ name: "codeHash", type: "bytes32" }], outputs: [{ type: "address" }] },
  { name: "getPayrollForEmployer",type:"function", stateMutability: "view",       inputs: [{ name: "employer", type: "address" }], outputs: [{ type: "address" }] },
  { name: "getPayrollForInvite", type: "function", stateMutability: "view",       inputs: [{ name: "codeHash", type: "bytes32" }], outputs: [{ type: "address" }] },
  { name: "totalOrganizations",  type: "function", stateMutability: "view",       inputs: [],                                     outputs: [{ type: "uint256" }] },
  { name: "isPayrollContract",   type: "function", stateMutability: "view",       inputs: [{ name: "addr", type: "address" }],     outputs: [{ type: "bool" }] },
  { name: "createOrganization",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "name", type: "string" }],     outputs: [{ type: "address" }] },
  { name: "OrganizationCreated", type: "event",    inputs: [{ name: "employer", type: "address", indexed: true }, { name: "payroll", type: "address", indexed: true }, { name: "name", type: "string" }] },
] as const;

// ─────────────────────────────────────────────
//  Payroll ABI (per-employer contract)
// ─────────────────────────────────────────────
export const PAYROLL_ABI = [
  // Read
  { name: "owner",               type: "function", stateMutability: "view", inputs: [],                                     outputs: [{ type: "address" }] },
  { name: "companyName",         type: "function", stateMutability: "view", inputs: [],                                     outputs: [{ type: "string" }] },
  { name: "currentCycle",        type: "function", stateMutability: "view", inputs: [],                                     outputs: [{ type: "uint256" }] },
  { name: "totalEmployees",      type: "function", stateMutability: "view", inputs: [],                                     outputs: [{ type: "uint256" }] },
  { name: "activeEmployeeCount", type: "function", stateMutability: "view", inputs: [],                                     outputs: [{ type: "uint256" }] },
  { name: "isRegistered",        type: "function", stateMutability: "view", inputs: [{ name: "addr",     type: "address" }], outputs: [{ type: "bool" }] },
  { name: "getEmployeeStatus",   type: "function", stateMutability: "view", inputs: [{ name: "addr",     type: "address" }], outputs: [{ type: "uint8" }] },
  { name: "getEmployeeList",     type: "function", stateMutability: "view", inputs: [],                                     outputs: [{ type: "address[]" }] },
  { name: "lastPaidCycle",       type: "function", stateMutability: "view", inputs: [{ name: "",         type: "address" }], outputs: [{ type: "uint256" }] },
  {
    name: "getEmployeeInfo", type: "function", stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [
      { name: "status",        type: "uint8" },
      { name: "salarySet",     type: "bool" },
      { name: "claimedAt",     type: "uint256" },
      { name: "lastPaidAt",    type: "uint256" },
      { name: "totalPayments", type: "uint256" },
      { name: "empName",       type: "string" },
      { name: "department",    type: "string" },
    ],
  },
  { name: "getSalaryHandle",        type: "function", stateMutability: "view", inputs: [{ name: "addr", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getMySalaryHandle",      type: "function", stateMutability: "view", inputs: [],                                  outputs: [{ type: "uint256" }] },
  { name: "getPayrollBalanceHandle",type: "function", stateMutability: "view", inputs: [],                                  outputs: [{ type: "uint256" }] },
  { name: "getInviteList",          type: "function", stateMutability: "view", inputs: [],                                  outputs: [{ type: "bytes32[]" }] },
  {
    name: "getInvite", type: "function", stateMutability: "view",
    inputs: [{ name: "codeHash", type: "bytes32" }],
    outputs: [{ name: "exists", type: "bool" }, { name: "claimedBy", type: "address" }, { name: "invName", type: "string" }, { name: "department", type: "string" }, { name: "createdAt", type: "uint256" }],
  },
  // Write
  { name: "setCompanyName",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "_name",          type: "string" }],  outputs: [] },
  { name: "createInvite",        type: "function", stateMutability: "nonpayable", inputs: [{ name: "codeHash",       type: "bytes32" }, { name: "name", type: "string" }, { name: "department", type: "string" }], outputs: [] },
  { name: "claimInvite",         type: "function", stateMutability: "nonpayable", inputs: [{ name: "code",           type: "bytes32" }],  outputs: [] },
  { name: "setSalary",           type: "function", stateMutability: "nonpayable", inputs: [{ name: "employeeAddress",type: "address" }, { name: "encryptedSalary", type: "bytes32" }, { name: "inputProof", type: "bytes" }], outputs: [] },
  { name: "deactivateEmployee",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "addr",           type: "address" }],  outputs: [] },
  { name: "reactivateEmployee",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "addr",           type: "address" }],  outputs: [] },
  { name: "executePayroll",      type: "function", stateMutability: "nonpayable", inputs: [],                                              outputs: [] },
  { name: "payEmployee",         type: "function", stateMutability: "nonpayable", inputs: [{ name: "addr",           type: "address" }],  outputs: [] },
  { name: "fundPayroll",         type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount",         type: "uint64" }],   outputs: [] },
  // Events
  { name: "InviteCreated",  type: "event", inputs: [{ name: "codeHash", type: "bytes32", indexed: true }, { name: "name", type: "string" }, { name: "dept", type: "string" }, { name: "ts", type: "uint256" }] },
  { name: "InviteClaimed",  type: "event", inputs: [{ name: "codeHash", type: "bytes32", indexed: true }, { name: "employee", type: "address", indexed: true }, { name: "ts", type: "uint256" }] },
  { name: "SalarySet",      type: "event", inputs: [{ name: "employee", type: "address", indexed: true }, { name: "ts", type: "uint256" }] },
  { name: "PayrollExecuted",type: "event", inputs: [{ name: "cycle", type: "uint256", indexed: true }, { name: "ts", type: "uint256" }, { name: "count", type: "uint256" }] },
  { name: "PaymentMade",    type: "event", inputs: [{ name: "employee", type: "address", indexed: true }, { name: "cycle", type: "uint256", indexed: true }, { name: "ts", type: "uint256" }] },
] as const;

export const PAY_TOKEN_ABI = [
  { name: "symbol",             type: "function", stateMutability: "view", inputs: [],                                     outputs: [{ type: "string" }] },
  { name: "encryptedBalanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

// ─────────────────────────────────────────────
//  fhEVM Sepolia config (from on-chain deploy)
// ─────────────────────────────────────────────
export const FHEVM_CONFIG = {
  kmsContractAddress:  "0x9D6891A6240D6130c54ae243d8005063D05fE14b" as `0x${string}`,
  aclContractAddress:  "0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5" as `0x${string}`,
  chainId: 11155111,
  gatewayUrl: process.env.NEXT_PUBLIC_GATEWAY_URL || "https://gateway.sepolia.zama.ai",
};

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
export const EmpStatus = { None: 0, Pending: 1, Active: 2, Inactive: 3 } as const;

export function formatCUSD(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const cents = (raw % 1_000_000n) / 10_000n;
  return `$${whole.toLocaleString("en-US")}.${String(cents).padStart(2, "0")}`;
}

/** Encode a string invite code to bytes32 (right-padded) */
export function encodeInviteCode(code: string): `0x${string}` {
  const bytes = new TextEncoder().encode(code);
  const padded = new Uint8Array(32);
  padded.set(bytes.slice(0, 32));
  return ("0x" + Array.from(padded).map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

/** keccak256 of the bytes32-encoded invite code */
export async function hashInviteCode(code: string): Promise<`0x${string}`> {
  const { keccak256 } = await import("viem");
  return keccak256(encodeInviteCode(code));
}

/** Generate a human-readable 12-char invite code: CR-XXXX-XXXX */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `CR-${seg(4)}-${seg(4)}`;
}

/** Persist / retrieve the employee's resolved payroll contract per wallet */
export function saveEmployeePayroll(wallet: string, payroll: string) {
  if (typeof window !== "undefined")
    localStorage.setItem(`cr:payroll:${wallet.toLowerCase()}`, payroll);
}

export function loadEmployeePayroll(wallet: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`cr:payroll:${wallet.toLowerCase()}`);
}
