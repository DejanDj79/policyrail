import {
  SOLANA_DEVNET_NETWORK,
  SOLANA_MAINNET_NETWORK,
} from "@/lib/x402/config";

export function solanaNetworkLabel(network: string | null | undefined) {
  if (network === SOLANA_DEVNET_NETWORK) return "Solana Devnet";
  if (network === SOLANA_MAINNET_NETWORK) return "Solana Mainnet";
  return network || "Solana";
}

export function solanaExplorerTransactionUrl(
  signature: string,
  network: string | null | undefined
) {
  const base = `https://explorer.solana.com/tx/${encodeURIComponent(signature)}`;
  return network === SOLANA_DEVNET_NETWORK ? `${base}?cluster=devnet` : base;
}
