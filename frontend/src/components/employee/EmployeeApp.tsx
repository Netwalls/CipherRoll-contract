"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LogoWordmark } from "@/components/shared/Logo";
import {
  FACTORY_ADDRESS, FACTORY_ABI,
  PAY_TOKEN_ADDRESS, PAY_TOKEN_ABI,
  PAYROLL_ABI,
  EmpStatus, formatCUSD, encodeInviteCode, hashInviteCode,
  saveEmployeePayroll, loadEmployeePayroll,
} from "@/lib/contracts";
import { useFhevm } from "@/hooks/useFhevm";
import { Spinner, StatusBox } from "@/components/shared/Spinner";

// ─────────────────────────────────────────────
//  Root — check localStorage → verified → dashboard or claim
// ─────────────────────────────────────────────
export function EmployeeApp({ onBack }: { onBack: () => void }) {
  const { address } = useAccount();
  const [payrollAddr, setPayrollAddr] = useState<`0x${string}` | null>(null);
  const [cleared, setCleared] = useState(false);

  if (!address) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <p style={{ color: "#666", fontSize: 14 }}>Connect your wallet to continue.</p>
      <ConnectButton showBalance={false} chainStatus="none" />
    </div>
  );

  const stored = !cleared ? loadEmployeePayroll(address) : null;
  const activePayroll = payrollAddr || (stored as `0x${string}` | null);

  const clearAndReset = () => {
    if (typeof window !== "undefined") localStorage.removeItem(`cr:payroll:${address.toLowerCase()}`);
    setPayrollAddr(null);
    setCleared(true);
  };

  if (activePayroll) {
    return <EmployeeDashboard onBack={onBack} address={address} payrollAddr={activePayroll} onClear={clearAndReset} />;
  }

  return (
    <ClaimInvite
      onBack={onBack}
      address={address}
      onClaimed={(addr) => {
        saveEmployeePayroll(address, addr);
        setPayrollAddr(addr);
      }}
    />
  );
}

