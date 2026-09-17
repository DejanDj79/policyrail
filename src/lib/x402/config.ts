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

export const SOLANA_MAINNET_RPC =
  process.env.SOLANA_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

export function isX402Enabled() {
  return process.env.POLICYRAIL_X402_ENABLED === "true";
}

export function isExternalX402ExecutionEnabled() {
  return (
    isX402Enabled() &&
    process.env.POLICYRAIL_EXTERNAL_X402_ENABLED === "true"
  );
}

export function isMainnetX402ExecutionEnabled() {
  return (
    isExternalX402ExecutionEnabled() &&
    process.env.POLICYRAIL_MAINNET_X402_ENABLED === "true"
  );
}

export function getSolanaRpcUrl(network: string) {
  if (network === SOLANA_DEVNET_NETWORK) return SOLANA_DEVNET_RPC;

  if (network === SOLANA_MAINNET_NETWORK) {
    if (!isMainnetX402ExecutionEnabled()) {
      throw new Error(
        "Solana mainnet x402 execution is disabled. Enable the dedicated mainnet opt-in before using a mainnet RPC."
      );
    }
    return SOLANA_MAINNET_RPC;
  }

  throw new Error(`Unsupported Solana x402 network: ${network}`);
}

export function getX402Configuration() {
  return {
    enabled: isX402Enabled(),
    externalExecutionEnabled: isExternalX402ExecutionEnabled(),
    mainnetExecutionEnabled: isMainnetX402ExecutionEnabled(),
    agentPrivateKey: process.env.POLICYRAIL_AGENT_PRIVATE_KEY ?? null,
    agentAddress: process.env.POLICYRAIL_AGENT_ADDRESS ?? null,
    mainnetAgentPrivateKey:
      process.env.POLICYRAIL_MAINNET_AGENT_PRIVATE_KEY ?? null,
    mainnetAgentAddress: process.env.POLICYRAIL_MAINNET_AGENT_ADDRESS ?? null,
    merchantAddress: process.env.POLICYRAIL_MERCHANT_ADDRESS ?? null,
    rpcUrl: SOLANA_DEVNET_RPC,
    devnetRpcUrl: SOLANA_DEVNET_RPC,
    mainnetRpcUrl: SOLANA_MAINNET_RPC,
    facilitatorUrl: X402_FACILITATOR_URL,
  };
}

export function assertX402PayerConfigured(network: string) {
  const config = getX402Configuration();

  if (network === SOLANA_MAINNET_NETWORK) {
    if (!config.mainnetExecutionEnabled) {
      throw new Error(
        "Solana mainnet x402 execution is disabled. POLICYRAIL_MAINNET_X402_ENABLED must be true."
      );
    }

    if (!config.mainnetAgentPrivateKey || !config.mainnetAgentAddress) {
      throw new Error(
        "Dedicated mainnet payer credentials are missing. Set POLICYRAIL_MAINNET_AGENT_PRIVATE_KEY and POLICYRAIL_MAINNET_AGENT_ADDRESS before enabling mainnet execution."
      );
    }

    return {
      agentPrivateKey: config.mainnetAgentPrivateKey,
      agentAddress: config.mainnetAgentAddress,
      rpcUrl: getSolanaRpcUrl(network),
    };
  }

  if (network !== SOLANA_DEVNET_NETWORK) {
    throw new Error(`Unsupported Solana x402 network: ${network}`);
  }

  if (!config.agentPrivateKey) {
    throw new Error(
      "POLICYRAIL_AGENT_PRIVATE_KEY is missing. Run npm run wallet:setup first."
    );
  }

  return {
    agentPrivateKey: config.agentPrivateKey,
    agentAddress: config.agentAddress,
    rpcUrl: getSolanaRpcUrl(network),
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
