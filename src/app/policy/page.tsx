"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Agent = {
  id: string;
  name: string;
  status: string;
  description: string | null;
};

type Policy = {
  id: string;
  agent_id: string;
  task_budget_cents: number;
  daily_budget_cents: number;
  max_transaction_cents: number;
  allowed_categories: string[];
  blocked_providers: string[];
};

type PolicyForm = {
  taskBudget: string;
  dailyBudget: string;
  maxTransaction: string;
  allowedCategories: string[];
  blockedProviders: string;
};

const categories = [
  { id: "search", label: "Search", description: "Paid web and discovery resources" },
  { id: "data", label: "Data", description: "Benchmarks, datasets and structured evidence" },
  { id: "compute", label: "Compute", description: "External compute and processing" },
  { id: "inference", label: "Inference", description: "Paid model and inference calls" },
  { id: "other", label: "Other", description: "Anything outside the standard categories" },
];

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function toCents(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function formFromPolicy(policy: Policy): PolicyForm {
  return {
    taskBudget: dollars(policy.task_budget_cents),
    dailyBudget: dollars(policy.daily_budget_cents),
    maxTransaction: dollars(policy.max_transaction_cents),
    allowedCategories: policy.allowed_categories,
    blockedProviders: policy.blocked_providers.join(", "),
  };
}

export default function PolicyPage() {
  const [supabase] = useState(() => createClient());
  const [agent, setAgent] = useState<Agent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [form, setForm] = useState<PolicyForm | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        setError(null);

        const { data: claimsData } = await supabase.auth.getClaims();
        if (!claimsData?.claims) {
          const { error: anonymousError } = await supabase.auth.signInAnonymously();
          if (anonymousError) throw anonymousError;
        }

        const response = await fetch("/api/bootstrap", { method: "POST" });
        const payload = (await response.json()) as {
          agent?: Agent;
          policy?: Policy;
          error?: string;
        };

        if (!response.ok || !payload.agent || !payload.policy) {
          throw new Error(payload.error ?? "Could not load agent policy.");
        }

        if (!cancelled) {
          setAgent(payload.agent);
          setPolicy(payload.policy);
          setForm(formFromPolicy(payload.policy));
        }
      } catch (setupError) {
        if (!cancelled) {
          setError(
            setupError instanceof Error
              ? setupError.message
              : "Could not load agent policy."
          );
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const dirty = useMemo(() => {
    if (!policy || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(formFromPolicy(policy));
  }, [form, policy]);

  function toggleCategory(category: string) {
    setMessage(null);
    setForm((current) => {
      if (!current) return current;
      const selected = current.allowedCategories.includes(category);
      return {
        ...current,
        allowedCategories: selected
          ? current.allowedCategories.filter((item) => item !== category)
          : [...current.allowedCategories, category],
      };
    });
  }

  async function savePolicy() {
    if (!agent || !form) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          taskBudgetCents: toCents(form.taskBudget),
          dailyBudgetCents: toCents(form.dailyBudget),
          maxTransactionCents: toCents(form.maxTransaction),
          allowedCategories: form.allowedCategories,
          blockedProviders: form.blockedProviders
            .split(",")
            .map((provider) => provider.trim())
            .filter(Boolean),
        }),
      });

      const payload = (await response.json()) as {
        policy?: Policy;
        error?: string;
      };

      if (!response.ok || !payload.policy) {
        throw new Error(payload.error ?? "Could not save policy.");
      }

      setPolicy(payload.policy);
      setForm(formFromPolicy(payload.policy));
      setMessage("Policy saved. New limits apply to the next agent decision immediately.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save policy.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <nav>
        <Link className="brand brandLink" href="/">
          <span className="mark">P</span>
          PolicyRail
        </Link>
        <div className="navLinks">
          <Link href="/">Agent run</Link>
          <Link className="navActive" href="/policy">Agent policy</Link>
        </div>
      </nav>

      <section className="settingsHero">
        <div>
          <p className="eyebrow">AGENT POLICY</p>
          <h1 className="settingsTitle">Control what the agent can spend.</h1>
          <p className="lede settingsLede">
            These rules are enforced deterministically before the wallet signs an x402 payment.
            The AI can propose a purchase, but it cannot override this policy.
          </p>
        </div>
        <div className="policyState">
          <span className="status">{initializing ? "LOADING" : "ACTIVE POLICY"}</span>
          <strong>{agent?.name ?? "ResearchBot"}</strong>
          <p>Changes take effect on the next procurement decision.</p>
        </div>
      </section>

      {error ? <p className="errorMessage settingsMessage">{error}</p> : null}
      {message ? <p className="successMessage settingsMessage">{message}</p> : null}

      <section className="settingsGrid">
        <div className="settingsMain">
          <section className="panel settingsPanel">
            <div className="panelHeader">
              <div>
                <p className="label">SPENDING LIMITS</p>
                <h2>Budget guardrails</h2>
              </div>
              <span className="badge">USD / USDC</span>
            </div>

            <div className="formGrid">
              <label className="field">
                <span>Task budget</span>
                <small>Maximum spend for one autonomous task.</small>
                <div className="moneyInput">
                  <b>$</b>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form?.taskBudget ?? ""}
                    disabled={initializing || saving}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, taskBudget: event.target.value } : current
                      )
                    }
                  />
                </div>
              </label>

              <label className="field">
                <span>Max transaction</span>
                <small>Largest single payment the agent may make.</small>
                <div className="moneyInput">
                  <b>$</b>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form?.maxTransaction ?? ""}
                    disabled={initializing || saving}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, maxTransaction: event.target.value } : current
                      )
                    }
                  />
                </div>
              </label>

              <label className="field fieldWide">
                <span>Rolling 24h limit</span>
                <small>Total settled spend allowed over the previous 24 hours.</small>
                <div className="moneyInput">
                  <b>$</b>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form?.dailyBudget ?? ""}
                    disabled={initializing || saving}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, dailyBudget: event.target.value } : current
                      )
                    }
                  />
                </div>
              </label>
            </div>
          </section>

          <section className="panel settingsPanel">
            <div className="panelHeader">
              <div>
                <p className="label">ACCESS RULES</p>
                <h2>Allowed spending categories</h2>
              </div>
            </div>

            <div className="categoryGrid">
              {categories.map((category) => {
                const checked = form?.allowedCategories.includes(category.id) ?? false;
                return (
                  <label className={`categoryOption ${checked ? "categorySelected" : ""}`} key={category.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={initializing || saving}
                      onChange={() => toggleCategory(category.id)}
                    />
                    <div>
                      <strong>{category.label}</strong>
                      <span>{category.description}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="panel settingsPanel">
            <div className="panelHeader">
              <div>
                <p className="label">PROVIDER CONTROLS</p>
                <h2>Blocked providers</h2>
              </div>
            </div>
            <label className="field">
              <span>Provider names or domains</span>
              <small>Comma-separated. Matching providers are rejected before settlement.</small>
              <textarea
                rows={4}
                value={form?.blockedProviders ?? ""}
                disabled={initializing || saving}
                placeholder="blocked.example, expensive-provider"
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, blockedProviders: event.target.value } : current
                  )
                }
              />
            </label>
          </section>
        </div>

        <aside className="policySummary panel">
          <p className="label">CURRENT POLICY</p>
          <h2>Enforcement preview</h2>
          <div className="summaryRows">
            <div>
              <span>Task budget</span>
              <strong>${form?.taskBudget || "0.00"}</strong>
            </div>
            <div>
              <span>Max transaction</span>
              <strong>${form?.maxTransaction || "0.00"}</strong>
            </div>
            <div>
              <span>24h limit</span>
              <strong>${form?.dailyBudget || "0.00"}</strong>
            </div>
            <div>
              <span>Allowed categories</span>
              <strong>{form?.allowedCategories.length ?? 0}</strong>
            </div>
          </div>

          <div className="policyExplanation">
            <span>Decision boundary</span>
            <p>
              Agent intent → deterministic PolicyRail check → wallet signature → x402 / Solana settlement.
            </p>
          </div>

          <button onClick={savePolicy} disabled={initializing || saving || !dirty}>
            {saving ? "Saving policy…" : dirty ? "Save policy" : "Policy up to date"}
          </button>

          <Link className="secondaryAction" href="/">
            Test policy with agent →
          </Link>
        </aside>
      </section>
    </main>
  );
}
