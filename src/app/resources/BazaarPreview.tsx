"use client";

import { useEffect, useState } from "react";
import probeLayout from "./bazaar-probe-layout.module.css";
import styles from "./bazaar-preview.module.css";

type PreviewResource = {
  resource: string;
  provider: string;
  method: "GET";
  amountAtomic: number;
  amountCents: number | null;
  priceUsdc: string;
  description: string;
};

type MainnetPreviewResource = {
  resource: string;
  requestUrl: string;
  provider: string;
  method: "GET";
  amountAtomic: number | null;
  priceUsdc: string;
  ledgerCompatible: boolean;
  description: string;
};

type DistributionEntry = {
  value: string;
  count: number;
};

type ProbeOutcome =
  | "valid-x402-402"
  | "402-invalid-or-missing-challenge"
  | "unprotected-success"
  | "unexpected-http-status"
  | "request-failed";

type ProbeResult = {
  resource: string;
  requestUrl: string;
  provider: string;
  priceUsdc: string;
  status: number | null;
  outcome: ProbeOutcome;
  hasPaymentRequiredHeader: boolean;
  x402Version: number | null;
  challengeAcceptsMainnetUsdc: boolean;
  acceptsCount: number;
  detail: string;
};

type ProbePayload = {
  readOnly?: boolean;
  paymentSignatureSent?: boolean;
  checkedAt?: string;
  candidates?: number;
  validChallenges?: number;
  results?: ProbeResult[];
  error?: string;
};

type PreviewPayload = {
  source?: string;
  facilitator?: string;
  checkedAt?: string;
  sampleLimit?: number;
  execution?: {
    registryMode: "local-demo" | "bazaar" | "hybrid";
    externalRegistrySelected: boolean;
    x402Enabled: boolean;
    externalExecutionEnabled: boolean;
    mainnetExecutionEnabled: boolean;
    devnetExecutableResources: number;
    mainnetExecutableResources: number;
  };
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
    invalidAtomicPrice: number;
  };
  breakdown?: {
    paymentOptions: number;
    networks: DistributionEntry[];
    schemes: DistributionEntry[];
    assets: DistributionEntry[];
  };
  solanaMainnet?: {
    readOnly: true;
    network: string;
    asset: string;
    exactUsdcResources: number;
    getResources: number;
    atomicLedgerResources: number;
    invalidAtomicPriceResources: number;
    resources: MainnetPreviewResource[];
  };
  resources?: PreviewResource[];
  error?: string;
};

function compactIdentifier(value: string) {
  if (value === "(missing)" || value.length <= 34) return value;
  return `${value.slice(0, 16)}…${value.slice(-12)}`;
}

function probeLabel(outcome: ProbeOutcome) {
  switch (outcome) {
    case "valid-x402-402":
      return "VALID x402 402";
    case "402-invalid-or-missing-challenge":
      return "402 / CHALLENGE MISMATCH";
    case "unprotected-success":
      return "NO PAYMENT REQUIRED";
    case "unexpected-http-status":
      return "UNEXPECTED STATUS";
    case "request-failed":
      return "REQUEST FAILED";
  }
}

function enabledLabel(value: boolean) {
  return value ? "ON" : "OFF";
}

