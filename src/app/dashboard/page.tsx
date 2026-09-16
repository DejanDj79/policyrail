"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./dashboard.module.css";

type DashboardPayload = {
  agent: {
    id: string;
    name: string;
    status: string;
    description: string | null;
    wallet_address: string | null;
  };
  policy: {
    task_budget_cents: number;
    daily_budget_cents: number;
    max_transaction_cents: number;
    allowed_categories: string[];
    blocked_providers: string[];
    updated_at: string;
  } | null;
  summary: {
    settled24hCents: number;
    completedTasks: number;
    rejectedPayments: number;
    settledPayments: number;
  };
  recentTasks: Array<{
    id: string;
    prompt: string;
    status: string;
    budget_cents: number;
    spent_cents: number;
    result: string | null;
    created_at: string;
    completed_at: string | null;
  }>;
  recentPayments: Array<{
    id: string;
    task_id: string | null;
    provider: string;
    resource: string;
    category: string;
    amount_cents: number;
    decision: string;
    decision_code: string;
    reason: string;
    settlement_status: string;
    transaction_signature: string | null;
    created_at: string;
    settled_at: string | null;
  }>;
  error?: string;
};

type WalletPayload = {
  address?: string;
  usdcBalance?: string;
  solBalance?: string;
  error?: string;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortSignature(signature: string) {
  return `${signature.slice(0, 9)}…${signature.slice(-7)}`;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [supabase] = useState(() => createClient());
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [wallet, setWallet] = useState<WalletPayload | null>(null);
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

        const [dashboardResponse, walletResponse] = await Promise.all([
          fetch("/api/dashboard", { cache: "no-store" }),
          fetch("/api/wallet", { cache: "no-store" }),
        ]);

        const dashboardPayload = (await dashboardResponse.json()) as DashboardPayload;
        const walletPayload = (await walletResponse.json()) as WalletPayload;

        if (!dashboardResponse.ok) {
          throw new Error(dashboardPayload.error ?? "Could not load dashboard.");
        }

        if (!cancelled) {
          setData(dashboardPayload);
          setWallet(walletResponse.ok ? walletPayload : null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load dashboard.");
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

  const dailyUsagePercent = useMemo(() => {
    if (!data?.policy?.daily_budget_cents) return 0;
    return Math.min(
      100,
      Math.round((data.summary.settled24hCents / data.policy.daily_budget_cents) * 100)
    );
  }, [data]);

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link className={styles.brand} href="/dashboard">
          <span className={styles.mark}>P</span>
          PolicyRail
        </Link>
        <div className={styles.navLinks}>
          <Link className={styles.active} href="/dashboard">Dashboard</Link>
          <Link href="/tasks/new">New task</Link>
          <Link href="/activity">Activity</Link>
          <Link href="/policy">Agent policy</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>CONTROL CENTER</p>
          <h1>See what your agent spends — and why.</h1>
          <p>
            Live policy, autonomous task activity and real x402 settlement history in one place.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.secondaryAction} href="/policy">Edit policy</Link>
          <Link className={styles.primaryAction} href="/tasks/new">New task</Link>
        </div>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading || !data ? (
        <div className={styles.loading}>Loading agent activity…</div>
      ) : (
        <>
          <section className={styles.metrics}>
            <div className={styles.metric}>
              <span>Settled spend · 24h</span>
              <strong>{money(data.summary.settled24hCents)}</strong>
              <small>Real settled x402 payments</small>
            </div>
            <div className={styles.metric}>
              <span>Completed tasks</span>
              <strong>{data.summary.completedTasks}</strong>
              <small>Autonomous tasks completed</small>
            </div>
            <div className={styles.metric}>
              <span>Settled payments</span>
              <strong>{data.summary.settledPayments}</strong>
              <small>Successful Solana settlements</small>
            </div>
            <div className={styles.metric}>
              <span>Blocked attempts</span>
              <strong>{data.summary.rejectedPayments}</strong>
              <small>Stopped by active policy</small>
            </div>
          </section>

          <section className={styles.grid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.label}>ACTIVE AGENT</p>
                  <h2>{data.agent.name}</h2>
                </div>
                <span className={styles.status}>{data.agent.status.toUpperCase()}</span>
              </div>

              <div className={styles.agentBlock}>
                <div className={styles.walletLine}>
                  <span>x402 wallet</span>
                  <strong>{wallet?.usdcBalance ? `${wallet.usdcBalance} USDC` : "Connected"}</strong>
                </div>
                {data.agent.wallet_address ? (
                  <a
                    className={styles.walletAddress}
                    href={`https://explorer.solana.com/address/${data.agent.wallet_address}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    title={data.agent.wallet_address}
                  >
                    {data.agent.wallet_address} ↗
                  </a>
                ) : null}
              </div>

              <div className={styles.policyRows}>
                <div className={styles.policyRow}>
                  <span>Task budget</span>
                  <strong>{money(data.policy?.task_budget_cents ?? 0)}</strong>
                </div>
                <div className={styles.policyRow}>
                  <span>Max transaction</span>
                  <strong>{money(data.policy?.max_transaction_cents ?? 0)}</strong>
                </div>
                <div className={styles.policyRow}>
                  <span>Rolling 24h limit</span>
                  <strong>{money(data.policy?.daily_budget_cents ?? 0)}</strong>
                </div>
                <div className={styles.policyRow}>
                  <span>Allowed categories</span>
                  <strong>{data.policy?.allowed_categories.length ?? 0}</strong>
                </div>
              </div>

              <div className={styles.progressMeta}>
                <span>24h policy usage</span>
                <span>{dailyUsagePercent}%</span>
              </div>
              <div className={styles.progress}>
                <span style={{ width: `${dailyUsagePercent}%` }} />
              </div>
            </div>

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.label}>RECENT TASKS</p>
                  <h2>Autonomous runs</h2>
                </div>
                <Link className={styles.secondaryAction} href="/activity">View all</Link>
              </div>

              {data.recentTasks.length === 0 ? (
                <div className={styles.empty}>No tasks yet.</div>
              ) : (
                <div className={styles.taskList}>
                  {data.recentTasks.map((task) => (
                    <Link
                      href={`/activity/${task.id}`}
                      key={task.id}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      <div className={styles.taskItem}>
                        <div className={styles.taskTop}>
                          <div className={styles.taskTitle}>
                            <strong>{task.prompt}</strong>
                            <span className={styles.taskMeta}>
                              {task.status.toUpperCase()} · {dateLabel(task.created_at)}
                            </span>
                          </div>
                          <div className={styles.taskSpend}>
                            <strong>{money(task.spent_cents)}</strong>
                            <span>of {money(task.budget_cents)}</span>
                          </div>
                        </div>
                        {task.result ? <p className={styles.result}>{task.result}</p> : null}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.activity}`}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.label}>RECENT ACTIVITY</p>
                <h2>Policy decisions & settlements</h2>
              </div>
              <Link className={styles.secondaryAction} href="/activity">Full audit</Link>
            </div>

            {data.recentPayments.length === 0 ? (
              <div className={styles.empty}>No payment decisions yet.</div>
            ) : (
              <div className={styles.paymentList}>
                {data.recentPayments.map((payment) => (
                  <div className={styles.paymentItem} key={payment.id}>
                    <div className={styles.paymentTop}>
                      <div className={styles.paymentTitle}>
                        <strong>{payment.provider} · {payment.resource}</strong>
                        <span className={styles.paymentMeta}>
                          {payment.category} · {dateLabel(payment.created_at)}
                        </span>
                      </div>
                      <span className={styles.paymentAmount}>{money(payment.amount_cents)}</span>
                    </div>

                    <div className={styles.badges}>
                      <span className={payment.decision === "approved" ? styles.approved : styles.rejected}>
                        {payment.decision.toUpperCase()}
                      </span>
                      <span
                        className={
                          payment.settlement_status === "settled"
                            ? styles.settled
                            : payment.settlement_status === "authorized"
                              ? styles.authorized
                              : styles.rejected
                        }
                      >
                        {payment.settlement_status.toUpperCase()}
                      </span>
                    </div>

                    <p className={styles.reason}>{payment.reason}</p>

                    {payment.transaction_signature ? (
                      <a
                        className={styles.txLink}
                        href={`https://explorer.solana.com/tx/${payment.transaction_signature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {shortSignature(payment.transaction_signature)} ↗
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