// ─────────────────────────────────────────────
//  Claim invite — single step
// ─────────────────────────────────────────────
function ClaimInvite({
  onBack, address, onClaimed,
}: {
  onBack: () => void;
  address: `0x${string}`;
  onClaimed: (payroll: `0x${string}`) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<`0x${string}` | null>(null);

  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const ZERO = "0x0000000000000000000000000000000000000000";

  if (done) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card" style={{ maxWidth: 380, width: "100%", textAlign: "center", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(74,222,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 13l5 5 11-11" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>You&apos;re registered</div>
            <div style={{ color: "#666", fontSize: 14, lineHeight: 1.6 }}>Your wallet is linked. Your employer will set your encrypted salary soon.</div>
          </div>
          <button className="btn-gold" style={{ width: "100%", padding: "13px 0" }} onClick={() => onClaimed(done)}>
            Open dashboard →
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !publicClient || busy) return;
    setError(null);
    setBusy(true);

    try {
      setStatusMsg("Looking up code…");
      const codeHash = await hashInviteCode(trimmed);
      const payroll = await publicClient.readContract({
        address: FACTORY_ADDRESS, abi: FACTORY_ABI,
        functionName: "getPayrollForInvite", args: [codeHash],
      }) as `0x${string}`;

      if (!payroll || payroll === ZERO) {
        setError("Code not found. Check it with your employer.");
        return;
      }

      setStatusMsg("Checking registration…");
      const alreadyIn = await publicClient.readContract({
        address: payroll, abi: PAYROLL_ABI,
        functionName: "isRegistered", args: [address],
      }) as boolean;

      if (alreadyIn) {
        setDone(payroll);
        return;
      }

      const invite = await publicClient.readContract({
        address: payroll, abi: PAYROLL_ABI,
        functionName: "getInvite", args: [codeHash],
      }) as unknown as [boolean, `0x${string}`, string, string, bigint];
      const [invExists, claimedBy] = invite;

      if (!invExists) {
        setError("Invite code not found in the payroll contract.");
        return;
      }
      if (claimedBy !== "0x0000000000000000000000000000000000000000") {
        if (claimedBy.toLowerCase() === address.toLowerCase()) {
          setDone(payroll);
        } else {
          setError("This invite code was already claimed by another wallet. Ask your employer for a new code.");
        }
        return;
      }

      setStatusMsg("Confirm in MetaMask…");
      const encoded = encodeInviteCode(trimmed);
      const hash = await writeContractAsync({
        address: payroll, abi: PAYROLL_ABI,
        functionName: "claimInvite", args: [encoded],
        gas: 500_000n,
      });
      setTxHash(hash);

      setStatusMsg("Waiting for confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({
        hash, confirmations: 1, timeout: 120_000,
      });

      if (receipt.status !== "success") {
        setError("Transaction failed on-chain. Check Etherscan for details.");
        return;
      }

      setDone(payroll);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("InvalidCode"))             setError("Invalid invite code.");
      else if (msg.includes("CodeAlreadyClaimed")) setError("This code has already been claimed.");
      else if (msg.includes("AlreadyRegistered"))  setError("This wallet is already registered.");
      else if (msg.includes("User rejected") || msg.includes("rejected")) setError("Transaction rejected.");
      else setError(msg.slice(0, 160));
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 50, background: "rgba(12,12,12,0.9)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="btn-ghost" onClick={onBack} style={{ padding: "4px 8px" }}>←</button>
            <LogoWordmark size={26} />
          </div>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
        </div>
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>Enter your invite code</h2>
            <p style={{ color: "#666", fontSize: 14 }}>Your employer generated a <code style={{ fontFamily: "monospace", color: "#E9B84A" }}>CR-XXXX-XXXX</code> code for you.</p>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              className="field"
              style={{ fontFamily: "monospace", fontSize: 16, textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center" }}
              placeholder="CR-XXXX-XXXX"
              value={code}
              onChange={e => { setCode(e.target.value); setError(null); }}
              onKeyDown={e => e.key === "Enter" && !busy && submit()}
              maxLength={16}
              disabled={busy}
              autoFocus
            />

            {error && <StatusBox type="err">{error}</StatusBox>}

            {busy && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#888" }}>
                <Spinner size={13} />
                <span>{statusMsg}</span>
              </div>
            )}

            {txHash && busy && (
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#E9B84A", fontFamily: "monospace", opacity: 0.7, textAlign: "center" }}>
                {txHash.slice(0, 14)}… — track on Etherscan ↗
              </a>
            )}

            <button className="btn-gold" style={{ width: "100%" }} onClick={submit} disabled={!code.trim() || busy}>
              {busy ? <><Spinner size={12} /> {statusMsg || "Working…"}</> : "Claim invite code"}
            </button>
          </div>

          <p style={{ color: "#444", fontSize: 12, textAlign: "center" }}>
            Connected as <span style={{ fontFamily: "monospace" }}>{address.slice(0, 8)}…{address.slice(-4)}</span>
          </p>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Employee Dashboard — single scrollable page, no tabs
// ─────────────────────────────────────────────
function EmployeeDashboard({
  onBack, address, payrollAddr, onClear,
}: {
  onBack: () => void;
  address: `0x${string}`;
  payrollAddr: `0x${string}`;
  onClear: () => void;
}) {
  const { data: companyName } = useReadContract({ address: payrollAddr, abi: PAYROLL_ABI, functionName: "companyName" });
  const { data: info } = useReadContract({ address: payrollAddr, abi: PAYROLL_ABI, functionName: "getEmployeeInfo", args: [address], account: address });
  const { data: currentCycle } = useReadContract({ address: payrollAddr, abi: PAYROLL_ABI, functionName: "currentCycle" });
  const { data: lastCycle } = useReadContract({ address: payrollAddr, abi: PAYROLL_ABI, functionName: "lastPaidCycle", args: [address] });

  const [status, salarySet, , lastPaidAt, totalPayments, empName, department] = info
    ? (info as [number, boolean, bigint, bigint, bigint, string, string])
    : [0, false, 0n, 0n, 0n, "", ""] as [number, boolean, bigint, bigint, bigint, string, string];

  const statusLabels = ["None", "Pending", "Active", "Inactive"];
  const statusChips: Record<number, string> = {
    [EmpStatus.Pending]:  "chip chip-amber",
    [EmpStatus.Active]:   "chip chip-green",
    [EmpStatus.Inactive]: "chip chip-red",
  };
  const statusLabel = info ? (statusLabels[status] ?? "Unknown") : "…";
  const chipClass   = info ? (statusChips[status] ?? "chip chip-muted") : "chip chip-muted";
  const paidThisCycle = Number(lastCycle) > 0 && Number(lastCycle) >= Number(currentCycle ?? 1) - 1;
  const initial = empName?.[0]?.toUpperCase() ?? "?";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0C0C0C" }}>
      {/* Sticky nav */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 50, background: "rgba(12,12,12,0.92)", backdropFilter: "blur(14px)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-ghost" onClick={onBack} style={{ padding: "4px 8px" }}>←</button>
            <LogoWordmark size={26} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn-ghost" style={{ fontSize: 11, color: "#333" }} onClick={onClear} title="Clear saved session">reset</button>
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
          </div>
        </div>
      </header>

      {/* Page content — single scrollable column */}
      <div style={{ maxWidth: 680, margin: "0 auto", width: "100%", padding: "32px 24px 64px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Section 1: Profile ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "rgba(233,184,74,0.1)", color: "#E9B84A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 18, flexShrink: 0,
            border: "1px solid rgba(233,184,74,0.15)",
          }}>
            {initial}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#F0F0F0", letterSpacing: "-0.01em" }}>{empName || "Employee"}</span>
              <span className={chipClass} style={{ fontSize: 11 }}>{statusLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#444" }}>
              {companyName && <span style={{ color: "#555" }}>{String(companyName)}</span>}
              {department && <><span style={{ color: "#2a2a2a" }}>·</span><span>{department}</span></>}
              <span style={{ color: "#2a2a2a" }}>·</span>
              <span style={{ fontFamily: "monospace" }}>{address.slice(0, 8)}…{address.slice(-4)}</span>
            </div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <span className="chip chip-muted" style={{ fontSize: 11 }}>Employee</span>
          </div>
        </div>

        {/* ── Section 2: Salary hero card ── */}
        <SalaryCard address={address} salarySet={salarySet} payrollAddr={payrollAddr} />

        {/* ── Section 3: Stats row ── */}
        <div style={{
          display: "flex",
          background: "#111",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
          overflow: "hidden",
        }}>
          {[
            {
              label: "Status",
              value: statusLabel,
              valueColor: status === EmpStatus.Active ? "#4ADE80" : status === EmpStatus.Pending ? "#FBBF24" : "#888",
            },
            {
              label: "Payments received",
              value: String(totalPayments),
            },
            {
              label: "Last payment",
              value: Number(lastPaidAt) > 0
                ? new Date(Number(lastPaidAt) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "Never",
            },
            {
              label: "Current cycle",
              value: paidThisCycle ? "Paid" : `#${Number(currentCycle ?? 1)}`,
              valueColor: paidThisCycle ? "#4ADE80" : undefined,
            },
          ].map((s, i) => (
            <div key={s.label} style={{
              flex: 1,
              padding: "16px 18px",
              borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "monospace", marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: (s as { valueColor?: string }).valueColor ?? "#F0F0F0", lineHeight: 1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Section 4: cUSD Balance card ── */}
        <BalanceCard address={address} />

        {/* Status notices */}
        {status === EmpStatus.Pending && (
          <div className="status-inf" style={{ fontSize: 12 }}>
            <strong>Awaiting salary setup</strong> — your employer needs to set your encrypted salary before payroll runs.
          </div>
        )}
        {status === EmpStatus.Active && !salarySet && (
          <div className="status-inf" style={{ fontSize: 12 }}>Salary not yet configured by employer.</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  Salary hero card
// ─────────────────────────────────────────────
function SalaryCard({
  address, salarySet, payrollAddr,
}: {
  address: `0x${string}`; salarySet: boolean; payrollAddr: `0x${string}`;
}) {
  const { decryptSalary, loading: fhevmLoading } = useFhevm();
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: handle } = useReadContract({
    address: payrollAddr, abi: PAYROLL_ABI, functionName: "getMySalaryHandle",
    account: address,
    query: { enabled: salarySet },
  });

  const decrypt = async () => {
    if (!handle) return;
    setDecrypting(true); setError(null);
    try {
      const val = await decryptSalary(handle as bigint, payrollAddr);
      setDecrypted(formatCUSD(val));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed");
    } finally { setDecrypting(false); }
  };

  return (
    <div style={{
      background: "linear-gradient(#111, #111) padding-box, linear-gradient(135deg, rgba(233,184,74,0.3), transparent) border-box",
      border: "1px solid transparent",
      borderRadius: 18,
      padding: 28,
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "monospace" }}>Monthly salary</span>
        <span className="chip chip-gold" style={{ fontSize: 10 }}>FHE encrypted</span>
      </div>

      {/* Value display */}
      {!salarySet ? (
        <div style={{ padding: "24px 0", textAlign: "center" }}>
          <div style={{ fontFamily: "monospace", color: "#2a2a2a", fontSize: 32, letterSpacing: "0.15em", marginBottom: 8 }}>— — —</div>
          <div style={{ fontSize: 12, color: "#333" }}>Salary not set yet</div>
        </div>
      ) : !decrypted ? (
        <div style={{
          background: "#0A0A0A", borderRadius: 12, padding: "28px 16px", textAlign: "center",
          border: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ fontFamily: "monospace", color: "#2a2a2a", fontSize: 32, letterSpacing: "0.15em" }}>
            — — —
          </div>
        </div>
      ) : (
        <div style={{
          background: "#0A0A0A", borderRadius: 12, padding: "28px 16px", textAlign: "center",
          border: "1px solid rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#E9B84A", letterSpacing: "-0.02em", lineHeight: 1 }}>{decrypted}</div>
          <div style={{ fontSize: 11, color: "#4ADE80", fontFamily: "monospace" }}>decrypted locally</div>
        </div>
      )}

      {/* Action */}
      {salarySet && !decrypted && (
        <button
          className="btn-gold"
          style={{ width: "100%" }}
          onClick={decrypt}
          disabled={decrypting || fhevmLoading || !handle}
        >
          {fhevmLoading ? "Loading fhEVM…" : decrypting ? <><Spinner size={12} /> Decrypting…</> : "Decrypt My Salary"}
        </button>
      )}
      {decrypted && (
        <button className="btn-ghost" style={{ width: "100%", fontSize: 12 }} onClick={() => setDecrypted(null)}>Clear</button>
      )}
      {error && <StatusBox type="err">{error}</StatusBox>}
    </div>
  );
}

// ─────────────────────────────────────────────
//  cUSD Balance card
// ─────────────────────────────────────────────
function BalanceCard({ address }: { address: `0x${string}` }) {
  const { decryptSalary, loading } = useFhevm();
  const [decrypted, setDecrypted] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: handle } = useReadContract({
    address: PAY_TOKEN_ADDRESS, abi: PAY_TOKEN_ABI, functionName: "encryptedBalanceOf", args: [address],
  });

  const decrypt = async () => {
    if (!handle) return;
    setDecrypting(true); setError(null);
    try {
      const val = await decryptSalary(handle as bigint, PAY_TOKEN_ADDRESS);
      setDecrypted(formatCUSD(val));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed");
    } finally { setDecrypting(false); }
  };

  return (
    <div style={{
      background: "linear-gradient(#111, #111) padding-box, linear-gradient(135deg, rgba(74,222,128,0.15), transparent) border-box",
      border: "1px solid transparent",
      borderRadius: 18,
      padding: 28,
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "monospace" }}>cUSD token balance</span>
        <span className="chip chip-muted" style={{ fontSize: 10 }}>encrypted</span>
      </div>

      {/* Value display */}
      {!decrypted ? (
        <div style={{
          background: "#0A0A0A", borderRadius: 12, padding: "28px 16px", textAlign: "center",
          border: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ fontFamily: "monospace", color: "#2a2a2a", fontSize: 32, letterSpacing: "0.15em" }}>
            — — —
          </div>
        </div>
      ) : (
        <div style={{
          background: "#0A0A0A", borderRadius: 12, padding: "28px 16px", textAlign: "center",
          border: "1px solid rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#4ADE80", letterSpacing: "-0.02em", lineHeight: 1 }}>{decrypted}</div>
          <div style={{ fontSize: 11, color: "#4ADE80", fontFamily: "monospace" }}>decrypted locally</div>
        </div>
      )}

      {/* Action */}
      {!decrypted ? (
        <>
          <button className="btn-outline" style={{ width: "100%" }} onClick={decrypt} disabled={decrypting || loading}>
            {decrypting ? <><Spinner size={12} /> Decrypting…</> : "Decrypt Balance"}
          </button>
          {error && <StatusBox type="err">{error}</StatusBox>}
        </>
      ) : (
        <button className="btn-ghost" style={{ width: "100%", fontSize: 12 }} onClick={() => setDecrypted(null)}>Clear</button>
      )}
    </div>
  );
}
