"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./resources.module.css";

type Resource = {
  id: string;
  name: string;
  provider: string;
  resource: string;
  domain: string;
  tags: string[];
  category: string;
  amountCents: number;
  qualityScore: number;
  description: string;
  synthetic: boolean;
  paymentProtocol: string;
  settlementNetwork: string;
  currency: string;
  purchaseTarget: "external" | "policyrail-proxy";
};

type RegistryInfo = {
  id: string;
  name: string;
  kind: "local-demo" | "external";
  synthetic: boolean;
  version: string;
};

type ResourcePayload = {
  catalog?: string;
  catalogVersion?: string;
  registry?: RegistryInfo;
  resources?: Resource[];
  error?: string;
};

type SortMode = "quality" | "price-low" | "price-high";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [registry, setRegistry] = useState<RegistryInfo | null>(null);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [category, setCategory] = useState("all");
  const [maxPrice, setMaxPrice] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("quality");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/resources", { cache: "no-store" });
        const payload = (await response.json()) as ResourcePayload;

        if (!response.ok || !payload.resources) {
          throw new Error(payload.error ?? "Could not load the resource directory.");
        }

        if (!cancelled) {
          setResources(payload.resources);
          setRegistry(payload.registry ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load the resource directory."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const domains = useMemo(
    () => Array.from(new Set(resources.map((resource) => resource.domain))).sort(),
    [resources]
  );

  const categories = useMemo(
    () => Array.from(new Set(resources.map((resource) => resource.category))).sort(),
    [resources]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const priceLimit = maxPrice === "all" ? null : Number(maxPrice);

    const result = resources.filter((resource) => {
      const matchesQuery =
        !normalizedQuery ||
        resource.name.toLowerCase().includes(normalizedQuery) ||
        resource.provider.toLowerCase().includes(normalizedQuery) ||
        resource.domain.toLowerCase().includes(normalizedQuery) ||
        resource.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
        resource.description.toLowerCase().includes(normalizedQuery);
      const matchesDomain = domain === "all" || resource.domain === domain;
      const matchesCategory = category === "all" || resource.category === category;
      const matchesPrice = priceLimit === null || resource.amountCents <= priceLimit;

      return matchesQuery && matchesDomain && matchesCategory && matchesPrice;
    });

    return [...result].sort((a, b) => {
      if (sortMode === "price-low") return a.amountCents - b.amountCents;
      if (sortMode === "price-high") return b.amountCents - a.amountCents;
      return b.qualityScore - a.qualityScore;
    });
  }, [resources, query, domain, category, maxPrice, sortMode]);

  const lowestPrice = resources.length
    ? Math.min(...resources.map((resource) => resource.amountCents))
    : 0;
  const highestPrice = resources.length
    ? Math.max(...resources.map((resource) => resource.amountCents))
    : 0;

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/dashboard">
          <span className={styles.mark}>P</span>
          PolicyRail
        </Link>
        <div className={styles.navLinks}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/tasks/new">New task</Link>
          <Link className={styles.active} href="/resources">Resources</Link>
          <Link href="/activity">Activity</Link>
          <Link href="/policy">Agent policy</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>RESOURCE DIRECTORY</p>
          <h1>Know what the agent can discover and buy.</h1>
          <p>
            Task-aware discovery searches this directory first. Only relevant resources move into the
            procurement flow, where PolicyRail evaluates every proposed payment.
          </p>
        </div>
        <Link className={styles.primaryAction} href="/tasks/new">
          Create task
        </Link>
      </section>

      <section className={styles.stats}>
        <div>
          <span>Available resources</span>
          <strong>{resources.length}</strong>
        </div>
        <div>
          <span>Domains</span>
          <strong>{domains.length}</strong>
        </div>
        <div>
          <span>Price range</span>
          <strong>
            {money(lowestPrice)}–{money(highestPrice)}
          </strong>
        </div>
        <div>
          <span>Settlement</span>
          <strong>x402 / USDC</strong>
        </div>
      </section>

      <section className={styles.disclosure}>
        <div>
          <span className={styles.syntheticBadge}>
            {registry?.kind === "external" ? "EXTERNAL REGISTRY" : "LOCAL DEMO REGISTRY"}
          </span>
          <strong>{registry?.name ?? "PolicyRail Resource Registry"}</strong>
        </div>
        <p>
          The directory is now served through the ResourceRegistry layer. Current entries remain synthetic
          for a reliable hackathon demo; discovery, policy authorization, x402 payment handling, Solana
          Devnet settlement and audit records are real.
        </p>
      </section>

      <section className={styles.filters}>
        <input
          type="search"
          value={query}
          placeholder="Search provider, resource, domain or capability…"
          onChange={(event) => setQuery(event.target.value)}
        />

        <select value={domain} onChange={(event) => setDomain(event.target.value)}>
          <option value="all">All domains</option>
          {domains.map((item) => (
            <option value={item} key={item}>{item}</option>
          ))}
        </select>

        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option value={item} key={item}>
              {item[0]?.toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>

        <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
          <option value="all">Any price</option>
          <option value="5">Up to $0.05</option>
          <option value="10">Up to $0.10</option>
          <option value="25">Up to $0.25</option>
        </select>

        <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
          <option value="quality">Highest quality</option>
          <option value="price-low">Lowest price</option>
          <option value="price-high">Highest price</option>
        </select>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? (
        <div className={styles.loading}>Loading resource catalog…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>No resources match the selected filters.</div>
      ) : (
        <section className={styles.grid}>
          {filtered.map((resource) => (
            <article className={styles.card} key={resource.id}>
              <div className={styles.cardTop}>
                <div>
                  <span className={styles.provider}>{resource.provider}</span>
                  <h2>{resource.name}</h2>
                </div>
                <strong className={styles.price}>{money(resource.amountCents)}</strong>
              </div>

              <p className={styles.description}>{resource.description}</p>

              <div className={styles.tags}>
                <span>{resource.domain}</span>
                <span>{resource.category}</span>
                {resource.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
              </div>

              <div className={styles.qualityRow}>
                <div>
                  <span>Quality score</span>
                  <strong>{resource.qualityScore}/100</strong>
                </div>
                <div className={styles.qualityTrack}>
                  <span style={{ width: `${resource.qualityScore}%` }} />
                </div>
              </div>

              <div className={styles.cardFooter}>
                <div>
                  <span>Resource ID</span>
                  <code>{resource.id}</code>
                </div>
                <span className={styles.available}>
                  {resource.purchaseTarget === "external" ? "EXTERNAL x402" : "x402 READY"}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className={styles.nextStep}>
        <div>
          <p className={styles.eyebrow}>TASK-AWARE DISCOVERY</p>
          <h2>One registry. Different resources for different tasks.</h2>
          <p>
            Inference research discovers only inference resources, while travel tasks discover hotel
            inventory, review and location data. The same discovery and policy flow can now consume future
            registry adapters without changing the procurement engine.
          </p>
        </div>
        <Link href="/tasks/new">Run a discovery task →</Link>
      </section>
    </main>
  );
}
