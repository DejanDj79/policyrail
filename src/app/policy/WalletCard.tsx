"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./WalletCard.module.css";

type WalletPayload = {
  address?: string;
  network?: string;
  cluster?: string;
  usdcMint?: string;
  usdcBalance?: string;
  solBalance?: string;
  x402Enabled?: boolean;
  refreshedAt?: string;
  error?: string;
};

function shortAddress(address: string) {
  if (address.length <= 24) return address;
  return `${address.slice(0, 12)}…${address.slice(-10)}`;
}

function displayUsdc(balance?: string) {
  if (!balance) return "$0.00";
  const value = Number(balance);
  if (!Number.isFinite(value)) return `$${balance}`;
  return `$${value.toFixed(2)}`;
}

export default function WalletCard() {
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wallet", { cache: "no-store" });
      const payload = (await response.json()) as WalletPayload;

      if (!response.ok || !payload.address) {
        throw new Error(payload.error ?? "Could not load the agent wallet.");
      }

      setWallet(payload);
    } catch (walletError) {
      setError(
        walletError instanceof Error
          ? walletError.message
          : "Could not load the agent wallet."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <p className={styles.label}>AGENT WALLET</p>
          <h2 className={styles.title}>x402 spending wallet</h2>
        </div>
        <span className={styles.network}>
          {wallet?.network ?? "SOLANA DEVNET"}
        </span>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading && !wallet ? (
        <p className={styles.loading}>Reading live balance from Solana…</p>
      ) : wallet ? (
        <>
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span>USDC balance</span>
              <strong>{displayUsdc(wallet.usdcBalance)}</strong>
            </div>
            <div className={styles.metric}>
              <span>SOL balance</span>
              <strong>{wallet.solBalance ?? "0.0000"}</strong>
            </div>
          </div>

          <div className={styles.addressBlock}>
            <span>Wallet address</span>
            <div className={styles.addressRow}>
              <code title={wallet.address}>{shortAddress(wallet.address!)}</code>
              <a
                href={`https://explorer.solana.com/address/${wallet.address}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
              >
                Explorer ↗
              </a>
            </div>
          </div>

          <div className={styles.footer}>
            <p className={styles.note}>
              Live wallet balance. Policy limits how much the agent may spend.
            </p>
            <button
              className={styles.refresh}
              type="button"
              onClick={loadWallet}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh balance"}
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
