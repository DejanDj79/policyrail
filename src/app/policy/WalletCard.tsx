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

  const cluster = wallet?.cluster ?? "devnet";
  const explorerHref = wallet?.address
    ? `https://explorer.solana.com/address/${wallet.address}?cluster=${encodeURIComponent(cluster)}`
    : "#";

  return (
    <aside className={styles.wallet}>
      <div className={styles.heading}>
        <span>AGENT WALLET</span>
        <div className={styles.actions}>
          <button
            className={styles.iconButton}
            type="button"
            onClick={loadWallet}
            disabled={loading}
            aria-label={loading ? "Refreshing wallet balance" : "Refresh wallet balance"}
            title={loading ? "Refreshing…" : "Refresh wallet balance"}
          >
            ↻
          </button>

          <span
            className={styles.info}
            tabIndex={0}
            aria-label="Live wallet balance. PolicyRail limits how much the agent may spend; approved x402 payments settle from this wallet."
          >
            i
            <span className={styles.tooltip}>
              Live wallet balance. PolicyRail limits how much the agent may spend; approved x402 payments settle from this wallet.
            </span>
          </span>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading && !wallet ? (
        <p className={styles.loading}>Reading wallet…</p>
      ) : wallet ? (
        <div className={styles.rows}>
          <div className={styles.row}>
            <span>Network</span>
            <strong>{wallet.network ?? "Solana Devnet"}</strong>
          </div>
          <div className={styles.row}>
            <span>USDC</span>
            <strong>{displayUsdc(wallet.usdcBalance)}</strong>
          </div>
          <div className={styles.row}>
            <span>SOL</span>
            <strong>{wallet.solBalance ?? "0.0000"}</strong>
          </div>
          <div className={styles.row}>
            <span>Address</span>
            <a
              href={explorerHref}
              target="_blank"
              rel="noreferrer"
              title={wallet.address}
            >
              {shortAddress(wallet.address!)}
            </a>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
