"use client";

import { useEffect, useState, useCallback } from "react";
import { useWalletClient } from "wagmi";
import { FHEVM_CONFIG } from "@/lib/contracts";

type EncryptedInput = {
  add64: (value: bigint) => void;
  encrypt: () => Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
};

type FhevmInstance = {
  createEncryptedInput: (contractAddress: string, userAddress: string) => EncryptedInput;
  generateKeypair: () => { publicKey: Uint8Array; privateKey: Uint8Array };
  createEIP712: (publicKey: Uint8Array, contractAddress: string) => {
    domain: Record<string, unknown>;
    types: Record<string, unknown[]>;
    message: Record<string, unknown>;
  };
  reencrypt: (
    ciphertextHandle: bigint,
    privateKey: Uint8Array,
    publicKey: Uint8Array,
    signature: string,
    contractAddress: string,
    userAddress: string
  ) => Promise<bigint>;
};

let _instance: FhevmInstance | null = null;

export function useFhevm() {
  const [instance, setInstance] = useState<FhevmInstance | null>(_instance);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    if (_instance) {
      setInstance(_instance);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const { createInstance } = await import("fhevmjs");
        // Use a local Next.js proxy to avoid CORS issues with the Zama gateway
        const gatewayUrl = `${window.location.origin}/api/gateway/`;
        const inst = await createInstance({
          kmsContractAddress: FHEVM_CONFIG.kmsContractAddress,
          aclContractAddress: FHEVM_CONFIG.aclContractAddress,
          network: window.ethereum as Parameters<typeof createInstance>[0]["network"],
          chainId: FHEVM_CONFIG.chainId,
          gatewayUrl,
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
   * Returns the bytes32 handle and inputProof for the contract call.
   */
  const encryptSalary = useCallback(async (
    salaryUSD: number,
    contractAddress: string,
    userAddress: string
  ): Promise<{ handle: `0x${string}`; inputProof: `0x${string}` }> => {
    if (!instance) throw new Error("fhEVM not initialized");
    const units = BigInt(Math.round(salaryUSD * 1_000_000));
    const input = instance.createEncryptedInput(contractAddress, userAddress);
    input.add64(units);
    const { handles, inputProof } = await input.encrypt();
    const toHex = (b: Uint8Array) => ("0x" + Buffer.from(b).toString("hex")) as `0x${string}`;
    return { handle: toHex(handles[0]), inputProof: toHex(inputProof) };
  }, [instance]);

  /**
   * Reencrypt and decrypt a ciphertext handle using the connected wallet.
   * The wallet signs a challenge; Zama KMS reencrypts under the user's ephemeral key.
   */
  const decryptSalary = useCallback(async (
    ciphertextHandle: bigint,
    contractAddress: string
  ): Promise<bigint> => {
    if (!instance) throw new Error("fhEVM not initialized");
    if (!walletClient) throw new Error("Wallet not connected");

    const userAddress = walletClient.account.address;
    const { publicKey, privateKey } = instance.generateKeypair();
    const eip712 = instance.createEIP712(publicKey, contractAddress);

    const signature = await walletClient.signTypedData({
      domain: eip712.domain as Parameters<typeof walletClient.signTypedData>[0]["domain"],
      types: eip712.types as Parameters<typeof walletClient.signTypedData>[0]["types"],
      primaryType: "Reencrypt",
      message: eip712.message as Parameters<typeof walletClient.signTypedData>[0]["message"],
    });

    return instance.reencrypt(
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
