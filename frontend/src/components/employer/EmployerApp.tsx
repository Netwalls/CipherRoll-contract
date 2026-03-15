"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LogoWordmark } from "@/components/shared/Logo";
import { Spinner, StatusBox } from "@/components/shared/Spinner";
import {
  FACTORY_ADDRESS, FACTORY_ABI, PAYROLL_ABI,
  EmpStatus, generateInviteCode, hashInviteCode,
} from "@/lib/contracts";
import { useFhevm } from "@/hooks/useFhevm";

export function EmployerApp({ onBack }: { onBack: () => void }) {
  const { address } = useAccount();
  const { data: existingPayroll, refetch: refetchPayroll } = useReadContract({
    address: FACTORY_ADDRESS, abi: FACTORY_ABI, functionName: "employerToContract",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const hasOrg = !!existingPayroll && existingPayroll !== "0x0000000000000000000000000000000000000000";
  if (!address) return null;
  if (!hasOrg) return <CreateOrg address={address} onCreated={refetchPayroll} />;
  return <EmployerDashboard address={address} payrollAddress={existingPayroll as `0x${string}`} onBack={onBack} />;
}

function CreateOrg({ address, onCreated }: { address: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const create = async () => {
    if (!name.trim()) return; setError(null);
    try {
      const hash = await writeContractAsync({ address: FACTORY_ADDRESS, abi: FACTORY_ABI, functionName: "createOrganization", args: [name.trim()], gas: 10_000_000n });
      setTxHash(hash);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      if (msg.includes("AlreadyHasOrganization")) setError("This wallet already has an organization.");
      else setError(msg);
    }
  };
  if (isSuccess) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(74,222,128,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 12l5 5 9-10" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "#F0F0F0" }}>Contract deployed</div>
            <div style={{ color: "#555", fontSize: 13, marginTop: 2 }}>{name} is live on Sepolia</div>
          </div>
        </div>
        <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden", fontFamily: "monospace" }}>
          {[
            { label: "owner", value: `${address.slice(0, 10)}…${address.slice(-4)}`, color: "#E9B84A" },
            { label: "companyName", value: `"${name}"`, color: "#888" },
            { label: "currentCycle", value: "1", color: "#888" },
            { label: "paymentToken", value: "cUSD (FHE)", color: "#4ADE80" },
          ].map((r, i) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span style={{ color: "#444", fontSize: 12 }}>{r.label}</span>
              <span style={{ color: r.color, fontSize: 12 }}>{r.value}</span>
            </div>
          ))}
        </div>
        <button className="btn-gold" style={{ width: "100%", padding: "13px 0", fontSize: 15 }} onClick={onCreated}>Open dashboard →</button>
      </div>
    </div>
  );
  const busy = isPending || confirming;
  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1fr 1fr" }} className="create-org-grid">
      <div style={{ borderRight: "1px solid rgba(255,255,255,0.06)", padding: "80px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#E9B84A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>Step 1 of 4</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16, color: "#F0F0F0" }}>Deploy your<br />payroll contract</h1>
          <p style={{ color: "#555", fontSize: 15, lineHeight: 1.75, marginBottom: 40 }}>One transaction. Your wallet becomes the sole owner — no admin, no operator, no one between you and your employees.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { title: "Privately owned", body: "Only your wallet can set salaries or run payroll." },
              { title: "FHE from day one", body: "Every salary stored as an encrypted ciphertext on-chain." },
              { title: "Factory-deployed", body: "Multiple employers, each with their own isolated contract." },
            ].map(item => (
              <div key={item.title} style={{ display: "flex", gap: 14 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E9B84A", marginTop: 6, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#DDD", marginBottom: 3 }}>{item.title}</div>
                  <div style={{ color: "#555", fontSize: 13, lineHeight: 1.6 }}>{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ padding: "80px 56px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ maxWidth: 360, width: "100%" }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ color: "#444", fontSize: 12, fontFamily: "monospace", marginBottom: 8 }}>wallet · {address.slice(0, 8)}…{address.slice(-4)}</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#F0F0F0", letterSpacing: "-0.02em" }}>Name your organization</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input className="field" style={{ fontSize: 16, padding: "14px 16px" }} placeholder="e.g. Acme Corp" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && create()} autoFocus disabled={busy} />
            {error && <StatusBox type="err">{error}</StatusBox>}
            <button className="btn-gold" style={{ width: "100%", padding: "13px 0", fontSize: 15, marginTop: 4 }} onClick={create} disabled={!name.trim() || busy}>
              {isPending ? <><Spinner size={13} /> Confirm in MetaMask…</> : confirming ? <><Spinner size={13} /> Deploying… (15–30s)</> : "Deploy payroll contract"}
            </button>
            {txHash && confirming && (
              <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#E9B84A", textAlign: "center", fontFamily: "monospace", opacity: 0.8 }}>{txHash.slice(0, 14)}… — track on Etherscan ↗</a>
            )}
            <p style={{ color: "#3a3a3a", fontSize: 12, textAlign: "center" }}>One transaction on Sepolia. Free on testnet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

type Tab = "employees" | "invites" | "pay" | "settings";

function EmployerDashboard({ address, payrollAddress, onBack }: { address: `0x${string}`; payrollAddress: `0x${string}`; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("employees");
  const { data: companyName } = useReadContract({ address: payrollAddress, abi: PAYROLL_ABI, functionName: "companyName" });
  const { data: cycle }  = useReadContract({ address: payrollAddress, abi: PAYROLL_ABI, functionName: "currentCycle" });
  const { data: total }  = useReadContract({ address: payrollAddress, abi: PAYROLL_ABI, functionName: "totalEmployees" });
  const { data: active } = useReadContract({ address: payrollAddress, abi: PAYROLL_ABI, functionName: "activeEmployeeCount" });

  // Kick off fhEVM initialization as soon as the dashboard mounts — before any row renders
  useFhevm();

  // Fetch employee list at the dashboard level so PayrollTab can use it
  const { data: employeeAddresses } = useReadContract({
    address: payrollAddress, abi: PAYROLL_ABI, functionName: "getEmployeeList",
    account: address, query: { refetchInterval: 15_000 },
  });
  const employeeList = (employeeAddresses as `0x${string}`[] | undefined) ?? [];

  const TABS: { id: Tab; label: string }[] = [
    { id: "employees", label: "Employees" },
    { id: "invites",   label: "Invites" },
    { id: "pay",       label: "Pay" },
    { id: "settings",  label: "Settings" },
  ];

  const stats = [
    { label: "Total employees", value: String(total ?? "—") },
    { label: "Active",          value: String(active ?? "—") },
    { label: "Payrolls run",    value: String(cycle ? Number(cycle) - 1 : 0) },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0C0C0C" }}>
      {/* ── 2-row header ── */}
      <header style={{ background: "#0E0E0E", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, zIndex: 50 }}>
        {/* Top row */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={onBack} className="btn-ghost" style={{ padding: "4px 8px", fontSize: 16 }}>←</button>
            <LogoWordmark size={26} />
          </div>
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
        </div>
        {/* Bottom row — company name + stats */}
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 16px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#F0F0F0", letterSpacing: "-0.02em", lineHeight: 1 }}>
              {String(companyName || "…")}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", boxShadow: "0 0 6px #4ADE80" }} />
              <span style={{ fontSize: 11, color: "#4ADE80", fontFamily: "monospace", letterSpacing: "0.06em" }}>live on Sepolia</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 0 }}>
            {stats.map((s, i) => (
              <div key={s.label} style={{
                display: "flex", flexDirection: "column", gap: 3,
                paddingLeft: i === 0 ? 0 : 28,
                marginLeft: i === 0 ? 0 : 28,
                borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.07)",
              }}>
                <span style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.09em", fontFamily: "monospace" }}>{s.label}</span>
                <span style={{ fontSize: 28, fontWeight: 700, color: "#F0F0F0", lineHeight: 1 }}>{s.value}</span>
              </div>
            ))}
            <div style={{
              display: "flex", flexDirection: "column", gap: 3,
              paddingLeft: 28, marginLeft: 28,
              borderLeft: "1px solid rgba(255,255,255,0.07)",
            }}>
              <span style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.09em", fontFamily: "monospace" }}>Contract</span>
              <a
                href={`https://sepolia.etherscan.io/address/${payrollAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, fontWeight: 600, color: "#E9B84A", fontFamily: "monospace", textDecoration: "none", lineHeight: 1, whiteSpace: "nowrap" }}
              >
                {payrollAddress.slice(0, 8)}…{payrollAddress.slice(-4)} ↗
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0C0C0C" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "11px 18px", fontSize: 13, fontWeight: 500,
              color: tab === t.id ? "#F0F0F0" : "#555",
              borderBottom: tab === t.id ? "2px solid #E9B84A" : "2px solid transparent",
              background: "transparent", transition: "color 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "32px 24px" }}>
        {tab === "employees" && <EmployeesTab payrollAddress={payrollAddress} ownerAddress={address} />}
        {tab === "invites"   && <InvitesTab   payrollAddress={payrollAddress} />}
        {tab === "pay"       && <PayrollTab   payrollAddress={payrollAddress} ownerAddress={address} employeeList={employeeList} />}
        {tab === "settings"  && <SettingsTab  payrollAddress={payrollAddress} />}
      </div>
    </div>
  );
}

// ── Employees Tab ──────────────────────────────────────────────────────────────

function EmployeesTab({ payrollAddress, ownerAddress }: { payrollAddress: `0x${string}`; ownerAddress: `0x${string}` }) {
  const { data: addresses, refetch } = useReadContract({
    address: payrollAddress, abi: PAYROLL_ABI, functionName: "getEmployeeList",
    account: ownerAddress, query: { refetchInterval: 10_000 },
  });
  const list = (addresses as `0x${string}`[] | undefined) ?? [];

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F0F0F0", marginBottom: 2 }}>Employees</h3>
          <p style={{ fontSize: 12, color: "#444" }}>{list.length} registered</p>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => refetch()}>Refresh</button>
      </div>

      {list.length === 0 ? (
        <div style={{ padding: "64px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 13, color: "#444" }}>No employees yet</div>
          <div style={{ fontSize: 12, color: "#333", marginBottom: 4 }}>Generate an invite code and share it with your team.</div>
          <button className="btn-outline" style={{ fontSize: 12 }}>Go to Invites →</button>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 110px 120px auto",
            padding: "6px 16px",
            marginBottom: 4,
            gap: 8,
          }}>
            {["Name", "Status", "Salary", "Last Paid", "Actions"].map(col => (
              <span key={col} style={{ fontSize: 10, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: "0.09em", fontFamily: "monospace" }}>{col}</span>
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 6 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {list.map(addr => (
              <EmployeeRow key={addr} addr={addr} payrollAddress={payrollAddress} ownerAddress={ownerAddress} onUpdate={refetch} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeRow({ addr, payrollAddress, ownerAddress, onUpdate }: {
  addr: `0x${string}`; payrollAddress: `0x${string}`; ownerAddress: `0x${string}`; onUpdate: () => void;
}) {
  const { data: info, refetch } = useReadContract({
    address: payrollAddress, abi: PAYROLL_ABI, functionName: "getEmployeeInfo",
    args: [addr], account: ownerAddress,
  });
  const { encryptSalary, loading: fhevmLoading, instance: fhevmInstance, error: fhevmError } = useFhevm();
  const { writeContractAsync } = useWriteContract();
  const [showSalary, setShowSalary] = useState(false);
  const [salaryVal, setSalaryVal] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (!info) return (
    <div style={{ height: 54, borderRadius: 10, background: "#111", border: "1px solid rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }} />
  );

  const [status, salarySet, , lastPaidAt, totalPayments, empName, dept] = info as [number, boolean, bigint, bigint, bigint, string, string];
  const chipClass = status === EmpStatus.Active ? "chip chip-green" : status === EmpStatus.Pending ? "chip chip-amber" : "chip chip-red";
  const statusLabel = ["—", "Pending", "Active", "Paused"][status] ?? "Unknown";
  const initial = ((empName || addr)[0] ?? "?").toUpperCase();

  const handleSalary = async () => {
    if (!salaryVal) return;
    setError(null); setEncrypting(true);
    try {
      const { handle, inputProof } = await encryptSalary(parseFloat(salaryVal), payrollAddress, ownerAddress);
      setEncrypting(false);
      const hash = await writeContractAsync({
        address: payrollAddress, abi: PAYROLL_ABI, functionName: "setSalary",
        args: [addr, handle, inputProof], gas: 2_000_000n,
      });
      setTxHash(hash); setShowSalary(false); setSalaryVal("");
      setTimeout(() => { refetch(); onUpdate(); }, 4000);
    } catch (e) { setEncrypting(false); setError(e instanceof Error ? e.message : "Failed"); }
  };

  const toggle = async () => {
    try {
      await writeContractAsync({
        address: payrollAddress, abi: PAYROLL_ABI,
        functionName: status === EmpStatus.Active ? "deactivateEmployee" : "reactivateEmployee",
        args: [addr], gas: 200_000n,
      });
      setTimeout(() => { refetch(); onUpdate(); }, 3000);
    } catch {}
  };

  return (
    <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden", transition: "border-color 0.15s" }}>
      <div style={{
        padding: "10px 16px",
        display: "grid",
        gridTemplateColumns: "1fr 90px 110px 120px auto",
        alignItems: "center",
        gap: 8,
      }}>
        {/* Name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: "rgba(233,184,74,0.08)", color: "#E9B84A",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 14, flexShrink: 0,
            border: "1px solid rgba(233,184,74,0.12)",
          }}>
            {initial}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#EEE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {empName || "Unnamed"}
            </div>
            <div style={{ fontSize: 11, color: "#333", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {dept ? `${dept} · ` : ""}{addr.slice(0, 8)}…{addr.slice(-4)}
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <span className={chipClass} style={{ fontSize: 11 }}>{statusLabel}</span>
        </div>

        {/* Salary */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {salarySet ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1.5" y="5.5" width="9" height="6" rx="1.5" stroke="#444" strokeWidth="1.2" />
                <path d="M3.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" stroke="#444" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 12, color: "#555", fontFamily: "monospace" }}>encrypted</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "#3a3a3a" }}>— not set</span>
          )}
        </div>

        {/* Last Paid */}
        <div style={{ fontSize: 12, color: "#444", fontFamily: "monospace" }}>
          {Number(lastPaidAt) > 0
            ? new Date(Number(lastPaidAt) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—"
          }
          {Number(totalPayments) > 0 && (
            <div style={{ fontSize: 10, color: "#333", marginTop: 1 }}>{String(totalPayments)}x</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button className="btn-outline" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => setShowSalary(v => !v)}>
            {salarySet ? "Update" : "Set salary"}
          </button>
          {status === EmpStatus.Active   && <button className="btn-danger" style={{ fontSize: 11, padding: "5px 10px" }} onClick={toggle}>Pause</button>}
          {status === EmpStatus.Inactive && <button className="btn-outline" style={{ fontSize: 11, padding: "5px 10px" }} onClick={toggle}>Reactivate</button>}
        </div>
      </div>

      {/* Salary input panel */}
      {showSalary && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.3)", display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#444" }}>$</span>
            <input
              className="field"
              style={{ paddingLeft: 26, background: "#0C0C0C" }}
              placeholder="Monthly salary (USD)"
              type="number"
              value={salaryVal}
              onChange={e => setSalaryVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSalary()}
              autoFocus
            />
          </div>
          <button className="btn-gold" style={{ whiteSpace: "nowrap" }} disabled={!salaryVal || encrypting || confirming || fhevmLoading || !fhevmInstance} onClick={handleSalary}>
            {fhevmLoading ? <><Spinner size={12} /> Initializing…</> : !fhevmInstance ? "fhEVM unavailable" : encrypting ? <><Spinner size={12} /> Encrypting…</> : confirming ? <><Spinner size={12} /> Confirming…</> : "Set Salary"}
          </button>
          {fhevmError && !fhevmInstance && <span style={{ fontSize: 11, color: "#ef4444" }}>{fhevmError}</span>}
          <button className="btn-ghost" onClick={() => { setShowSalary(false); setSalaryVal(""); }}>✕</button>
        </div>
      )}

      {isSuccess && <div style={{ padding: "8px 16px" }}><StatusBox type="ok" txHash={txHash}>Salary updated.</StatusBox></div>}
      {error     && <div style={{ padding: "8px 16px" }}><StatusBox type="err">{error}</StatusBox></div>}
    </div>
  );
}

// ── Invites Tab ────────────────────────────────────────────────────────────────

function InvitesTab({ payrollAddress }: { payrollAddress: `0x${string}` }) {
  const [code, setCode] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const { data: hashes, refetch } = useReadContract({
    address: payrollAddress, abi: PAYROLL_ABI, functionName: "getInviteList",
  });

  const generate = async () => {
    setError(null);
    const invCode = generateInviteCode();
    const codeHash = await hashInviteCode(invCode);
    try {
      const hash = await writeContractAsync({
        address: payrollAddress, abi: PAYROLL_ABI, functionName: "createInvite",
        args: [codeHash, "", ""], gas: 500_000n,
      });
      setTxHash(hash); setCode(invCode);
      setTimeout(refetch, 4000);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  const copy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const list = (hashes as `0x${string}`[] | undefined) ?? [];

  return (
    <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F0F0F0" }}>Invite codes</h3>
        {!isSuccess && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            {error && <StatusBox type="err">{error}</StatusBox>}
            <button
              className="btn-gold"
              style={{ padding: "9px 20px", fontSize: 13 }}
              disabled={isPending || confirming}
              onClick={generate}
            >
              {isPending ? <><Spinner size={13} /> Confirm in wallet…</> : confirming ? <><Spinner size={13} /> Creating…</> : "+ Generate code"}
            </button>
          </div>
        )}
      </div>

      {/* Ticket display */}
      {isSuccess && code && (
        <div style={{
          background: "#0D0D0D",
          border: "1px solid rgba(233,184,74,0.25)",
          borderRadius: 16,
          overflow: "hidden",
        }}>
          <div style={{ padding: "32px 24px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#E9B84A", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace", marginBottom: 20 }}>
              Ready to share
            </div>
            <code style={{ fontSize: 32, fontWeight: 800, letterSpacing: "0.18em", color: "#F0F0F0", display: "block" }}>
              {code}
            </code>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ padding: "16px 24px", display: "flex", gap: 10 }}>
            <button className="btn-gold" style={{ flex: 1, fontSize: 13 }} onClick={copy}>
              {copied ? "Copied" : "Copy code"}
            </button>
            <button className="btn-ghost" style={{ fontSize: 13 }} onClick={() => { setCode(null); setTxHash(undefined); }}>
              Generate another
            </button>
          </div>
        </div>
      )}

      {/* History table */}
      {list.length > 0 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px", padding: "6px 14px", marginBottom: 4 }}>
            {["Hash", "Date", "Status"].map(col => (
              <span key={col} style={{ fontSize: 10, color: "#3a3a3a", textTransform: "uppercase", letterSpacing: "0.09em", fontFamily: "monospace" }}>{col}</span>
            ))}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 4 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[...list].reverse().map(h => <InviteItem key={h} codeHash={h} payrollAddress={payrollAddress} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function InviteItem({ codeHash, payrollAddress }: { codeHash: `0x${string}`; payrollAddress: `0x${string}` }) {
  const { data } = useReadContract({
    address: payrollAddress, abi: PAYROLL_ABI, functionName: "getInvite", args: [codeHash],
  });
  if (!data) return null;
  const [, claimedBy, , , createdAt] = data as [boolean, string, string, string, bigint];
  const claimed = claimedBy !== "0x0000000000000000000000000000000000000000";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 100px 80px",
      alignItems: "center",
      padding: "9px 14px",
      background: "#111",
      borderRadius: 8,
      border: "1px solid rgba(255,255,255,0.04)",
    }}>
      <div>
        <div style={{ fontSize: 12, fontFamily: "monospace", color: "#555" }}>{codeHash.slice(0, 18)}…</div>
        {claimed && (
          <div style={{ fontSize: 11, color: "#4ADE80", fontFamily: "monospace", marginTop: 2 }}>
            {claimedBy.slice(0, 8)}…{claimedBy.slice(-4)}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#444", fontFamily: "monospace" }}>
        {new Date(Number(createdAt) * 1000).toLocaleDateString()}
      </div>
      <div>
        <span className={`chip ${claimed ? "chip-green" : "chip-amber"}`} style={{ fontSize: 11 }}>
          {claimed ? "Claimed" : "Pending"}
        </span>
      </div>
    </div>
  );
}

// ── Payroll Tab (renamed "Pay") ────────────────────────────────────────────────

function PayrollTab({
  payrollAddress, ownerAddress, employeeList,
}: {
  payrollAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
  employeeList: `0x${string}`[];
}) {
  const [fundAmt, setFundAmt] = useState("");
  const [runHash, setRunHash]   = useState<`0x${string}` | undefined>();
  const [fundHash, setFundHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: runConf,  isSuccess: runOk  } = useWaitForTransactionReceipt({ hash: runHash });
  const { isLoading: fundConf, isSuccess: fundOk } = useWaitForTransactionReceipt({ hash: fundHash });

  const run = async () => {
    setError(null);
    try {
      setRunHash(await writeContractAsync({
        address: payrollAddress, abi: PAYROLL_ABI, functionName: "executePayroll", gas: 15_000_000n,
      }));
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  const fund = async () => {
    if (!fundAmt) return;
    setError(null);
    try {
      const units = BigInt(Math.round(parseFloat(fundAmt) * 1_000_000));
      setFundHash(await writeContractAsync({
        address: payrollAddress, abi: PAYROLL_ABI, functionName: "fundPayroll",
        args: [units], gas: 3_000_000n,
      }));
      setFundAmt("");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Fund row — compact */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 260 }}>
          <span style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.09em", fontFamily: "monospace" }}>Deposit cUSD</span>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#444", fontSize: 15, pointerEvents: "none" }}>$</span>
            <input
              className="field"
              style={{ paddingLeft: 28 }}
              placeholder="Amount"
              type="number"
              value={fundAmt}
              onChange={e => setFundAmt(e.target.value)}
            />
          </div>
        </div>
        <button
          className="btn-outline"
          style={{ whiteSpace: "nowrap", height: 40 }}
          disabled={!fundAmt || fundConf || isPending}
          onClick={fund}
        >
          {fundConf ? <><Spinner size={12} /> Confirming…</> : "Deposit cUSD"}
        </button>
        {fundOk && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4ADE80" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-6" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Funded
          </div>
        )}
      </div>

      <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />

      {/* Payroll batch section */}
      <BatchSection
        payrollAddress={payrollAddress}
        ownerAddress={ownerAddress}
        employeeList={employeeList}
      />

      {/* Errors and success */}
      {error  && <StatusBox type="err">{error}</StatusBox>}
      {runOk  && <StatusBox type="ok" txHash={runHash}>Payroll complete. All active employees have been paid this cycle.</StatusBox>}

      {/* Execute CTA */}
      <div style={{ paddingTop: 4 }}>
        <button
          className="btn-gold"
          style={{ width: "100%", padding: "15px 0", fontSize: 15, letterSpacing: "-0.01em" }}
          disabled={isPending || runConf}
          onClick={run}
        >
          {isPending ? <><Spinner size={13} /> Confirm in wallet…</> : runConf ? <><Spinner size={13} /> Running batch payment…</> : "Execute batch payment →"}
        </button>
        <div style={{ fontSize: 11, color: "#333", textAlign: "center", marginTop: 8, fontFamily: "monospace" }}>
          calls executePayroll() · pays all active employees with salary set
        </div>
      </div>
    </div>
  );
}

// ── Batch preview component ────────────────────────────────────────────────────

function BatchSection({
  payrollAddress, ownerAddress, employeeList,
}: {
  payrollAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
  employeeList: `0x${string}`[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#F0F0F0" }}>Payroll batch</span>
        <span style={{ fontSize: 11, color: "#444", fontFamily: "monospace" }}>{employeeList.length} employee{employeeList.length !== 1 ? "s" : ""} registered</span>
      </div>
      {employeeList.length === 0 ? (
        <div style={{ padding: "20px 16px", textAlign: "center", background: "#111", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12 }}>
          <span style={{ fontSize: 13, color: "#444" }}>No employees registered yet</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {employeeList.map(addr => (
            <BatchEmployeeRow
              key={addr}
              addr={addr}
              payrollAddress={payrollAddress}
              ownerAddress={ownerAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BatchEmployeeRow({
  addr, payrollAddress, ownerAddress,
}: {
  addr: `0x${string}`;
  payrollAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
}) {
  const { data: info } = useReadContract({
    address: payrollAddress, abi: PAYROLL_ABI, functionName: "getEmployeeInfo",
    args: [addr], account: ownerAddress,
  });

  if (!info) {
    return (
      <div style={{ height: 44, borderRadius: 8, background: "#111", border: "1px solid rgba(255,255,255,0.04)" }} />
    );
  }

  const [status, salarySet, , , , empName] = info as [number, boolean, bigint, bigint, bigint, string, string];
  const isReady = status === EmpStatus.Active && salarySet;
  const initial = ((empName || addr)[0] ?? "?").toUpperCase();

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px",
      background: isReady ? "#111" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isReady ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)"}`,
      borderRadius: 8,
      opacity: isReady ? 1 : 0.5,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: isReady ? "rgba(233,184,74,0.08)" : "rgba(255,255,255,0.04)",
          color: isReady ? "#E9B84A" : "#444",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 12, flexShrink: 0,
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: isReady ? "#EEE" : "#555" }}>
            {empName || "Unnamed"}
          </div>
          <div style={{ fontSize: 11, color: "#333", fontFamily: "monospace" }}>
            {addr.slice(0, 8)}…{addr.slice(-4)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isReady ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="1" y="5" width="9" height="5.5" rx="1.5" stroke="#555" strokeWidth="1" />
                <path d="M2.5 5V3.5a3 3 0 0 1 6 0V5" stroke="#555" strokeWidth="1" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>encrypted salary</span>
            </div>
            <span className="chip chip-green" style={{ fontSize: 10 }}>In batch</span>
          </>
        ) : (
          <span className="chip chip-muted" style={{ fontSize: 10 }}>
            {!salarySet ? "No salary" : "Inactive"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Settings Tab ───────────────────────────────────────────────────────────────

function SettingsTab({ payrollAddress }: { payrollAddress: `0x${string}` }) {
  const { data: current } = useReadContract({
    address: payrollAddress, abi: PAYROLL_ABI, functionName: "companyName",
  });
  const [name, setName] = useState("");
  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  return (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#F0F0F0", marginBottom: 2 }}>Settings</h3>
        <p style={{ fontSize: 12, color: "#444" }}>Manage your organization details.</p>
      </div>
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "monospace" }}>Company name</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#F0F0F0", letterSpacing: "-0.02em" }}>{String(current || "—")}</div>
        </div>
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)" }} />
        <input className="field" placeholder="New name" value={name} onChange={e => setName(e.target.value)} />
        {isSuccess && <StatusBox type="ok">Name updated.</StatusBox>}
        <button
          className="btn-gold"
          disabled={!name || isPending || confirming}
          onClick={async () => {
            const hash = await writeContractAsync({
              address: payrollAddress, abi: PAYROLL_ABI, functionName: "setCompanyName",
              args: [name], gas: 200_000n,
            });
            setTxHash(hash); setName("");
          }}
        >
          {isPending || confirming ? <><Spinner size={13} /> Saving…</> : "Save"}
        </button>
      </div>
      <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "monospace" }}>Contract address</div>
        <a
          href={`https://sepolia.etherscan.io/address/${payrollAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontFamily: "monospace", fontSize: 13, color: "#E9B84A", wordBreak: "break-all" }}
        >
          {payrollAddress} ↗
        </a>
      </div>
    </div>
  );
}
