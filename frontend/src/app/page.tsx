"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LogoWordmark } from "@/components/shared/Logo";
import { EmployerApp } from "@/components/employer/EmployerApp";
import { EmployeeApp } from "@/components/employee/EmployeeApp";

type Screen = "landing" | "register" | "employer" | "employee";

export default function Root() {
  const { isConnected } = useAccount();
  const [screen, setScreen] = useState<Screen>("landing");

  if (screen === "employer") return <EmployerApp onBack={() => setScreen("register")} />;
  if (screen === "employee") return <EmployeeApp onBack={() => setScreen("register")} />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0C0C0C" }}>
      <Nav onLogoClick={() => setScreen("landing")} />
      {screen === "landing"
        ? <Landing onRegister={() => setScreen("register")} isConnected={isConnected} />
        : <Register onSelect={setScreen} onBack={() => setScreen("landing")} />
      }
    </div>
  );
}

// ─────────────────────────────────────────────
//  Nav
// ─────────────────────────────────────────────
function Nav({ onLogoClick }: { onLogoClick: () => void }) {
  return (
    <header style={{
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      backdropFilter: "blur(16px)",
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(12,12,12,0.92)",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onLogoClick} style={{ background: "none", padding: 0 }}>
          <LogoWordmark size={28} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="https://sepolia.etherscan.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12, fontFamily: "monospace",
              color: "#4ADE80", opacity: 0.7,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block", boxShadow: "0 0 6px #4ADE80" }} />
            Sepolia
          </a>
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" label="Connect" />
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
//  Landing
// ─────────────────────────────────────────────
function Landing({ onRegister, isConnected }: { onRegister: () => void; isConnected: boolean }) {
  return (
    <main style={{ flex: 1 }}>

      {/* ── Hero ── */}
      <section style={{
        maxWidth: 1100, margin: "0 auto", padding: "80px 24px 60px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center",
      }}
        className="hero-grid"
      >
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            marginBottom: 28, padding: "5px 12px 5px 8px",
            background: "rgba(233,184,74,0.06)",
            border: "1px solid rgba(233,184,74,0.15)",
            borderRadius: 99, fontSize: 11, fontFamily: "monospace", color: "#E9B84A",
          }}>
            <span style={{ background: "#E9B84A", width: 6, height: 6, borderRadius: "50%", animation: "pulse 2s infinite" }} />
            fhEVM · Fully Homomorphic Encryption
          </div>

          <h1 style={{
            fontSize: "clamp(38px,5vw,58px)", fontWeight: 800,
            lineHeight: 1.06, letterSpacing: "-0.035em",
            marginBottom: 20, color: "#F0F0F0",
          }}>
            Payroll nobody<br />
            <span style={{ color: "#E9B84A" }}>else can read.</span>
          </h1>

          <p style={{ color: "#666", fontSize: 16, lineHeight: 1.75, marginBottom: 32, maxWidth: 400 }}>
            Salaries live on-chain as ciphertexts. Your employer runs payroll
            without seeing what anyone else earns. Employees decrypt only their
            own pay — locally, with a wallet signature.
          </p>

          {isConnected ? (
            <button
              onClick={onRegister}
              style={{
                background: "#E9B84A", color: "#0C0C0C",
                fontWeight: 700, fontSize: 15, padding: "13px 28px",
                borderRadius: 12, border: "none", cursor: "pointer",
                transition: "background 0.15s, transform 0.1s",
                display: "inline-flex", alignItems: "center", gap: 8,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F0C452"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#E9B84A"; }}
            >
              Get started
              <ArrowRight />
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
              <ConnectButton label="Connect Wallet" showBalance={false} chainStatus="none" />
              <span style={{ color: "#444", fontSize: 12 }}>Connect your wallet to continue</span>
            </div>
          )}
        </div>

        {/* Ciphertext visual */}
        <div style={{
          background: "#111",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20,
          overflow: "hidden",
          fontFamily: "monospace",
        }}>
          <div style={{
            background: "rgba(255,255,255,0.03)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#333" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#333" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#333" }} />
            <span style={{ color: "#444", fontSize: 11, marginLeft: 6 }}>payroll_contract.sol — Sepolia</span>
          </div>
          <div style={{ padding: "20px 20px 8px" }}>
            <div style={{ fontSize: 11, color: "#444", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>On-chain state</div>
            {[
              { label: "Alice salary", value: "0x8f2a…c4d3", note: "euint64 ciphertext" },
              { label: "Bob salary",   value: "0x1c9e…7a12", note: "euint64 ciphertext" },
              { label: "Carol salary", value: "0xf03b…2e98", note: "euint64 ciphertext" },
            ].map(row => (
              <div key={row.label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                gap: 12,
              }}>
                <span style={{ color: "#555", fontSize: 12 }}>{row.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#E9B84A", fontSize: 13, fontWeight: 600 }}>{row.value}</span>
                  <span style={{ color: "#333", fontSize: 10 }}>{row.note}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#444", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>Alice decrypts hers</div>
            <div style={{
              background: "rgba(233,184,74,0.06)",
              border: "1px solid rgba(233,184,74,0.15)",
              borderRadius: 10, padding: "12px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ color: "#888", fontSize: 12 }}>0x8f2a…c4d3</span>
              <span style={{ color: "#888", fontSize: 16 }}>→</span>
              <span style={{ color: "#E9B84A", fontSize: 18, fontWeight: 700 }}>$8,400</span>
            </div>
            <p style={{ color: "#444", fontSize: 11, marginTop: 8 }}>Bob and Carol still see only ciphertexts.</p>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "64px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
            <span style={{ color: "#444", fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>How it works</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, position: "relative" }} className="steps-grid">
            {[
              {
                n: "01",
                actor: "Employer",
                title: "Register org",
                body: "Deploy a private payroll contract owned by your wallet. No central operator.",
                color: "#E9B84A",
              },
              {
                n: "02",
                actor: "Employer",
                title: "Issue invite codes",
                body: "Generate one-time codes for each hire. Share off-chain — Slack, email, anything.",
                color: "#E9B84A",
              },
              {
                n: "03",
                actor: "Employee",
                title: "Claim & register",
                body: "Enter the code in the app. Your wallet address gets linked to your record.",
                color: "#888",
              },
              {
                n: "04",
                actor: "Both",
                title: "Encrypted payroll",
                body: "Employer sets salary as FHE ciphertext. Runs payroll on-chain. You decrypt yours.",
                color: "#4ADE80",
              },
            ].map((s, i) => (
              <div key={s.n} style={{
                padding: "24px 28px 24px 24px",
                borderLeft: i === 0 ? "1px solid rgba(255,255,255,0.07)" : "none",
                borderRight: "1px solid rgba(255,255,255,0.07)",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#333" }}>{s.n}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.color, opacity: 0.8 }}>{s.actor}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: "#E8E8E8" }}>{s.title}</div>
                <div style={{ color: "#555", fontSize: 13, lineHeight: 1.65 }}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech row ── */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "48px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#3a3a3a", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>Built with</span>
          {[
            { name: "Zama fhEVM", desc: "Fully Homomorphic Encryption" },
            { name: "ERC-7984",  desc: "Confidential token standard" },
            { name: "Hardhat",   desc: "Solidity 0.8.24, cancun" },
            { name: "wagmi v2",  desc: "+ viem + RainbowKit" },
          ].map(t => (
            <div key={t.name} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#666" }}>{t.name}</span>
              <span style={{ fontSize: 11, color: "#3a3a3a" }}>{t.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// ─────────────────────────────────────────────
//  Register — role picker
// ─────────────────────────────────────────────
function Register({ onSelect, onBack }: { onSelect: (s: Screen) => void; onBack: () => void }) {
  const { isConnected, address } = useAccount();
  const [hovered, setHovered] = useState<"employer" | "employee" | null>(null);

  if (!isConnected) return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
      <p style={{ color: "#666" }}>Connect your wallet to continue.</p>
      <ConnectButton showBalance={false} chainStatus="none" />
      <button className="btn-ghost" onClick={onBack}>← Back</button>
    </main>
  );

  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* top bar */}
      <div style={{ padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button className="btn-ghost" onClick={onBack} style={{ fontSize: 13 }}>← Back</button>
        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#333" }}>
          {address?.slice(0, 8)}…{address?.slice(-4)}
        </span>
      </div>

      {/* Role split */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr" }} className="role-grid">

        {/* Employer */}
        <button
          onClick={() => onSelect("employer")}
          onMouseEnter={() => setHovered("employer")}
          onMouseLeave={() => setHovered(null)}
          style={{
            background: hovered === "employer" ? "rgba(233,184,74,0.04)" : "transparent",
            border: "none",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "64px 56px",
            textAlign: "left",
            cursor: "pointer",
            transition: "background 0.2s",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: hovered === "employer" ? "rgba(233,184,74,0.15)" : "rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 28, transition: "background 0.2s",
          }}>
            <OrgIcon color={hovered === "employer" ? "#E9B84A" : "#555"} />
          </div>

          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#E9B84A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, opacity: hovered === "employer" ? 1 : 0.5 }}>
            Employer
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#F0F0F0", marginBottom: 16, lineHeight: 1.1 }}>
            Run payroll
          </h2>
          <p style={{ color: "#555", fontSize: 14, lineHeight: 1.7, maxWidth: 340, marginBottom: 40 }}>
            Deploy a private payroll contract. Add employees via invite codes.
            Set encrypted salaries. Execute payroll — amounts never visible on-chain.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 48 }}>
            {[
              "Deploy your org contract",
              "Issue one-time invite codes",
              "Set FHE-encrypted salaries",
              "Execute confidential payroll",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#E9B84A", fontSize: 12 }}>—</span>
                <span style={{ color: "#555", fontSize: 13 }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            color: hovered === "employer" ? "#E9B84A" : "#444",
            fontSize: 14, fontWeight: 600, transition: "color 0.2s",
          }}>
            Continue as employer
            <ArrowRight size={16} />
          </div>
        </button>

        {/* Employee */}
        <button
          onClick={() => onSelect("employee")}
          onMouseEnter={() => setHovered("employee")}
          onMouseLeave={() => setHovered(null)}
          style={{
            background: hovered === "employee" ? "rgba(255,255,255,0.02)" : "transparent",
            border: "none",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "64px 56px",
            textAlign: "left",
            cursor: "pointer",
            transition: "background 0.2s",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: hovered === "employee" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 28, transition: "background 0.2s",
          }}>
            <PersonIcon color={hovered === "employee" ? "#E0E0E0" : "#555"} />
          </div>

          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, opacity: hovered === "employee" ? 1 : 0.5 }}>
            Employee
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "#F0F0F0", marginBottom: 16, lineHeight: 1.1 }}>
            View your pay
          </h2>
          <p style={{ color: "#555", fontSize: 14, lineHeight: 1.7, maxWidth: 340, marginBottom: 40 }}>
            Your employer sent you an invite code. Use it to register your wallet.
            Then decrypt your salary locally — no server, no one else can see it.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 48 }}>
            {[
              "Enter your one-time invite code",
              "Register your wallet address",
              "Verify salary was set",
              "Decrypt your pay locally",
            ].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "#555", fontSize: 12 }}>—</span>
                <span style={{ color: "#555", fontSize: 13 }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            color: hovered === "employee" ? "#E0E0E0" : "#444",
            fontSize: 14, fontWeight: 600, transition: "color 0.2s",
          }}>
            Continue with invite code
            <ArrowRight size={16} />
          </div>
        </button>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────
//  Icons
// ─────────────────────────────────────────────
function ArrowRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OrgIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="10" width="18" height="11" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M6 10V7a5 5 0 0110 0v3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="9" y="14" width="4" height="4" rx="1" fill={color} />
    </svg>
  );
}

function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="7" r="4" stroke={color} strokeWidth="1.5" />
      <path d="M3 20c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
