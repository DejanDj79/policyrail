"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./new-task.module.css";

type Agent = {
  id: string;
  name: string;
  status: string;
};

type Policy = {
  task_budget_cents: number;
  daily_budget_cents: number;
  max_transaction_cents: number;
};

type Attempt = {
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

type Discovery = {
  taskSupported: boolean;
  resourceIds: string[];
  rationale: string;
  confidence: "low" | "medium" | "high";
};

type RunPayload = {
  model?: string;
  taskId?: string;
  discovery?: Discovery;
  finalAnswer?: string;
  totalSpentCents?: number;
  settlementMode?: "simulated" | "x402-solana-devnet";
  attempts?: Attempt[];
  error?: string;
};

const DEMO_TASK = "Compare AI inference providers and recommend the best overall value, considering cost efficiency, reliability and latency.";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortSignature(signature: string) {
  return `${signature.slice(0, 9)}…${signature.slice(-7)}`;
}

export default function NewTaskPage() {
  const [supabase] = useState(() => createClient());
  const [agent, setAgent] = useState<Agent | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [spent, setSpent] = useState(0);
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
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
          setBudget((payload.policy.task_budget_cents / 100).toFixed(2));
        }
      } catch (setupError) {
        if (!cancelled) {
          setError(setupError instanceof Error ? setupError.message : "Could not initialize task form.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function runTask() {
    if (!agent || !policy) return;

    const trimmedPrompt = prompt.trim();
    const budgetCents = Math.round(Number(budget) * 100);

    if (!trimmedPrompt) {
      setError("Describe what you want the agent to do.");
      return;
    }

    if (!Number.isInteger(budgetCents) || budgetCents <= 0) {
      setError("Enter a valid task budget.");
      return;
    }

    if (budgetCents > policy.task_budget_cents) {
      setError(`Task budget cannot exceed the policy limit of ${money(policy.task_budget_cents)}.`);
      return;
    }

    setRunning(true);
    setError(null);
    setDiscovery(null);
    setAttempts([]);
    setFinalAnswer(null);
    setSpent(0);
    setTaskId(null);

    try {
      const taskResponse = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          prompt: trimmedPrompt,
          budgetCents,
        }),
      });

      const taskPayload = (await taskResponse.json()) as {
        task?: { id: string };
        error?: string;
      };

      if (!taskResponse.ok || !taskPayload.task) {
        throw new Error(taskPayload.error ?? "Could not create task.");
      }

      setTaskId(taskPayload.task.id);

      const runResponse = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: taskPayload.task.id }),
      });

      const runPayload = (await runResponse.json()) as RunPayload;

      if (!runResponse.ok || !runPayload.attempts) {
        throw new Error(runPayload.error ?? "Agent execution failed.");
      }

      setDiscovery(runPayload.discovery ?? null);
      setAttempts(runPayload.attempts);
      setSpent(runPayload.totalSpentCents ?? 0);
      setFinalAnswer(runPayload.finalAnswer ?? null);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Task failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/dashboard">
          <span className={styles.mark}>P</span>
          PolicyRail
        </Link>
        <div className={styles.navLinks}>
          <Link href="/dashboard">Dashboard</Link>
          <Link className={styles.active} href="/tasks/new">New task</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/activity">Activity</Link>
          <Link href="/policy">Agent policy</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>NEW AUTONOMOUS TASK</p>
          <h1>Tell the agent what to achieve.</h1>
          <p>
            Set the objective and a task-specific budget. The agent first discovers relevant directory
            resources, then PolicyRail enforces every payment before the wallet signs.
          </p>
        </div>
      </section>

      <section className={styles.layout}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.label}>TASK OBJECTIVE</p>
              <h2>What should {agent?.name ?? "the agent"} do?</h2>
            </div>
            <button
              className={styles.preset}
              type="button"
              disabled={loading || running}
              onClick={() => setPrompt(DEMO_TASK)}
            >
              Use demo task
            </button>
          </div>

          <textarea
            className={styles.prompt}
            rows={7}
            maxLength={4000}
            value={prompt}
            disabled={loading || running}
            placeholder="Example: Compare AI inference providers and recommend the best overall value..."
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className={styles.promptMeta}>
            <span>{prompt.length}/4000</span>
            <span>Task-aware directory discovery</span>
          </div>

          <div className={styles.disclosure}>
            <strong>Current MVP scope</strong>
            <p>
              The agent now filters the resource directory for each task before procurement. The current
              synthetic directory is still centered on AI inference-provider research; expanding the
              catalog to more domains is the next step.
            </p>
          </div>

          <div className={styles.budgetBlock}>
            <label>
              <span>Task budget</span>
              <small>May be lower than the agent policy maximum, never higher.</small>
              <div className={styles.moneyInput}>
                <b>$</b>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={policy ? (policy.task_budget_cents / 100).toFixed(2) : undefined}
                  value={budget}
                  disabled={loading || running}
                  onChange={(event) => setBudget(event.target.value)}
                />
              </div>
            </label>

            <div className={styles.guardrails}>
              <div>
                <span>Policy task max</span>
                <strong>{money(policy?.task_budget_cents ?? 0)}</strong>
              </div>
              <div>
                <span>Max transaction</span>
                <strong>{money(policy?.max_transaction_cents ?? 0)}</strong>
              </div>
              <div>
                <span>24h limit</span>
                <strong>{money(policy?.daily_budget_cents ?? 0)}</strong>
              </div>
            </div>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button
            className={styles.runButton}
            type="button"
            disabled={loading || running || !agent || !policy}
            onClick={runTask}
          >
            {loading ? "Loading policy…" : running ? "Discovering & procuring…" : "Run task"}
          </button>
        </div>

        <aside className={styles.sidePanel}>
          <p className={styles.label}>EXECUTION BOUNDARY</p>
          <h2>Discovery before procurement.</h2>
          <div className={styles.steps}>
            <span>1 · Agent interprets objective</span>
            <span>2 · Directory discovery finds relevant resources</span>
            <span>3 · Agent proposes a paid resource</span>
            <span>4 · PolicyRail authorizes or rejects</span>
            <span>5 · Agent adapts when rejected</span>
            <span>6 · x402 settles approved spend</span>
          </div>
          <Link href="/resources">Browse resource directory →</Link>
          <Link href="/policy">Review active policy →</Link>
        </aside>
      </section>

      {discovery || attempts.length > 0 || finalAnswer ? (
        <section className={styles.results}>
          <div className={styles.resultsHeader}>
            <div>
              <p className={styles.label}>TASK EXECUTION</p>
              <h2>{finalAnswer ? "Completed" : "Agent decisions"}</h2>
            </div>
            <div className={styles.spendBadge}>{money(spent)} spent</div>
          </div>

          {discovery ? (
            <div className={styles.finalAnswer}>
              <span>
                Resource discovery · {discovery.resourceIds.length} match{discovery.resourceIds.length === 1 ? "" : "es"} · {discovery.confidence} confidence
              </span>
              <p>{discovery.rationale}</p>
              {discovery.resourceIds.length > 0 ? (
                <p><b>Matched:</b> {discovery.resourceIds.join(", ")}</p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.timeline}>
            {attempts.map((attempt, index) => (
              <div className={styles.timelineItem} key={`${attempt.resourceId}-${index}`}>
                <div className={styles.timelineTop}>
                  <div>
                    <strong>{attempt.resourceName}</strong>
                    <span>{money(attempt.amountCents)} proposed</span>
                  </div>
                  <span className={attempt.approved ? styles.approved : styles.rejected}>
                    {attempt.approved ? "APPROVED" : "REJECTED"}
                  </span>
                </div>
                <p><b>Agent:</b> {attempt.agentRationale}</p>
                <p><b>PolicyRail:</b> {attempt.policyReason}</p>
                {attempt.transactionSignature ? (
                  <a
                    href={`https://explorer.solana.com/tx/${attempt.transactionSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Settled · {shortSignature(attempt.transactionSignature)} ↗
                  </a>
                ) : null}
              </div>
            ))}
          </div>

          {finalAnswer ? (
            <div className={styles.finalAnswer}>
              <span>Agent result</span>
              <p>{finalAnswer}</p>
            </div>
          ) : null}

          <div className={styles.resultActions}>
            <Link href="/dashboard">Back to dashboard</Link>
            {taskId ? <Link href={`/activity/${taskId}`}>View full audit →</Link> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
