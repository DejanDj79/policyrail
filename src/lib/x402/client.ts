import { base58 } from "@scure/base";
import { createKeyPairSignerFromBytes } from "@solana/kit";
import {
  wrapFetchWithPayment,
  x402Client,
  x402HTTPClient,
} from "@x402/fetch";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import {
  assertX402ClientConfigured,
  SOLANA_DEVNET_NETWORK,
} from "@/lib/x402/config";

export interface X402SettlementResult {
  content: string;
  transactionSignature: string;
  network: string;
  payer: string | null;
}

function dollarsFromCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
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
  maxAmountCents: number
): Promise<X402SettlementResult> {
  const config = assertX402ClientConfigured();
  const privateKeyBytes = base58.decode(config.agentPrivateKey);
  const signer = await createKeyPairSignerFromBytes(privateKeyBytes);

  if (config.agentAddress && signer.address !== config.agentAddress) {
    throw new Error(
      "POLICYRAIL_AGENT_ADDRESS does not match POLICYRAIL_AGENT_PRIVATE_KEY. Run npm run wallet:setup to repair the local configuration."
    );
  }

  const client = new x402Client();
  client.setSpendControls({
    maxAmountPerPayment: dollarsFromCents(maxAmountCents),
  });
  client.register(
    SOLANA_DEVNET_NETWORK,
    new ExactSvmScheme(signer, { rpcUrl: config.rpcUrl })
  );

  const fetchWithPayment = wrapFetchWithPayment(fetch, client);
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

  if (settlement.network !== SOLANA_DEVNET_NETWORK) {
    throw new Error(`Unexpected x402 settlement network: ${settlement.network}`);
  }

  return {
    content,
    transactionSignature: settlement.transaction,
    network: settlement.network,
    payer: settlement.payer ?? null,
  };
}
