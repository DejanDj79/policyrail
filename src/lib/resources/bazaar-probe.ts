import { getBazaarPreview } from "@/lib/resources/bazaar-preview";
import {
  SOLANA_MAINNET_NETWORK,
  SOLANA_MAINNET_USDC_MINT,
} from "@/lib/x402/config";

const PROBE_TIMEOUT_MS = 6_000;
const PROBE_LIMIT = 12;

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

export type BazaarProbeOutcome =
  | "valid-x402-402"
  | "402-invalid-or-missing-challenge"
  | "unprotected-success"
  | "unexpected-http-status"
  | "request-failed";

export interface BazaarProbeResult {
  resource: string;
  requestUrl: string;
  provider: string;
  priceUsdc: string;
  status: number | null;
  outcome: BazaarProbeOutcome;
  hasPaymentRequiredHeader: boolean;
  x402Version: number | null;
  challengeAcceptsMainnetUsdc: boolean;
  acceptsCount: number;
  detail: string;
}

export interface BazaarDryRunResult {
  readOnly: true;
  paymentSignatureSent: false;
  network: typeof SOLANA_MAINNET_NETWORK;
  asset: typeof SOLANA_MAINNET_USDC_MINT;
  checkedAt: string;
  candidates: number;
  validChallenges: number;
  results: BazaarProbeResult[];
}

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

function inspectChallenge(challenge: PaymentRequired | null) {
  const accepts = challenge && Array.isArray(challenge.accepts) ? challenge.accepts : [];
  const acceptsMainnetUsdc = accepts.some(
    (rawRequirement) =>
      isRecord(rawRequirement) &&
      (rawRequirement as PaymentRequirement).scheme === "exact" &&
      (rawRequirement as PaymentRequirement).network === SOLANA_MAINNET_NETWORK &&
      (rawRequirement as PaymentRequirement).asset === SOLANA_MAINNET_USDC_MINT &&
      typeof (rawRequirement as PaymentRequirement).amount === "string"
  );

  return {
    x402Version:
      typeof challenge?.x402Version === "number" ? challenge.x402Version : null,
    acceptsCount: accepts.length,
    acceptsMainnetUsdc,
  };
}

async function probeCandidate(candidate: {
  resource: string;
  requestUrl: string;
  provider: string;
  priceUsdc: string;
}): Promise<BazaarProbeResult> {
  try {
    const response = await fetch(candidate.requestUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": "PolicyRail-Bazaar-DryRun/1.0",
      },
    });

    const paymentRequiredHeader = response.headers.get("payment-required");
    const challenge = decodePaymentRequired(paymentRequiredHeader);
    const inspected = inspectChallenge(challenge);

    if (
      response.status === 402 &&
      paymentRequiredHeader &&
      inspected.x402Version === 2 &&
      inspected.acceptsMainnetUsdc
    ) {
      return {
        ...candidate,
        status: response.status,
        outcome: "valid-x402-402",
        hasPaymentRequiredHeader: true,
        x402Version: inspected.x402Version,
        challengeAcceptsMainnetUsdc: true,
        acceptsCount: inspected.acceptsCount,
        detail: "Valid x402 v2 payment challenge returned without sending payment authorization.",
      };
    }

    if (response.status === 402) {
      return {
        ...candidate,
        status: response.status,
        outcome: "402-invalid-or-missing-challenge",
        hasPaymentRequiredHeader: Boolean(paymentRequiredHeader),
        x402Version: inspected.x402Version,
        challengeAcceptsMainnetUsdc: inspected.acceptsMainnetUsdc,
        acceptsCount: inspected.acceptsCount,
        detail: paymentRequiredHeader
          ? "HTTP 402 returned, but the PAYMENT-REQUIRED challenge did not match PolicyRail's expected x402 v2 Solana mainnet USDC requirement."
          : "HTTP 402 returned without the canonical PAYMENT-REQUIRED header.",
      };
    }

    if (response.ok) {
      return {
        ...candidate,
        status: response.status,
        outcome: "unprotected-success",
        hasPaymentRequiredHeader: Boolean(paymentRequiredHeader),
        x402Version: inspected.x402Version,
        challengeAcceptsMainnetUsdc: inspected.acceptsMainnetUsdc,
        acceptsCount: inspected.acceptsCount,
        detail: "Endpoint returned success without requiring an x402 payment challenge.",
      };
    }

    return {
      ...candidate,
      status: response.status,
      outcome: "unexpected-http-status",
      hasPaymentRequiredHeader: Boolean(paymentRequiredHeader),
      x402Version: inspected.x402Version,
      challengeAcceptsMainnetUsdc: inspected.acceptsMainnetUsdc,
      acceptsCount: inspected.acceptsCount,
      detail: `Endpoint returned HTTP ${response.status} before a valid x402 payment challenge was observed.`,
    };
  } catch (error) {
    return {
      ...candidate,
      status: null,
      outcome: "request-failed",
      hasPaymentRequiredHeader: false,
      x402Version: null,
      challengeAcceptsMainnetUsdc: false,
      acceptsCount: 0,
      detail: error instanceof Error ? error.message : "Dry-run request failed.",
    };
  }
}

export async function runBazaarDryRun(): Promise<BazaarDryRunResult> {
  const preview = await getBazaarPreview();
  const candidates = preview.solanaMainnet.resources
    .filter((resource) => resource.ledgerCompatible)
    .slice(0, PROBE_LIMIT);

  const results = await Promise.all(candidates.map(probeCandidate));

  return {
    readOnly: true,
    paymentSignatureSent: false,
    network: SOLANA_MAINNET_NETWORK,
    asset: SOLANA_MAINNET_USDC_MINT,
    checkedAt: new Date().toISOString(),
    candidates: candidates.length,
    validChallenges: results.filter((result) => result.outcome === "valid-x402-402").length,
    results,
  };
}
