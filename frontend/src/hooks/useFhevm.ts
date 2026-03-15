"use client";

import { useEffect, useState, useCallback } from "react";
import { useWalletClient } from "wagmi";
import { FHEVM_CONFIG } from "@/lib/contracts";

// ─── Simulation mode (demo) ───────────────────────────────────────────────────
// Set NEXT_PUBLIC_SIM=true to bypass real fhevmjs and use localStorage-backed
// encryption so the UI flow works without a live gateway.
const SIM = process.env.NEXT_PUBLIC_SIM === "true";

const SIM_KEY = (contractAddr: string, addr: string) =>
  `sim:salary:${contractAddr.toLowerCase()}:${addr.toLowerCase()}`;

type ZKInput = {
  add64: (value: number | bigint) => ZKInput;
  encrypt: () => Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
};

type FhevmInstance = {
  createEncryptedInput: (contractAddress: string, userAddress: string) => ZKInput;
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (publicKey: string, contractAddress: string) => {
    domain: Record<string, unknown>;
    types: Record<string, unknown[]>;
    message: Record<string, unknown>;
    primaryType: string;
  };
  decrypt: (
    ciphertextHandle: bigint,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddress: string,
    userAddress: string
  ) => Promise<bigint>;
};

// Mock instance that never touches the network
const MOCK_INSTANCE: FhevmInstance = {
  createEncryptedInput: () => ({ add64: function(this: ZKInput) { return this; }, encrypt: async () => ({ handles: [new Uint8Array(32)], inputProof: new Uint8Array(32) }) }),
  generateKeypair: () => ({ publicKey: "0x" + "aa".repeat(32), privateKey: "0x" + "bb".repeat(32) }),
  createEIP712: () => ({ domain: {}, types: { Authorization: [] }, message: {}, primaryType: "Authorization" }),
  decrypt: async () => 0n,
};

let _instance: FhevmInstance | null = SIM ? MOCK_INSTANCE : null;

export function useFhevm() {
  const [instance, setInstance] = useState<FhevmInstance | null>(_instance);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    if (SIM) { setInstance(MOCK_INSTANCE); return; }
    if (_instance) { setInstance(_instance); return; }
    setLoading(true);
    (async () => {
      try {
        const { createInstance } = await import("fhevmjs");
        const inst = await createInstance({
          kmsContractAddress: FHEVM_CONFIG.kmsContractAddress,
          aclContractAddress: FHEVM_CONFIG.aclContractAddress,
          network: window.ethereum as Parameters<typeof createInstance>[0]["network"],
          chainId: FHEVM_CONFIG.chainId,
          relayerUrl: FHEVM_CONFIG.relayerUrl,
        });
        _instance = inst as unknown as FhevmInstance;
        setInstance(_instance);
      } catch (e) {
        setError(e instanceof Error ? e.message : "fhEVM init failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Encrypt a USD salary amount as euint64 (6 decimal places).
   * In SIM mode: store the raw units in localStorage and return fake bytes.
   */
  const encryptSalary = useCallback(async (
    salaryUSD: number,
    contractAddress: string,
    userAddress: string
  ): Promise<{ handle: `0x${string}`; inputProof: `0x${string}`; _simUnits?: bigint }> => {
    if (!instance) throw new Error("fhEVM not initialized");
    const units = BigInt(Math.round(salaryUSD * 1_000_000));

    if (SIM) {
      // Encode units into a fake 32-byte handle so decryptSalary can recover it
      const hex = units.toString(16).padStart(64, "0");
      return {
        handle: `0x${hex}` as `0x${string}`,
        inputProof: `0x${"de".repeat(32)}` as `0x${string}`,
        _simUnits: units,
      };
    }

    const input = instance.createEncryptedInput(contractAddress, userAddress);
    input.add64(units);
    const { handles, inputProof } = await input.encrypt();
    const toHex = (b: Uint8Array) => ("0x" + Buffer.from(b).toString("hex")) as `0x${string}`;
    return { handle: toHex(handles[0]), inputProof: toHex(inputProof) };
  }, [instance]);

  /**
   * Decrypt a ciphertext handle.
   * In SIM mode: read the stored salary from localStorage.
   */
  const decryptSalary = useCallback(async (
    ciphertextHandle: bigint,
    contractAddress: string
  ): Promise<bigint> => {
    if (!instance) throw new Error("fhEVM not initialized");
    if (!walletClient) throw new Error("Wallet not connected");

    if (SIM) {
      const userAddress = walletClient.account.address;
      const stored = typeof window !== "undefined"
        ? localStorage.getItem(SIM_KEY(contractAddress, userAddress))
        : null;
      if (stored) return BigInt(stored);
      // Fall back to the handle value itself (which encodes the salary in sim mode)
      return ciphertextHandle;
    }

    const userAddress = walletClient.account.address;
    const { publicKey, privateKey } = instance.generateKeypair();
    const eip712 = instance.createEIP712(publicKey, contractAddress);

    const signature = await walletClient.signTypedData({
      domain: eip712.domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
      types: eip712.types as Parameters<typeof walletClient.signTypedData>[0]["types"],
      primaryType: eip712.primaryType as string,
      message: eip712.message as Parameters<typeof walletClient.signTypedData>[0]["message"],
    });

    return instance.decrypt(
      ciphertextHandle,
      privateKey,
      publicKey,
      signature,
      contractAddress,
      userAddress
    );
  }, [instance, walletClient]);

  return { instance, loading, error, encryptSalary, decryptSalary };
}

// ─── Sim helpers (used by EmployerApp to persist salary for employee) ─────────
export function simSaveSalary(contractAddr: string, employeeAddr: string, units: bigint) {
  if (typeof window !== "undefined")
    localStorage.setItem(SIM_KEY(contractAddr, employeeAddr), units.toString());
}

export function simHasSalary(contractAddr: string, employeeAddr: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(SIM_KEY(contractAddr, employeeAddr));
}