function DistributionList({
  title,
  entries,
}: {
  title: string;
  entries: DistributionEntry[];
}) {
  return (
    <div className={styles.distributionColumn}>
      <span className={styles.distributionTitle}>{title}</span>
      {entries.length === 0 ? (
        <div className={styles.distributionEmpty}>No advertised values</div>
      ) : (
        <div className={styles.distributionList}>
          {entries.map((entry) => (
            <div key={`${title}-${entry.value}`}>
              <code title={entry.value}>{compactIdentifier(entry.value)}</code>
              <strong>{entry.count}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BazaarPreview() {
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [probe, setProbe] = useState<ProbePayload | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeModalOpen, setProbeModalOpen] = useState(false);

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

  useEffect(() => {
    if (!probeModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProbeModalOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [probeModalOpen]);

  async function runDryRunProbe() {
    setProbeLoading(true);
    setProbeError(null);
    setProbeModalOpen(false);

    try {
      const response = await fetch("/api/resources/bazaar-probe", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ProbePayload;

      if (!response.ok || !payload.results) {
        throw new Error(payload.error ?? "Could not run the Bazaar dry-run probe.");
      }

      setProbe(payload);
    } catch (probeFailure) {
      setProbeError(
        probeFailure instanceof Error
          ? probeFailure.message
          : "Could not run the Bazaar dry-run probe."
      );
    } finally {
      setProbeLoading(false);
    }
  }

  return (
    <>
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

            {preview.execution ? (
              <>
                <div className={styles.mainnetStats}>
                  <div>
                    <span>Registry mode</span>
                    <strong>{preview.execution.registryMode}</strong>
                  </div>
                  <div>
                    <span>x402 payments</span>
                    <strong>{enabledLabel(preview.execution.x402Enabled)}</strong>
                  </div>
                  <div>
                    <span>External execution</span>
                    <strong>{enabledLabel(preview.execution.externalExecutionEnabled)}</strong>
                  </div>
                  <div>
                    <span>Mainnet execution</span>
                    <strong>{enabledLabel(preview.execution.mainnetExecutionEnabled)}</strong>
                  </div>
                </div>
                <div className={styles.filterNote}>
                  Executable under the current server configuration: Devnet {preview.execution.devnetExecutableResources} · Mainnet {preview.execution.mainnetExecutableResources}.
                  Preview and dry-run probes stay read-only regardless of these execution gates.
                </div>
              </>
            ) : null}

            <div className={styles.filterNote}>
              Current Devnet compatibility gate: HTTP · GET · exact · Solana Devnet · USDC · positive atomic price.
              Fractional-cent USDC is supported by the PolicyRail ledger.
              {preview.excluded ? (
                <span>
                  Payment mismatch: {preview.excluded.noExactDevnetUsdc} · matched-payment non-GET: {preview.excluded.unsupportedMethod} · invalid atomic price: {preview.excluded.invalidAtomicPrice}.
                </span>
              ) : null}
            </div>

            {preview.solanaMainnet ? (
              <>
                <div className={`${styles.probePanel} ${probeLayout.probePanel}`}>
                  <div>
                    <span>LIVE x402 HANDSHAKE CHECK</span>
                    <strong>Probe compatible Bazaar candidates without paying.</strong>
                    <p>
                      Plain GET requests only. No payment signature, wallet signing or settlement is performed.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${styles.probeButton} ${probeLayout.probeButton}`}
                    onClick={runDryRunProbe}
                    disabled={probeLoading || preview.solanaMainnet.atomicLedgerResources === 0}
                  >
                    {probeLoading ? "Running probes…" : "Run dry-run probes"}
                  </button>
                </div>

                {probeError ? <div className={styles.probeError}>{probeError}</div> : null}

                {probe?.results ? (
                  <section className={styles.probeResults}>
                    <div className={styles.probeSummary}>
                      <div>
                        <span>Probed</span>
                        <strong>{probe.candidates ?? probe.results.length}</strong>
                      </div>
                      <div>
                        <span>Valid x402 challenges</span>
                        <strong>{probe.validChallenges ?? 0}</strong>
                      </div>
                      <div>
                        <span>Payment signatures sent</span>
                        <strong>{probe.paymentSignatureSent ? "YES" : "NO"}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.probeDetailsLink}
                      onClick={() => setProbeModalOpen(true)}
                    >
                      View probe details
                    </button>
                  </section>
                ) : null}
              </>
            ) : null}

            {(preview.breakdown || preview.solanaMainnet) ? (
              <details className={styles.advancedDetails}>
                <summary>
                  <span>
                    <strong>Advanced compatibility details</strong>
                    <small>Networks, schemes, assets, mainnet fit and candidate resources</small>
                  </span>
                  <span className={styles.chevron}>⌄</span>
                </summary>

                <div className={styles.advancedBody}>
                  {preview.breakdown ? (
                    <section className={styles.breakdown}>
                      <div className={styles.breakdownHeader}>
                        <div>
                          <span>WHAT THIS SAMPLE ACTUALLY USES</span>
                          <strong>{preview.breakdown.paymentOptions} advertised payment options</strong>
                        </div>
                        <p>
                          Top values across the sampled HTTP resources. One resource can advertise more than one payment option.
                        </p>
                      </div>
                      <div className={styles.distributionGrid}>
                        <DistributionList title="Networks" entries={preview.breakdown.networks} />
                        <DistributionList title="Schemes" entries={preview.breakdown.schemes} />
                        <DistributionList title="Assets" entries={preview.breakdown.assets} />
                      </div>
                    </section>
                  ) : null}

                  {preview.solanaMainnet ? (
                    <section className={styles.mainnetPreview}>
                      <div className={styles.mainnetHeader}>
                        <div>
                          <div className={styles.mainnetKickerRow}>
                            <span>SOLANA MAINNET FIT</span>
                            <strong>READ ONLY</strong>
                          </div>
                          <h3>How much of the live Bazaar fits PolicyRail&apos;s atomic ledger?</h3>
                          <p>
                            Compatibility analysis only. Mainnet purchases require the dedicated execution opt-in and payer configuration.
                          </p>
                        </div>
                        <code title={preview.solanaMainnet.network}>
                          {compactIdentifier(preview.solanaMainnet.network)}
                        </code>
                      </div>

                      <div className={styles.mainnetStats}>
                        <div>
                          <span>Exact + USDC</span>
                          <strong>{preview.solanaMainnet.exactUsdcResources}</strong>
                        </div>
                        <div>
                          <span>GET ready</span>
                          <strong>{preview.solanaMainnet.getResources}</strong>
                        </div>
                        <div>
                          <span>Atomic ledger ready</span>
                          <strong>{preview.solanaMainnet.atomicLedgerResources}</strong>
                        </div>
                        <div>
                          <span>Invalid atomic price</span>
                          <strong>{preview.solanaMainnet.invalidAtomicPriceResources}</strong>
                        </div>
                      </div>

                      {preview.solanaMainnet.resources.length > 0 ? (
                        <div className={styles.mainnetResources}>
                          {preview.solanaMainnet.resources.map((resource) => (
                            <article key={`mainnet-${resource.provider}-${resource.resource}`}>
                              <div className={styles.mainnetResourceTop}>
                                <span>{resource.provider}</span>
                                <strong>{resource.method} · {resource.priceUsdc} USDC</strong>
                              </div>
                              <p>{resource.description}</p>
                              <div className={styles.mainnetResourceFooter}>
                                <code>{resource.resource}</code>
                                <span className={resource.ledgerCompatible ? styles.ledgerReady : styles.atomicNeeded}>
                                  {resource.ledgerCompatible ? "ATOMIC LEDGER OK" : "INVALID ATOMIC PRICE"}
                                </span>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.mainnetEmpty}>
                          No sampled resource advertises exact Solana mainnet USDC with a GET endpoint.
                        </div>
                      )}
                    </section>
                  ) : null}
                </div>
              </details>
            ) : null}

            {preview.counts.compatible === 0 ? (
              <div className={styles.empty}>
                No sampled Bazaar endpoint currently passes every Devnet PolicyRail compatibility gate. The local demo registry remains available, and the execution-readiness status above shows whether external or mainnet procurement is enabled.
              </div>
            ) : (
              <div className={styles.resources}>
                {(preview.resources ?? []).map((resource) => (
                  <article key={`${resource.provider}-${resource.resource}`}>
                    <div>
                      <span>{resource.provider}</span>
                      <strong>{resource.method} · {resource.priceUsdc} USDC</strong>
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

      {probeModalOpen && probe?.results ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProbeModalOpen(false);
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="probe-details-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span>DRY-RUN PROBE DETAILS</span>
                <h2 id="probe-details-title">External x402 handshake results</h2>
                <p>
                  Read-only requests. No payment signatures were sent and no settlement was attempted.
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setProbeModalOpen(false)}
                aria-label="Close probe details"
              >
                ×
              </button>
            </div>

            <div className={styles.modalSummary}>
              <span>{probe.candidates ?? probe.results.length} probed</span>
              <span>{probe.validChallenges ?? 0} valid challenges</span>
              <span>Payment signatures: {probe.paymentSignatureSent ? "YES" : "NO"}</span>
            </div>

            <div className={styles.modalList}>
              {probe.results.map((result) => (
                <article key={`probe-${result.provider}-${result.requestUrl}`}>
                  <div className={styles.probeTop}>
                    <div>
                      <span>{result.provider}</span>
                      <strong>{result.priceUsdc} USDC</strong>
                    </div>
                    <span
                      className={
                        result.outcome === "valid-x402-402"
                          ? styles.probeValid
                          : styles.probeWarning
                      }
                    >
                      {probeLabel(result.outcome)}
                    </span>
                  </div>
                  <p>{result.detail}</p>
                  <div className={styles.probeMeta}>
                    <span>HTTP {result.status ?? "—"}</span>
                    <span>v{result.x402Version ?? "—"}</span>
                    <span>{result.acceptsCount} accepts</span>
                    <span>{result.hasPaymentRequiredHeader ? "PAYMENT-REQUIRED ✓" : "PAYMENT-REQUIRED —"}</span>
                  </div>
                  <code title={result.requestUrl}>{result.requestUrl}</code>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
