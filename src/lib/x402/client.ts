import { base58 } from "@scure/base";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import {
  wrapFetchWithPayment,
  x402Client,
  x402HTTPClient,
} from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import {
  atomicUsdcFromString,
  formatAtomicUsd,
} from "@/lib/money/usdc";
import {
  assertX402PayerConfigured,
  isMainnetX402ExecutionEnabled,
  SOLANA_DEVNET_NETWORK,
  SOLANA_DEVNET_USDC_MINT,
  SOLANA_MAINNET_NETWORK,
  SOLANA_MAINNET_USDC_MINT,
} from "@/lib/x402/config";

export interface X402SettlementResult {
  content: string;
  transactionSignature: string;
  network: string;
  payer: string | null;
}

export interface X402PurchaseExpectation {
  network: string;
  asset: string;
}

type PaymentRequirement = {
  scheme?: unknown;
  network?: unknown;
  asset?: unknown;
  amount?: unknown;
};

type PaymentRequired = {
  x402Version?: unknown;
  accepts?: unknown;
};

type SupportedExecutionTarget = {
  network: typeof SOLANA_DEVNET_NETWORK | typeof SOLANA_MAINNET_NETWORK;
  asset: typeof SOLANA_DEVNET_USDC_MINT | typeof SOLANA_MAINNET_USDC_MINT;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodePaymentRequired(value: string | null): PaymentRequired | null {
  if (!value) return null;

  const attempts = [
    () => JSON.parse(value) as unknown,
    () => JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown,
    () => JSON.parse(Buffer.from(value, "base64").toString("utf8")) as unknown,
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      if (isRecord(parsed)) return parsed as PaymentRequired;
    } catch {
      // Try the next supported representation.
    }
  }

  return null;
}

function resolveExecutionTarget(
  expectation: X402PurchaseExpectation
): SupportedExecutionTarget {
  if (
    expectation.network === SOLANA_DEVNET_NETWORK &&
    expectation.asset === SOLANA_DEVNET_USDC_MINT
  ) {
    return {
      network: SOLANA_DEVNET_NETWORK,
      asset: SOLANA_DEVNET_USDC_MINT,
    };
  }

  if (
    expectation.network === SOLANA_MAINNET_NETWORK &&
    expectation.asset === SOLANA_MAINNET_USDC_MINT
  ) {
    if (!isMainnetX402ExecutionEnabled()) {
      throw new Error(
        "Solana mainnet x402 execution is disabled by the dedicated PolicyRail mainnet gate"
      );
    }

    return {
      network: SOLANA_MAINNET_NETWORK,
      asset: SOLANA_MAINNET_USDC_MINT,
    };
  }

  throw new Error(
    `Unsupported x402 settlement target: ${expectation.network} / ${expectation.asset}`
  );
}

function validatePaymentChallenge(
  paymentRequiredHeader: string | null,
  expectedAmountAtomic: number,
  expectation: SupportedExecutionTarget
) {
  const challenge = decodePaymentRequired(paymentRequiredHeader);
  if (!challenge || challenge.x402Version !== 2 || !Array.isArray(challenge.accepts)) {
    throw new Error("x402 resource returned an invalid PAYMENT-REQUIRED challenge");
  }

  const requirement = challenge.accepts.find(
    (rawRequirement) =>
      isRecord(rawRequirement) &&
      (rawRequirement as PaymentRequirement).scheme === "exact" &&
      (rawRequirement as PaymentRequirement).network === expectation.network &&
      (rawRequirement as PaymentRequirement).asset === expectation.asset &&
      typeof (rawRequirement as PaymentRequirement).amount === "string"
  ) as PaymentRequirement | undefined;

  if (!requirement || typeof requirement.amount !== "string") {
    throw new Error(
      `x402 resource challenge does not match the policy-authorized network and asset (${expectation.network}, ${expectation.asset})`
    );
  }

  const challengedAmountAtomic = atomicUsdcFromString(requirement.amount);
  if (challengedAmountAtomic === null) {
    throw new Error("x402 resource challenge contains an invalid atomic USDC amount");
  }

  if (challengedAmountAtomic !== expectedAmountAtomic) {
    throw new Error(
      `x402 price changed after policy authorization: approved ${expectedAmountAtomic} atomic USDC, challenge requested ${challengedAmountAtomic}`
    );
  }
}

function extractResourceContent(rawBody: string) {
  const trimmed = rawBody.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "content" in parsed &&
      typeof (parsed as { content?: unknown }).content === "string"
    ) {
      return (parsed as { content: string }).content;
    }

    return JSON.stringify(parsed);
  } catch {
    return trimmed;
  }
}

function extractError(rawBody: string) {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof (parsed as { error?: unknown }).error === "string"
    ) {
      return (parsed as { error: string }).error;
    }
  } catch {
    // Fall back to the HTTP status message below.
  }

  return null;
}

export async function purchaseX402Resource(
  url: string,
  maxAmountAtomic: number,
  expectation: X402PurchaseExpectation = {
    network: SOLANA_DEVNET_NETWORK,
    asset: SOLANA_DEVNET_USDC_MINT,
  }
): Promise<X402SettlementResult> {
  if (!Number.isSafeInteger(maxAmountAtomic) || maxAmountAtomic <= 0) {
    throw new Error("Invalid atomic USDC spend limit");
  }

  const target = resolveExecutionTarget(expectation);
  const payer = assertX402PayerConfigured(target.network);
  const privateKeyBytes = base58.decode(payer.agentPrivateKey);
  const signer = await createKeyPairSignerFromBytes(privateKeyBytes);

  if (payer.agentAddress && signer.address !== payer.agentAddress) {
    throw new Error(
      target.network === SOLANA_MAINNET_NETWORK
        ? "POLICYRAIL_MAINNET_AGENT_ADDRESS does not match POLICYRAIL_MAINNET_AGENT_PRIVATE_KEY."
        : "POLICYRAIL_AGENT_ADDRESS does not match POLICYRAIL_AGENT_PRIVATE_KEY. Run npm run wallet:setup to repair the local configuration."
    );
  }

  const client = new x402Client();
  client.setSpendControls({
    maxAmountPerPayment: formatAtomicUsd(maxAmountAtomic),
  });
  client.register(
    target.network,
    new ExactSvmScheme(signer, { rpcUrl: payer.rpcUrl })
  );

  const guardedFetch: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);

    if (response.status === 402) {
      validatePaymentChallenge(
        response.headers.get("payment-required"),
        maxAmountAtomic,
        target
      );
    }

    return response;
  };

  const fetchWithPayment = wrapFetchWithPayment(guardedFetch, client);
  const response = await fetchWithPayment(url, {
    method: "GET",
    cache: "no-store",
  });
  const rawBody = await response.text();

  if (!response.ok) {
    throw new Error(
      extractError(rawBody) ?? `x402 resource request failed with HTTP ${response.status}`
    );
  }

  const content = extractResourceContent(rawBody);
  if (!content) {
    throw new Error("x402 resource returned no content");
  }

  const settlement = new x402HTTPClient(client).getPaymentSettleResponse((name) =>
    response.headers.get(name)
  );

  if (!settlement?.success || !settlement.transaction) {
    throw new Error("x402 resource responded without a successful settlement receipt");
  }

  if (settlement.network !== target.network) {
    throw new Error(
      `Unexpected x402 settlement network: ${settlement.network}; expected ${target.network}`
    );
  }

  return {
    content,
    transactionSignature: settlement.transaction,
    network: settlement.network,
    payer: settlement.payer ?? null,
  };
}
