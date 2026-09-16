import { createHash } from "node:crypto";
import {
  DEMO_RESOURCES,
  type PaidResource,
} from "@/lib/agent/resources";
import type { SpendingCategory } from "@/lib/policy/types";
import { SOLANA_DEVNET_NETWORK } from "@/lib/x402/config";

export type ResourceRegistryKind = "local-demo" | "external" | "hybrid";
export type ResourceRegistryMode = "local-demo" | "bazaar" | "hybrid";

export interface RegistryResource extends PaidResource {
  purchaseUrl?: string;
}

export interface ResourceRegistryInfo {
  id: string;
  name: string;
  kind: ResourceRegistryKind;
  synthetic: boolean;
  version: string;
}

export interface ResourceRegistry {
  readonly info: ResourceRegistryInfo;
  listResources(): Promise<RegistryResource[]>;
  getResourceById(id: string): Promise<RegistryResource | undefined>;
}

type BazaarPaymentRequirement = {
  scheme?: unknown;
  network?: unknown;
  amount?: unknown;
  asset?: unknown;
  extra?: unknown;
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

function deriveCategory(text: string): SpendingCategory {
  const normalized = text.toLowerCase();
  if (/\b(search|query|lookup|find)\b/.test(normalized)) return "search";
  if (/\b(inference|llm|model|embedding|ai)\b/.test(normalized)) return "inference";
  if (/\b(compute|render|gpu|cpu|simulation)\b/.test(normalized)) return "compute";
  return "data";
}

function centsFromAtomicUsdc(amount: string) {
  try {
    const atomic = BigInt(amount);
    if (atomic <= 0n) return null;
    const cents = (atomic + 9_999n) / 10_000n;
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Math.max(1, Number(cents));
  } catch {
    return null;
  }
}

function stableResourceId(resourceUrl: string) {
  return `bazaar-${createHash("sha256").update(resourceUrl).digest("hex").slice(0, 12)}`;
}

function addExampleQueryParams(resourceUrl: string, input: Record<string, unknown> | null) {
  if (!input || !isRecord(input.queryParams)) return resourceUrl;

  try {
    const url = new URL(resourceUrl);
    for (const [key, value] of Object.entries(input.queryParams)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  } catch {
    return resourceUrl;
  }
}

function mapBazaarItem(item: BazaarItem): RegistryResource | null {
  const resourceUrl = stringValue(item.resource);
  if (!resourceUrl || item.type !== "http" || !Array.isArray(item.accepts)) return null;

  let url: URL;
  try {
    url = new URL(resourceUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const requirement = (item.accepts as BazaarPaymentRequirement[]).find(
    (candidate) =>
      candidate?.scheme === "exact" &&
      candidate?.network === SOLANA_DEVNET_NETWORK &&
      typeof candidate?.amount === "string"
  );

  if (!requirement || typeof requirement.amount !== "string") return null;

  const amountCents = centsFromAtomicUsdc(requirement.amount);
  if (amountCents === null) return null;

  const bazaarInfo = nestedRecord(item.extensions, "bazaar", "info");
  const input = bazaarInfo && isRecord(bazaarInfo.input) ? bazaarInfo.input : null;
  const method = stringValue(input?.method)?.toUpperCase() ?? "GET";

  // PolicyRail's current x402 buyer performs GET requests. Other methods can be
  // surfaced once request-body/schema execution is added.
  if (method !== "GET") return null;

  const description =
    stringValue(input?.description) ??
    stringValue(bazaarInfo?.description) ??
    `x402 HTTP resource discovered through Bazaar at ${url.hostname}${url.pathname}.`;
  const provider = url.hostname;
  const pathName = url.pathname.split("/").filter(Boolean).slice(-2).join(" / ");
  const displayName = pathName || provider;
  const tags = ["x402", "bazaar", provider].slice(0, 5);
  const purchaseUrl = addExampleQueryParams(resourceUrl, input);

  return {
    id: stableResourceId(resourceUrl),
    name: displayName,
    provider,
    resource: resourceUrl,
    domain: "x402 Bazaar",
    tags,
    category: deriveCategory(`${displayName} ${description}`),
    amountCents,
    qualityScore: 70,
    description,
    content: "",
    purchaseUrl,
  };
}

class LocalDemoResourceRegistry implements ResourceRegistry {
  readonly info: ResourceRegistryInfo = {
    id: "policyrail-local-demo",
    name: "PolicyRail Local Demo Registry",
    kind: "local-demo",
    synthetic: true,
    version: "synthetic-v2",
  };

  async listResources() {
    return DEMO_RESOURCES;
  }

  async getResourceById(id: string) {
    return DEMO_RESOURCES.find((resource) => resource.id === id);
  }
}

class BazaarResourceRegistry implements ResourceRegistry {
  readonly info: ResourceRegistryInfo = {
    id: "x402-bazaar",
    name: "x402 Bazaar",
    kind: "external",
    synthetic: false,
    version: "x402-v2",
  };

  private async fetchResources() {
    const facilitatorUrl =
      process.env.POLICYRAIL_BAZAAR_URL ??
      process.env.X402_FACILITATOR_URL ??
      "https://x402.org/facilitator";
    const endpoint = new URL(`${facilitatorUrl.replace(/\/$/, "")}/discovery/resources`);
    endpoint.searchParams.set("type", "http");
    endpoint.searchParams.set("scheme", "exact");
    endpoint.searchParams.set("network", SOLANA_DEVNET_NETWORK);
    endpoint.searchParams.set("limit", "100");

    const response = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });

    if (!response.ok) {
      throw new Error(`x402 Bazaar discovery failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as BazaarResponse;
    if (!Array.isArray(payload.items)) return [];

    return payload.items
      .map((item) => (isRecord(item) ? mapBazaarItem(item as BazaarItem) : null))
      .filter((resource): resource is RegistryResource => resource !== null);
  }

  async listResources() {
    return this.fetchResources();
  }

  async getResourceById(id: string) {
    const resources = await this.fetchResources();
    return resources.find((resource) => resource.id === id);
  }
}

class HybridResourceRegistry implements ResourceRegistry {
  readonly info: ResourceRegistryInfo = {
    id: "policyrail-hybrid",
    name: "PolicyRail + x402 Bazaar",
    kind: "hybrid",
    synthetic: false,
    version: "synthetic-v2+x402-v2",
  };

  constructor(
    private readonly local: ResourceRegistry,
    private readonly external: ResourceRegistry
  ) {}

  async listResources() {
    const localResources = await this.local.listResources();

    try {
      const externalResources = await this.external.listResources();
      const seen = new Set(localResources.map((resource) => resource.id));
      return [
        ...localResources,
        ...externalResources.filter((resource) => !seen.has(resource.id)),
      ];
    } catch {
      // The hackathon demo remains usable even if the external discovery service is unavailable.
      return localResources;
    }
  }

  async getResourceById(id: string) {
    const localResource = await this.local.getResourceById(id);
    if (localResource) return localResource;

    try {
      return await this.external.getResourceById(id);
    } catch {
      return undefined;
    }
  }
}

const localDemoRegistry = new LocalDemoResourceRegistry();
const bazaarRegistry = new BazaarResourceRegistry();
const hybridRegistry = new HybridResourceRegistry(localDemoRegistry, bazaarRegistry);

function registryMode(): ResourceRegistryMode {
  const value = process.env.POLICYRAIL_RESOURCE_REGISTRY_MODE;
  if (value === "bazaar" || value === "hybrid") return value;
  return "local-demo";
}

export function getResourceRegistry(): ResourceRegistry {
  const mode = registryMode();
  if (mode === "bazaar") return bazaarRegistry;
  if (mode === "hybrid") return hybridRegistry;
  return localDemoRegistry;
}

export function toPublicResourceMetadata(resource: RegistryResource) {
  return {
    id: resource.id,
    name: resource.name,
    provider: resource.provider,
    resource: resource.resource,
    domain: resource.domain,
    tags: resource.tags,
    category: resource.category,
    amountCents: resource.amountCents,
    qualityScore: resource.qualityScore,
    description: resource.description,
    synthetic: !resource.purchaseUrl,
    paymentProtocol: "x402",
    settlementNetwork: "Solana Devnet",
    currency: "USDC",
    purchaseTarget: resource.purchaseUrl ? "external" : "policyrail-proxy",
  };
}
