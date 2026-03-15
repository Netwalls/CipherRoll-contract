"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";

export const wagmiConfig = getDefaultConfig({
  appName: "ZamaPay — Confidential Payroll",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "zamapay-demo",
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC || "https://sepolia.gateway.tenderly.co",
      { retryCount: 3, retryDelay: 1000 }
    ),
  },
  ssr: true,
});
