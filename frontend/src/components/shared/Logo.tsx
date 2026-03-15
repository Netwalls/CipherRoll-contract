"use client";

export function CipherRollLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer hexagon */}
      <path
        d="M20 3L35.5885 11.5V28.5L20 37L4.41154 28.5V11.5L20 3Z"
        fill="#E9B84A"
        fillOpacity="0.12"
        stroke="#E9B84A"
        strokeWidth="1.2"
      />
      {/* Lock body */}
      <rect x="13" y="20" width="14" height="11" rx="2.5" fill="#E9B84A" />
      {/* Lock shackle */}
      <path
        d="M15.5 20V16.5C15.5 13.7386 17.7386 11.5 20.5 11.5C23.2614 11.5 25.5 13.7386 25.5 16.5V20"
        stroke="#E9B84A"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Keyhole */}
      <circle cx="20" cy="25.5" r="1.8" fill="#141414" />
      <rect x="19.1" y="25.5" width="1.8" height="2.8" rx="0.9" fill="#141414" />
    </svg>
  );
}

export function LogoWordmark({ size = 32 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <CipherRollLogo size={size} />
      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", color: "#F0F0F0" }}>
        Cipher<span style={{ color: "#E9B84A" }}>Roll</span>
      </span>
    </div>
  );
}
