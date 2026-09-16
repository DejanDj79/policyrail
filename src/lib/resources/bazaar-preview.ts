import {
  SOLANA_DEVNET_NETWORK,
  SOLANA_DEVNET_USDC_MINT,
  X402_FACILITATOR_URL,
} from "@/lib/x402/config";

const SAMPLE_LIMIT = 100;
const ATOMIC_USDC_PER_CENT = BigInt(10_000);

type BazaarRequirement = {
  scheme?: unknown;
  network?: unknown;
  amount?: unknown;
  asset?: unknown;
};

type BazaarItem = {
  resource?: unknown;
  type?: unknown;
  accepts?: unknown;
  extensions?: unknown;
};

type BazaarResponse = {
  items?: unknown;
};

export interface BazaarPreviewResource {
  resource: string;
  provider: string;
  method: "GET";
  amountCents: number;
  description: string;
}

export interface BazaarPreviewResult {
  source: "x402 Bazaar";
  facilitator: string;
  checkedAt: string;
  sampleLimit: number;
  filters: {
    type: "http";
    method: "GET";
    scheme: "exact";
    network: typeof SOLANA_DEVNET_NETWORK;
    asset: typeof SOLANA_DEVNET_USDC_MINT;
    pricing: "whole-cent USDC only";
  };
  counts: {
    fetched: number;
    http: number;
    exactDevnetUsdc: number;
    get: number;
    compatible: number;
  };
  excluded: {
    invalidOrNonHttp: number;
    noExactDevnetUsdc: number;
    unsupportedMethod: number;
    subCentOrInvalidPrice: number;
  };
  resources: BazaarPreviewResource[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nestedRecord(value: unknown, ...keys: string[]) {
  let current: unknown = value;

  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }

  return isRecord(current) ? current : null;
}

function wholeCentsFromAtomicUsdc(amount: string) {
  try {
    const atomic = BigInt(amount);
    if (atomic <= BigInt(0) || atomic % ATOMIC_USDC_PER_CENT !== BigInt(0)) {
      return null;
    }

    const cents = atomic / ATOMIC_USDC_PER_CENT;
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(cents);
  } catch {
    return null;
  }
}

function descriptionFor(item: BazaarItem, url: URL) {
  const info = nestedRecord(item.extensions, "bazaar", "info");
  const input = info && isRecord(info.input) ? info.input : null;

  return (
    stringValue(input?.description) ??
    stringValue(info?.description) ??
    `x402 HTTP resource at ${url.hostname}${url.pathname}`
  );
}

function methodFor(item: BazaarItem) {
  const info = nestedRecord(item.extensions, "bazaar", "info");
  const input = info && isRecord(info.input) ? info.input : null;
  return stringValue(input?.method)?.toUpperCase() ?? "GET";
}

export async function getBazaarPreview(): Promise<BazaarPreviewResult> {
  const facilitator =
    process.env.POLICYRAIL_BAZAAR_URL ?? X402_FACILITATOR_URL;
  const endpoint = new URL(`${facilitator.replace(/\/$/, "")}/discovery/resources`);
  endpoint.searchParams.set("type", "http");
  endpoint.searchParams.set("limit", String(SAMPLE_LIMIT));

  const response = await fetch(endpoint, {
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });

  if (!response.ok) {
    throw new Error(`x402 Bazaar preview failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as BazaarResponse;
  const items = Array.isArray(payload.items) ? payload.items : [];

  let http = 0;
  let exactDevnetUsdc = 0;
  let get = 0;
  const excluded = {
    invalidOrNonHttp: 0,
    noExactDevnetUsdc: 0,
    unsupportedMethod: 0,
    subCentOrInvalidPrice: 0,
  };
  const compatible: BazaarPreviewResource[] = [];

  for (const rawItem of items) {
    if (!isRecord(rawItem)) {
      excluded.invalidOrNonHttp += 1;
      continue;
    }

    const item = rawItem as BazaarItem;
    const resource = stringValue(item.resource);

    if (!resource || item.type !== "http" || !Array.isArray(item.accepts)) {
      excluded.invalidOrNonHttp += 1;
      continue;
    }

    let url: URL;
    try {
      url = new URL(resource);
    } catch {
      excluded.invalidOrNonHttp += 1;
      continue;
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      excluded.invalidOrNonHttp += 1;
      continue;
    }

    http += 1;

    const requirement = (item.accepts as BazaarRequirement[]).find(
      (candidate) =>
        candidate?.scheme === "exact" &&
        candidate?.network === SOLANA_DEVNET_NETWORK &&
        candidate?.asset === SOLANA_DEVNET_USDC_MINT &&
        typeof candidate?.amount === "string"
    );

    if (!requirement || typeof requirement.amount !== "string") {
      excluded.noExactDevnetUsdc += 1;
      continue;
    }

    exactDevnetUsdc += 1;

    const method = methodFor(item);
    if (method !== "GET") {
      excluded.unsupportedMethod += 1;
      continue;
    }

    get += 1;

    const amountCents = wholeCentsFromAtomicUsdc(requirement.amount);
    if (amountCents === null) {
      excluded.subCentOrInvalidPrice += 1;
      continue;
    }

    compatible.push({
      resource,
      provider: url.hostname,
      method: "GET",
      amountCents,
      description: descriptionFor(item, url),
    });
  }

  return {
    source: "x402 Bazaar",
    facilitator,
    checkedAt: new Date().toISOString(),
    sampleLimit: SAMPLE_LIMIT,
    filters: {
      type: "http",
      method: "GET",
      scheme: "exact",
      network: SOLANA_DEVNET_NETWORK,
      asset: SOLANA_DEVNET_USDC_MINT,
      pricing: "whole-cent USDC only",
    },
    counts: {
      fetched: items.length,
      http,
      exactDevnetUsdc,
      get,
      compatible: compatible.length,
    },
    excluded,
    resources: compatible.slice(0, 12),
  };
}
