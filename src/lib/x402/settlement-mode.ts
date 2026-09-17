import {
  SOLANA_DEVNET_NETWORK,
  SOLANA_MAINNET_NETWORK,
} from "@/lib/x402/config";

export function settlementModeForNetworks(
  x402Enabled: boolean,
  networks: string[]
) {
  if (!x402Enabled) return "simulated";
  if (networks.length === 0) return "x402-enabled-no-settlement";
  if (networks.length > 1) return "x402-solana-mixed";
  if (networks[0] === SOLANA_DEVNET_NETWORK) return "x402-solana-devnet";
  if (networks[0] === SOLANA_MAINNET_NETWORK) return "x402-solana-mainnet";
  return `x402-${networks[0]}`;
}
