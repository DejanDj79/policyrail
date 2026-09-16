"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

type AgentAttempt = {
  resourceId: string;
  resourceName: string;
  amountCents: number;
  agentRationale: string;
  approved: boolean;
  policyReason: string;
  decisionCode: string;
  settlementStatus: "not_applicable" | "simulated" | "settled";
  transactionSignature: string | null;
};

type AgentRunPayload = {
  model?: string;
  taskId?: string;
  finalAnswer?: string;
  totalSpentCents?: number;
  settlementMode?: "simulated" | "x402-solana-devnet";
  attempts?: AgentAttempt[];
  error?: string;
};

const taskPrompt = "Compare AI inference providers and recommend the best value.";

function shortSignature(signature: string) {
  if (signature.length <= 20) return signature;
  return `${signature.slice(0, 10)}…${signature.slice(-8)}`;
}

export default function Home() {
  const [supabase] = useState(() => createClient());
  const [agent, setAgent] = useState<Agent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [spent, setSpent] = useState(0);
  const [events, setEvents] = useState<AgentAttempt[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [settlementMode, setSettlementMode] = useState<
    "simulated" | "x402-solana-devnet" | null
  >(null);
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
    setFinalAnswer(null);
    setModel(null);
    setSettlementMode(null);
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

      const agentResponse = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskPayload.task.id }),
      });

      const agentPayload = (await agentResponse.json()) as AgentRunPayload;

      if (!agentResponse.ok || !agentPayload.attempts) {
        throw new Error(agentPayload.error ?? "AI agent execution failed.");
      }

      let localSpent = 0;

      for (const attempt of agentPayload.attempts) {
        setEvents((current) => [...current, attempt]);
        if (attempt.approved) {
          localSpent += attempt.amountCents;
          setSpent(localSpent);
        }
        await new Promise((resolve) => setTimeout(resolve, 650));
      }

      setSpent(agentPayload.totalSpentCents ?? localSpent);
      setFinalAnswer(agentPayload.finalAnswer ?? null);
      setModel(agentPayload.model ?? null);
      setSettlementMode(agentPayload.settlementMode ?? "simulated");
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
        <Link className="brand brandLink" href="/dashboard">
          <span className="mark">P</span>
          PolicyRail
        </Link>
        <div className="navLinks">
          <Link href="/dashboard">Dashboard</Link>
          <Link className="navActive" href="/">Agent run</Link>
          <Link href="/policy">Agent policy</Link>
        </div>
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
              <p className="label">AUTONOMOUS AGENT</p>
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

          {model ? (
            <p className="modelNote">
              Decision model: <strong>{model}</strong>
              {settlementMode ? (
                <>
                  {" · "}
                  Settlement: <strong>
                    {settlementMode === "x402-solana-devnet"
                      ? "x402 / Solana Devnet"
                      : "simulated"}
                  </strong>
                </>
              ) : null}
            </p>
          ) : null}

          {error ? <p className="errorMessage">{error}</p> : null}

          <button
            onClick={runDemo}
            disabled={running || initializing || !agent || !policy}
          >
            {initializing
              ? "Connecting to policy store…"
              : running
                ? "AI agent reasoning…"
                : "Run autonomous agent"}
          </button>

          {finalAnswer ? (
            <div className="resultCard">
              <span>Agent result</span>
              <p>{finalAnswer}</p>
            </div>
          ) : null}
        </div>

        <div className="panel audit">
          <div className="panelHeader">
            <div>
              <p className="label">LIVE AUDIT TRAIL</p>
              <h2>Agent intent → policy → settlement</h2>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="empty">
              Run the agent to watch AI procurement decisions get evaluated by
              deterministic spending policy.
            </div>
          ) : (
            <div className="events">
              {events.map((event, index) => (
                <div className="event" key={`${event.resourceId}-${index}`}>
                  <div>
                    <strong>{event.resourceName}</strong>
                    <span>${(event.amountCents / 100).toFixed(2)} proposal</span>
                  </div>
                  <div className={event.approved ? "approved" : "rejected"}>
                    {event.approved ? "APPROVED" : "REJECTED"}
                  </div>

                  <div className="decisionDetail">
                    <span>AI rationale</span>
                    <p>{event.agentRationale}</p>
                  </div>

                  <div className="decisionDetail policyDetail">
                    <span>PolicyRail</span>
                    <p>{event.policyReason}</p>
                  </div>

                  {event.approved ? (
                    <div className="decisionDetail settlementDetail">
                      <span>Settlement</span>
                      <p>
                        {event.settlementStatus === "settled"
                          ? "SETTLED · x402 exact · Solana Devnet"
                          : "SIMULATED · wallet signing disabled"}
                      </p>
                      {event.transactionSignature ? (
                        <a
                          href={`https://explorer.solana.com/tx/${event.transactionSignature}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortSignature(event.transactionSignature)} ↗
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flow">
        <span>AI procurement intent</span>
        <b>→</b>
        <span>PolicyRail authorization</span>
        <b>→</b>
        <span>x402 / Solana settlement</span>
      </section>
    </main>
  );
}
