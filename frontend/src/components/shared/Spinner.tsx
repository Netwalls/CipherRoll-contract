export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg style={{ width: size, height: size }} className="animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function StatusBox({
  type, children, txHash,
}: {
  type: "ok" | "err" | "info";
  children: React.ReactNode;
  txHash?: string;
}) {
  const cls = type === "ok" ? "status-ok" : type === "err" ? "status-err" : "status-inf";
  return (
    <div className={cls}>
      {children}
      {txHash && (
        <a
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank" rel="noopener noreferrer"
          style={{ marginLeft: 8, textDecoration: "underline", opacity: 0.8 }}
        >
          View tx ↗
        </a>
      )}
    </div>
  );
}
