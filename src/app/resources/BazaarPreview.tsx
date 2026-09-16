"use client";

import { useEffect, useState } from "react";
import styles from "./bazaar-preview.module.css";

type PreviewResource = {
  resource: string;
  provider: string;
  method: "GET";
  amountCents: number;
  description: string;
};

type PreviewPayload = {
  source?: string;
  facilitator?: string;
  checkedAt?: string;
  sampleLimit?: number;
  counts?: {
    fetched: number;
    http: number;
    exactDevnetUsdc: number;
    get: number;
    compatible: number;
  };
  excluded?: {
    invalidOrNonHttp: number;
    noExactDevnetUsdc: number;
    unsupportedMethod: number;
    subCentOrInvalidPrice: number;
  };
  resources?: PreviewResource[];
  error?: string;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function BazaarPreview() {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/resources/bazaar-preview", {
          cache: "no-store",
        });
        const payload = (await response.json()) as PreviewPayload;

        if (!response.ok || !payload.counts) {
          throw new Error(payload.error ?? "Could not load Bazaar preview.");
        }

        if (!cancelled) setPreview(payload);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load Bazaar preview."
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

  return (
    <section className={styles.preview}>
      <div className={styles.header}>
        <div>
          <div className={styles.kickerRow}>
            <span className={styles.kicker}>LIVE BAZAAR PREVIEW</span>
            <span className={styles.readOnly}>READ ONLY</span>
          </div>
          <h2>See what PolicyRail could discover externally.</h2>
          <p>
            This samples the official x402 Bazaar without adding any external resource to procurement
            and without making a payment.
          </p>
        </div>
        {preview?.checkedAt ? (
          <small>
            {preview.source ?? "x402 Bazaar"} · Checked {new Date(preview.checkedAt).toLocaleTimeString()}
          </small>
        ) : null}
      </div>

      {loading ? <div className={styles.state}>Checking x402 Bazaar…</div> : null}

      {error ? (
        <div className={styles.state}>
          Bazaar preview unavailable: {error} Local demo resources are unaffected.
        </div>
      ) : null}

      {preview?.counts ? (
        <>
          <div className={styles.stats}>
            <div>
              <span>Sampled</span>
              <strong>{preview.counts.fetched}</strong>
            </div>
            <div>
              <span>Devnet exact USDC</span>
              <strong>{preview.counts.exactDevnetUsdc}</strong>
            </div>
            <div>
              <span>GET capable</span>
              <strong>{preview.counts.get}</strong>
            </div>
            <div>
              <span>PolicyRail compatible</span>
              <strong>{preview.counts.compatible}</strong>
            </div>
          </div>

          <div className={styles.filterNote}>
            Current compatibility gate: HTTP · GET · exact · Solana Devnet · USDC · whole-cent price.
            {preview.excluded ? (
              <span>
                Excluded: {preview.excluded.noExactDevnetUsdc} payment mismatch · {preview.excluded.unsupportedMethod} non-GET · {preview.excluded.subCentOrInvalidPrice} sub-cent/invalid price.
              </span>
            ) : null}
          </div>

          {preview.counts.compatible === 0 ? (
            <div className={styles.empty}>
              No sampled Bazaar endpoint currently passes every PolicyRail compatibility gate. Hybrid mode
              stays disabled, while the stable local demo registry continues unchanged.
            </div>
          ) : (
            <div className={styles.resources}>
              {(preview.resources ?? []).map((resource) => (
                <article key={`${resource.provider}-${resource.resource}`}>
                  <div>
                    <span>{resource.provider}</span>
                    <strong>{resource.method} · {money(resource.amountCents)}</strong>
                  </div>
                  <p>{resource.description}</p>
                  <code>{resource.resource}</code>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
