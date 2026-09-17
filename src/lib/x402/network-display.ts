const SOLANA_DEVNET_NETWORK =
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

const SOLANA_MAINNET_NETWORK =
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

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
