import { fetchBazaarCatalog } from "@/lib/resources/bazaar-client";
import {
  atomicUsdcFromString,
  atomicUsdcToExactCents,
  formatAtomicUsdc,
} from "@/lib/money/usdc";
import {
  SOLANA_DEVNET_NETWORK,
  SOLANA_DEVNET_USDC_MINT,
  SOLANA_MAINNET_NETWORK,
  SOLANA_MAINNET_USDC_MINT,
} from "@/lib/x402/config";

const SAMPLE_LIMIT = 100;
const DISTRIBUTION_LIMIT = 8;
const MAINNET_RESOURCE_LIMIT = 12;

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

export interface BazaarPreviewResource {
  resource: string;
  provider: string;
  method: "GET";
  amountAtomic: number;
  amountCents: number | null;
  priceUsdc: string;
  description: string;
}

export interface BazaarMainnetPreviewResource {
  resource: string;
  requestUrl: string;
  provider: string;
  method: "GET";
  amountAtomic: number | null;
  priceUsdc: string;
  ledgerCompatible: boolean;
  description: string;
}

export interface BazaarDistributionEntry {
  value: string;
  count: number;
}

export interface BazaarPreviewResult {
  source: string;
  facilitator: string;
  checkedAt: string;
  sampleLimit: number;
  filters: {
    type: "http";
    method: "GET";
    scheme: "exact";
    network: typeof SOLANA_DEVNET_NETWORK;
    asset: typeof SOLANA_DEVNET_USDC_MINT;
    pricing: "positive atomic USDC";
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
    invalidAtomicPrice: number;
  };
  breakdown: {
    paymentOptions: number;
    networks: BazaarDistributionEntry[];
    schemes: BazaarDistributionEntry[];
    assets: BazaarDistributionEntry[];
  };
  solanaMainnet: {
    readOnly: true;
    network: typeof SOLANA_MAINNET_NETWORK;
    asset: typeof SOLANA_MAINNET_USDC_MINT;
    exactUsdcResources: number;
    getResources: number;
    atomicLedgerResources: number;
    invalidAtomicPriceResources: number;
    resources: BazaarMainnetPreviewResource[];
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

function descriptionFor(item: BazaarItem, url: URL) {
  const info = nestedRecord(item.extensions, "bazaar", "info");
  const input = info && isRecord(info.input) ? info.input : null;

  return (
    stringValue(input?.description) ??
    stringValue(info?.description) ??
    `x402 HTTP resource at ${url.hostname}${url.pathname}`
  );
}

function inputFor(item: BazaarItem) {
  const info = nestedRecord(item.extensions, "bazaar", "info");
  return info && isRecord(info.input) ? info.input : null;
}

function methodFor(item: BazaarItem) {
  return stringValue(inputFor(item)?.method)?.toUpperCase() ?? "GET";
}

function requestUrlFor(resourceUrl: string, item: BazaarItem) {
  const input = inputFor(item);
  if (!input || !isRecord(input.queryParams)) return resourceUrl;

  try {
    const url = new URL(resourceUrl);
    for (const [key, value] of Object.entries(input.queryParams)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  } catch {
    return resourceUrl;
  }
}

function increment(map: Map<string, number>, value: unknown) {
  const key = stringValue(value) ?? "(missing)";
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topDistribution(map: Map<string, number>): BazaarDistributionEntry[] {
  return Array.from(map.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, DISTRIBUTION_LIMIT);
}

export async function getBazaarPreview(): Promise<BazaarPreviewResult> {
  const catalog = await fetchBazaarCatalog(SAMPLE_LIMIT);
  const items = catalog.items;

  let http = 0;
  let exactDevnetUsdc = 0;
  let get = 0;
  let paymentOptions = 0;
  let mainnetExactUsdcResources = 0;
  let mainnetGetResources = 0;
  let mainnetAtomicLedgerResources = 0;
  let mainnetInvalidAtomicPriceResources = 0;
  const networkCounts = new Map<string, number>();
  const schemeCounts = new Map<string, number>();
  const assetCounts = new Map<string, number>();
  const excluded = {
    invalidOrNonHttp: 0,
    noExactDevnetUsdc: 0,
    unsupportedMethod: 0,
    invalidAtomicPrice: 0,
  };
  const compatible: BazaarPreviewResource[] = [];
  const mainnetResources: BazaarMainnetPreviewResource[] = [];

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

    const method = methodFor(item);
    if (method === "GET") get += 1;

    for (const rawRequirement of item.accepts) {
      if (!isRecord(rawRequirement)) continue;
      const requirement = rawRequirement as BazaarRequirement;
      paymentOptions += 1;
      increment(networkCounts, requirement.network);
      increment(schemeCounts, requirement.scheme);
      increment(assetCounts, requirement.asset);
    }

    const mainnetRequirement = (item.accepts as BazaarRequirement[]).find(
      (candidate) =>
        candidate?.scheme === "exact" &&
        candidate?.network === SOLANA_MAINNET_NETWORK &&
        candidate?.asset === SOLANA_MAINNET_USDC_MINT &&
        typeof candidate?.amount === "string"
    );

    if (mainnetRequirement && typeof mainnetRequirement.amount === "string") {
      mainnetExactUsdcResources += 1;

      if (method === "GET") {
        mainnetGetResources += 1;
        const amountAtomic = atomicUsdcFromString(mainnetRequirement.amount);
        const ledgerCompatible = amountAtomic !== null;

        if (ledgerCompatible) mainnetAtomicLedgerResources += 1;
        else mainnetInvalidAtomicPriceResources += 1;

        mainnetResources.push({
          resource,
          requestUrl: requestUrlFor(resource, item),
          provider: url.hostname,
          method: "GET",
          amountAtomic,
          priceUsdc:
            amountAtomic === null
              ? mainnetRequirement.amount
              : formatAtomicUsdc(amountAtomic),
          ledgerCompatible,
          description: descriptionFor(item, url),
        });
      }
    }

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

    if (method !== "GET") {
      excluded.unsupportedMethod += 1;
      continue;
    }

    const amountAtomic = atomicUsdcFromString(requirement.amount);
    if (amountAtomic === null) {
      excluded.invalidAtomicPrice += 1;
      continue;
    }

    compatible.push({
      resource,
      provider: url.hostname,
      method: "GET",
      amountAtomic,
      amountCents: atomicUsdcToExactCents(amountAtomic),
      priceUsdc: formatAtomicUsdc(amountAtomic),
      description: descriptionFor(item, url),
    });
  }

  const sortedMainnetResources = [...mainnetResources].sort(
    (a, b) => Number(b.ledgerCompatible) - Number(a.ledgerCompatible)
  );

  return {
    source: catalog.source,
    facilitator: catalog.baseUrl,
    checkedAt: new Date().toISOString(),
    sampleLimit: SAMPLE_LIMIT,
    filters: {
      type: "http",
      method: "GET",
      scheme: "exact",
      network: SOLANA_DEVNET_NETWORK,
      asset: SOLANA_DEVNET_USDC_MINT,
      pricing: "positive atomic USDC",
    },
    counts: {
      fetched: items.length,
      http,
      exactDevnetUsdc,
      get,
      compatible: compatible.length,
    },
    excluded,
    breakdown: {
      paymentOptions,
      networks: topDistribution(networkCounts),
      schemes: topDistribution(schemeCounts),
      assets: topDistribution(assetCounts),
    },
    solanaMainnet: {
      readOnly: true,
      network: SOLANA_MAINNET_NETWORK,
      asset: SOLANA_MAINNET_USDC_MINT,
      exactUsdcResources: mainnetExactUsdcResources,
      getResources: mainnetGetResources,
      atomicLedgerResources: mainnetAtomicLedgerResources,
      invalidAtomicPriceResources: mainnetInvalidAtomicPriceResources,
      resources: sortedMainnetResources.slice(0, MAINNET_RESOURCE_LIMIT),
    },
    resources: compatible.slice(0, 12),
  };
}
