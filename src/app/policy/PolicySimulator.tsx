"use client";

import { useState } from "react";
import { formatAtomicUsdDisplay } from "@/lib/money/usdc";

type SimulationEnvelope = {
  maxTransactionAtomic: number;
  remainingTaskBudgetAtomic: number;
  remainingDailyBudgetAtomic: number;
  maxCompliantAmountAtomic: number;
  allowedCategories: string[];
  blockedProviders: string[];
  retryAllowed: boolean;
  requiredChange: {
    field: "provider" | "category" | "amountAtomic";
    operator: "not_in" | "in" | "lte";
    maxAtomic?: number;
    allowedCategories?: string[];
    blockedProviders?: string[];
  } | null;
};

type SimulationResult = {
  simulation: true;
  ledgerMutated: false;
  approved: boolean;
  code: string;
  reason: string;
  policyEnvelope: SimulationEnvelope;
};

function correctionLabel(envelope: SimulationEnvelope) {
  const change = envelope.requiredChange;
  if (!change) return "No correction required.";

  if (change.field === "amountAtomic") {
    return `Use an amount at or below ${formatAtomicUsdDisplay(
      change.maxAtomic ?? envelope.maxCompliantAmountAtomic
    )}.`;
  }

  if (change.field === "category") {
    return `Use an allowed category: ${(change.allowedCategories ?? envelope.allowedCategories).join(", ")}.`;
  }

  const blocked = change.blockedProviders ?? envelope.blockedProviders;
  return `Use a provider outside the blocked list${blocked.length ? `: ${blocked.join(", ")}` : ""}.`;
}

export default function PolicySimulator({
  agentId,
  policyDirty = false,
}: {
  agentId: string;
  policyDirty?: boolean;
}) {
  const [provider, setProvider] = useState("example-provider");
  const [category, setCategory] = useState("data");
  const [amountUsdc, setAmountUsdc] = useState("0.18");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simulate() {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/policy/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, provider, category, amountUsdc }),
      });
      const payload = (await response.json()) as SimulationResult & { error?: string };

      if (!response.ok || typeof payload.approved !== "boolean" || !payload.policyEnvelope) {
        throw new Error(payload.error ?? "Could not simulate policy decision.");
      }

      setResult(payload);
    } catch (simulationError) {
      setError(
        simulationError instanceof Error
          ? simulationError.message
          : "Could not simulate policy decision."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel settingsPanel">
      <div className="panelHeader">
        <div>
          <p className="label">POLICY SIMULATOR</p>
          <h2>What would PolicyRail do?</h2>
        </div>
        <span className="badge">READ ONLY</span>
      </div>

      <p className="lede settingsLede">
        Test a hypothetical purchase against the currently saved policy. No payment request,
        audit event, decision receipt or ledger reservation is created.
      </p>

      {policyDirty ? (
        <p className="errorMessage settingsMessage">
          Save the policy changes first so the simulator and real enforcement evaluate the same policy version.
        </p>
      ) : null}

      <div className="formGrid">
        <label className="field">
          <span>Provider</span>
          <small>Name or domain the agent wants to pay.</small>
          <input
            value={provider}
            disabled={running || policyDirty}
            onChange={(event) => setProvider(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Category</span>
          <small>Spending category for the proposed resource.</small>
          <select
            value={category}
            disabled={running || policyDirty}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="search">Search</option>
            <option value="data">Data</option>
            <option value="compute">Compute</option>
            <option value="inference">Inference</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="field fieldWide">
          <span>Hypothetical amount</span>
          <small>USDC, including fractional-cent amounts up to 6 decimals.</small>
          <div className="moneyInput">
            <b>$</b>
            <input
              type="number"
              min="0.000001"
              step="0.000001"
              value={amountUsdc}
              disabled={running || policyDirty}
              onChange={(event) => setAmountUsdc(event.target.value)}
            />
          </div>
        </label>
      </div>

      <button
        type="button"
        onClick={simulate}
        disabled={running || policyDirty || !provider || !amountUsdc}
      >
        {running ? "Simulating…" : "Simulate decision"}
      </button>

      {error ? <p className="errorMessage settingsMessage">{error}</p> : null}

      {result ? (
        <div className="policyExplanation">
          <span>
            {result.approved ? "WOULD APPROVE" : "WOULD REJECT"} · {result.code}
          </span>
          <p>{result.reason}</p>
          {!result.approved ? <p>{correctionLabel(result.policyEnvelope)}</p> : null}
          <p>
            Max compliant {formatAtomicUsdDisplay(result.policyEnvelope.maxCompliantAmountAtomic)}
            {" · "}Task remaining {formatAtomicUsdDisplay(result.policyEnvelope.remainingTaskBudgetAtomic)}
            {" · "}24h remaining {formatAtomicUsdDisplay(result.policyEnvelope.remainingDailyBudgetAtomic)}
          </p>
          <p>
            Simulation only · ledger mutated: {result.ledgerMutated ? "YES" : "NO"}
          </p>
        </div>
      ) : null}
    </section>
  );
}
