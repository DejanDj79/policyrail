import { X402_FACILITATOR_URL } from "@/lib/x402/config";

const CDP_BAZAAR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

export interface BazaarCatalogResult {
  source: string;
  baseUrl: string;
  endpoint: string;
  items: unknown[];
}

type BazaarPayload = {
  items?: unknown;
  resources?: unknown;
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}

function discoveryEndpoint(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (normalized.endsWith("/discovery/resources")) return normalized;
  return `${normalized}/discovery/resources`;
}

function discoverySources() {
  const configured = process.env.POLICYRAIL_BAZAAR_URL?.trim();
  const candidates = [
    configured ? { source: "Configured Bazaar", baseUrl: configured } : null,
    { source: "CDP x402 Bazaar", baseUrl: CDP_BAZAAR_URL },
    { source: "x402.org test Bazaar", baseUrl: X402_FACILITATOR_URL },
  ].filter((candidate): candidate is { source: string; baseUrl: string } => Boolean(candidate));

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const normalized = normalizeBaseUrl(candidate.baseUrl);
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export async function fetchBazaarCatalog(limit = 100): Promise<BazaarCatalogResult> {
  const failures: string[] = [];

  for (const candidate of discoverySources()) {
    const endpoint = new URL(discoveryEndpoint(candidate.baseUrl));
    endpoint.searchParams.set("type", "http");
    endpoint.searchParams.set("limit", String(limit));

    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        failures.push(`${candidate.source}: HTTP ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as BazaarPayload;
      const items = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.resources)
          ? payload.resources
          : null;

      if (!items) {
        failures.push(`${candidate.source}: invalid discovery payload`);
        continue;
      }

      return {
        source: candidate.source,
        baseUrl: normalizeBaseUrl(candidate.baseUrl),
        endpoint: endpoint.toString(),
        items,
      };
    } catch (error) {
      failures.push(
        `${candidate.source}: ${error instanceof Error ? error.message : "request failed"}`
      );
    }
  }

  throw new Error(`Bazaar discovery unavailable (${failures.join("; ")})`);
}
