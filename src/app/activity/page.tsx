"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  centsToAtomicUsdc,
  formatAtomicUsdDisplay,
} from "@/lib/money/usdc";
import { createClient } from "@/lib/supabase/client";
import styles from "./activity.module.css";

type ActivityTask = {
  id: string;
  agent_id: string;
  agent_name: string;
  prompt: string;
  status: string;
  budget_cents: number;
  budget_atomic: number | null;
  spent_cents: number;
  spent_atomic: number | null;
  result: string | null;
  created_at: string;
  completed_at: string | null;
  activity: {
    approved: number;
    rejected: number;
    settled: number;
    settledAtomic: number;
  };
};

type ActivityPayload = {
  tasks?: ActivityTask[];
  error?: string;
};

const filters = ["all", "completed", "running", "failed"] as const;
type Filter = (typeof filters)[number];

function atomicOrCents(
  atomic: number | null | undefined,
  cents: number | null | undefined
) {
  if (Number.isSafeInteger(atomic) && Number(atomic) >= 0) return Number(atomic);
  if (Number.isSafeInteger(cents) && Number(cents) >= 0) {
    return centsToAtomicUsdc(Number(cents));
  }
  return 0;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityPage() {
  const [supabase] = useState(() => createClient());
  const [tasks, setTasks] = useState<ActivityTask[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const { data: claimsData } = await supabase.auth.getClaims();
        if (!claimsData?.claims) {
          const { error: anonymousError } = await supabase.auth.signInAnonymously();
          if (anonymousError) throw anonymousError;
        }

        const bootstrapResponse = await fetch("/api/bootstrap", { method: "POST" });
        if (!bootstrapResponse.ok) {
          const bootstrapPayload = (await bootstrapResponse.json()) as { error?: string };
          throw new Error(bootstrapPayload.error ?? "Could not initialize PolicyRail.");
        }

        const response = await fetch("/api/activity", { cache: "no-store" });
        const payload = (await response.json()) as ActivityPayload;

        if (!response.ok || !payload.tasks) {
          throw new Error(payload.error ?? "Could not load activity.");
        }

        if (!cancelled) setTasks(payload.tasks);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load activity.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const visibleTasks = useMemo(
    () => tasks.filter((task) => filter === "all" || task.status === filter),
    [filter, tasks]
  );

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
          <Link href="/resources">Resources</Link>
          <Link className={styles.active} href="/activity">Activity</Link>
          <Link href="/policy">Agent policy</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>AUDIT & EXECUTION HISTORY</p>
          <h1>Every task. Every decision. Every payment.</h1>
          <p>
            Open any autonomous run to inspect what the agent discovered, proposed, what policy allowed
            or blocked, and what actually settled on Solana.
          </p>
        </div>
        <Link className={styles.primaryAction} href="/tasks/new">New task</Link>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.filters}>
        {filters.map((item) => (
          <button
            className={`${styles.filterButton} ${filter === item ? styles.filterButtonActive : ""}`}
            key={item}
            onClick={() => setFilter(item)}
          >
            {item === "all" ? `All (${tasks.length})` : item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading task history…</div>
      ) : visibleTasks.length === 0 ? (
        <div className={styles.empty}>No tasks match this filter.</div>
      ) : (
        <section className={styles.list}>
          {visibleTasks.map((task) => (
            <Link className={styles.taskCard} href={`/activity/${task.id}`} key={task.id}>
              <div>
                <p className={styles.taskPrompt}>{task.prompt}</p>
                <div className={styles.meta}>
                  <span>{task.agent_name}</span>
                  <span>{dateLabel(task.created_at)}</span>
                  <span className={styles.status}>{task.status}</span>
                </div>
                {task.result ? (
                  <p className={styles.result}>
                    {task.result.length > 190 ? `${task.result.slice(0, 190)}…` : task.result}
                  </p>
                ) : null}
              </div>

              <div className={styles.cardRight}>
                <strong className={styles.money}>
                  {formatAtomicUsdDisplay(
                    atomicOrCents(task.spent_atomic, task.spent_cents)
                  )}
                </strong>
                <div className={styles.meta}>
                  <span>
                    of {formatAtomicUsdDisplay(
                      atomicOrCents(task.budget_atomic, task.budget_cents)
                    )} budget
                  </span>
                </div>
                <div className={styles.cardStats}>
                  {task.activity.settled ? <span className={styles.settled}>{task.activity.settled} settled</span> : null}
                  {task.activity.rejected ? <span className={styles.rejected}>{task.activity.rejected} blocked</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
