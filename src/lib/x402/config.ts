export const SOLANA_DEVNET_NETWORK =
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1" as const;

export const SOLANA_DEVNET_USDC_MINT =
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" as const;

export const SOLANA_MAINNET_NETWORK =
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" as const;

export const SOLANA_MAINNET_USDC_MINT =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" as const;

export const SOLANA_DEVNET_RPC =
  process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

export function isX402Enabled() {
  return process.env.POLICYRAIL_X402_ENABLED === "true";
}

export function getX402Configuration() {
  return {
    enabled: isX402Enabled(),
    agentPrivateKey: process.env.POLICYRAIL_AGENT_PRIVATE_KEY ?? null,
    agentAddress: process.env.POLICYRAIL_AGENT_ADDRESS ?? null,
    merchantAddress: process.env.POLICYRAIL_MERCHANT_ADDRESS ?? null,
    rpcUrl: SOLANA_DEVNET_RPC,
    facilitatorUrl: X402_FACILITATOR_URL,
  };
}

export function assertX402ClientConfigured() {
  const config = getX402Configuration();

  if (!config.agentPrivateKey) {
    throw new Error(
      "POLICYRAIL_AGENT_PRIVATE_KEY is missing. Run npm run wallet:setup first."
    );
  }

  if (!config.merchantAddress) {
    throw new Error(
      "POLICYRAIL_MERCHANT_ADDRESS is missing. Run npm run wallet:setup first."
    );
  }

  return {
    ...config,
    agentPrivateKey: config.agentPrivateKey,
    merchantAddress: config.merchantAddress,
  };
}
