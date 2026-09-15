"use client";

import { useState } from "react";

type Decision = {
  approved: boolean;
  code: string;
  reason: string;
  remainingTaskBudgetCents: number;
  remainingDailyBudgetCents: number;
};

const defaultPolicy = {
  taskBudgetCents: 30,
  dailyBudgetCents: 500,
  maxTransactionCents: 15,
  allowedCategories: ["search", "data", "compute", "inference"],
  blockedProviders: ["blocked.example"],
};

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
  const [spent, setSpent] = useState(0);
  const [events, setEvents] = useState<
    Array<(typeof examples)[number] & { decision: Decision }>
  >([]);
  const [running, setRunning] = useState(false);

  async function runDemo() {
    setEvents([]);
    setSpent(0);
    setRunning(true);

    let localSpent = 0;

    for (const resource of examples) {
      const response = await fetch("/api/policy/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy: defaultPolicy,
          request: {
            provider: resource.provider,
            resource: resource.resource,
            category: resource.category,
            amountCents: resource.amountCents,
            taskSpentCents: localSpent,
            dailySpentCents: localSpent,
          },
        }),
      });

      const decision = (await response.json()) as Decision;
      setEvents((current) => [...current, { ...resource, decision }]);

      if (decision.approved) {
        localSpent += resource.amountCents;
        setSpent(localSpent);
      }

      await new Promise((resolve) => setTimeout(resolve, 550));
    }

    setRunning(false);
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
              <h2>ResearchBot</h2>
            </div>
            <div className="status">ACTIVE</div>
          </div>

          <div className="metrics">
            <div>
              <span>Task budget</span>
              <strong>$0.30</strong>
            </div>
            <div>
              <span>Max transaction</span>
              <strong>$0.15</strong>
            </div>
            <div>
              <span>Spent</span>
              <strong>${(spent / 100).toFixed(2)}</strong>
            </div>
          </div>

          <div className="task">
            <span>Task</span>
            <p>Compare AI inference providers and recommend the best value.</p>
          </div>

          <button onClick={runDemo} disabled={running}>
            {running ? "Agent running…" : "Run policy demo"}
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
              Run the demo to watch PolicyRail evaluate autonomous purchases.
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
