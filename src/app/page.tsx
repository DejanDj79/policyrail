"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Decision = {
  approved: boolean;
  code: string;
  reason: string;
  remainingTaskBudgetCents: number;
  remainingDailyBudgetCents: number;
  paymentRequestId: string;
};

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

const taskPrompt = "Compare AI inference providers and recommend the best value.";

const examples = [
  {
    name: "Search dataset",
    provider: "SearchGrid",
    resource: "market-search",
    category: "search",
    amountCents: 2,
  },
  {
    name: "Premium benchmark",
    provider: "BenchPrime",
    resource: "premium-benchmark",
    category: "data",
    amountCents: 25,
  },
  {
    name: "Alternative benchmark",
    provider: "ValueBench",
    resource: "benchmark-lite",
    category: "data",
    amountCents: 7,
  },
] as const;

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [agent, setAgent] = useState<Agent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [spent, setSpent] = useState(0);
  const [events, setEvents] = useState<
    Array<(typeof examples)[number] & { decision: Decision }>
  >([]);
  const [running, setRunning] = useState(false);
  const [initializing, setInitializing] = useState(true);
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
          throw new Error(payload.error ?? "Could not initialize PolicyRail.");
        }

        if (!cancelled) {
          setAgent(payload.agent);
          setPolicy(payload.policy);
        }
      } catch (setupError) {
        if (!cancelled) {
          setError(
            setupError instanceof Error
              ? setupError.message
              : "Could not initialize PolicyRail."
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

  async function runDemo() {
    if (!agent || !policy) return;

    setEvents([]);
    setSpent(0);
    setError(null);
    setRunning(true);

    try {
      const taskResponse = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, prompt: taskPrompt }),
      });

      const taskPayload = (await taskResponse.json()) as {
        task?: { id: string };
        error?: string;
      };

      if (!taskResponse.ok || !taskPayload.task) {
        throw new Error(taskPayload.error ?? "Could not create task.");
      }

      let localSpent = 0;

      for (const resource of examples) {
        const response = await fetch("/api/policy/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskId: taskPayload.task.id,
            provider: resource.provider,
            resource: resource.resource,
            category: resource.category,
            amountCents: resource.amountCents,
          }),
        });

        const decision = (await response.json()) as Decision & { error?: string };

        if (!response.ok) {
          throw new Error(decision.error ?? "Policy evaluation failed.");
        }

        setEvents((current) => [...current, { ...resource, decision }]);

        if (decision.approved) {
          localSpent += resource.amountCents;
          setSpent(localSpent);
        }

        await new Promise((resolve) => setTimeout(resolve, 550));
      }

      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: taskPayload.task.id,
          result:
            "ValueBench provides the best value for this task while remaining within PolicyRail spending constraints.",
        }),
      });
    } catch (runError) {
      setError(
        runError instanceof Error ? runError.message : "The demo task failed."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="shell">
      <nav>
        <div className="brand">
          <span className="mark">P</span>
          PolicyRail
        </div>
        <span className="badge">Crypto World&apos;s Fair 2026</span>
      </nav>

      <section className="hero">
        <p className="eyebrow">FINANCIAL CONTROL FOR AUTONOMOUS AGENTS</p>
        <h1>
          AI decides what to buy.
          <br />
          <span>PolicyRail decides what it can spend.</span>
        </h1>
        <p className="lede">
          Give AI agents economic autonomy without giving them unrestricted
          access to your money.
        </p>
      </section>

      <section className="grid">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <p className="label">DEMO AGENT</p>
              <h2>{agent?.name ?? "ResearchBot"}</h2>
            </div>
            <div className="status">
              {initializing ? "CONNECTING" : agent ? "ACTIVE" : "OFFLINE"}
            </div>
          </div>

          <div className="metrics">
            <div>
              <span>Task budget</span>
              <strong>
                ${((policy?.task_budget_cents ?? 30) / 100).toFixed(2)}
              </strong>
            </div>
            <div>
              <span>Max transaction</span>
              <strong>
                ${((policy?.max_transaction_cents ?? 15) / 100).toFixed(2)}
              </strong>
            </div>
            <div>
              <span>Spent</span>
              <strong>${(spent / 100).toFixed(2)}</strong>
            </div>
          </div>

          <div className="task">
            <span>Task</span>
            <p>{taskPrompt}</p>
          </div>

          {error ? <p className="errorMessage">{error}</p> : null}

          <button
            onClick={runDemo}
            disabled={running || initializing || !agent || !policy}
          >
            {initializing
              ? "Connecting to policy store…"
              : running
                ? "Agent running…"
                : "Run policy demo"}
          </button>
        </div>

        <div className="panel audit">
          <div className="panelHeader">
            <div>
              <p className="label">LIVE AUDIT TRAIL</p>
              <h2>Policy decisions</h2>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="empty">
              {initializing
                ? "Connecting to the PolicyRail data layer…"
                : "Run the demo to watch PolicyRail evaluate and persist autonomous purchases."}
            </div>
          ) : (
            <div className="events">
              {events.map((event, index) => (
                <div className="event" key={`${event.resource}-${index}`}>
                  <div>
                    <strong>{event.name}</strong>
                    <span>
                      {event.provider} · ${(event.amountCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div
                    className={
                      event.decision.approved ? "approved" : "rejected"
                    }
                  >
                    {event.decision.approved ? "APPROVED" : "REJECTED"}
                  </div>
                  <p>{event.decision.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flow">
        <span>Agent intent</span>
        <b>→</b>
        <span>PolicyRail</span>
        <b>→</b>
        <span>Solana settlement</span>
      </section>
    </main>
  );
}
