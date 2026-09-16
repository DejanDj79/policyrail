import {
  DEMO_RESOURCES,
  type PaidResource,
} from "@/lib/agent/resources";

export type ResourceRegistryKind = "local-demo" | "external";

export interface ResourceRegistryInfo {
  id: string;
  name: string;
  kind: ResourceRegistryKind;
  synthetic: boolean;
  version: string;
}

export interface ResourceRegistry {
  readonly info: ResourceRegistryInfo;
  listResources(): Promise<PaidResource[]>;
  getResourceById(id: string): Promise<PaidResource | undefined>;
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

const localDemoRegistry = new LocalDemoResourceRegistry();

export function getResourceRegistry(): ResourceRegistry {
  return localDemoRegistry;
}

export function toPublicResourceMetadata(resource: PaidResource) {
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
    synthetic: true,
    paymentProtocol: "x402",
    settlementNetwork: "Solana Devnet",
    currency: "USDC",
  };
}
