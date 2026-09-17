"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  centsToAtomicUsdc,
  formatAtomicUsdDisplay,
} from "@/lib/money/usdc";
import { createClient } from "@/lib/supabase/client";
import styles from "../activity.module.css";

type Payment = {
  id: string;
  provider: string;
  resource: string;
  category: string;
  amount_cents: number | null;
  amount_atomic: number;
  decision: string;
  decision_code: string;
  reason: string;
  settlement_status: string;
  transaction_signature: string | null;
  created_at: string;
  settled_at: string | null;
};

type AuditEvent = {
  id: string;
  payment_request_id: string | null;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type DetailPayload = {
  task?: {
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
  };
  payments?: Payment[];
  events?: AuditEvent[];
  error?: string;
};

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
    second: "2-digit",
  });
}

function payloadText(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function payloadNumber(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function payloadAtomic(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function payloadMoney(payload: Record<string, unknown> | null) {
  const atomic = payloadAtomic(payload, "amount_atomic");
  if (atomic !== null) return formatAtomicUsdDisplay(atomic);

  const cents = payloadNumber(payload, "amount_cents");
  if (cents !== null && Number.isSafeInteger(cents) && cents >= 0) {
    return formatAtomicUsdDisplay(centsToAtomicUsdc(cents));
  }
  return null;
}

function payloadStringArray(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value as string[]
    : [];
}

function shortSignature(signature: string) {
  return `${signature.slice(0, 10)}…${signature.slice(-8)}`;
}

function eventTitle(event: AuditEvent) {
  const payload = event.payload;
  switch (event.event_type) {
    case "task_created":
      return "Task created";
    case "resource_discovery_completed":
      return "Resource discovery completed";
    case "agent_resource_proposed":
      return `AI proposed ${payloadText(payload, "resource_name") ?? "a paid resource"}`;
    case "payment_approved":
      return "PolicyRail approved payment";
    case "payment_rejected":
      return "PolicyRail blocked payment";
    case "payment_settled":
      return "x402 payment settled";
    case "payment_settlement_failed":
      return "Settlement failed";
    case "task_completed":
      return "Task completed";
    default:
      return event.event_type.replaceAll("_", " ");
  }
}

function eventBody(event: AuditEvent) {
  const payload = event.payload;
  if (event.event_type === "task_created") {
    const budgetAtomic = payloadAtomic(payload, "budget_atomic");
    if (budgetAtomic !== null) {
      return `Task budget set to ${formatAtomicUsdDisplay(budgetAtomic)}.`;
    }

    const budgetCents = payloadNumber(payload, "budget_cents");
    return budgetCents === null
      ? "The autonomous task entered the policy-controlled execution flow."
      : `Task budget set to ${formatAtomicUsdDisplay(centsToAtomicUsdc(budgetCents))}.`;
  }
  if (event.event_type === "resource_discovery_completed") {
    const resources = payloadStringArray(payload, "resource_ids");
    const rationale = payloadText(payload, "rationale");
    const confidence = payloadText(payload, "confidence");
    if (resources.length === 0) {
      return rationale ?? "No relevant paid resources were found in the current directory.";
    }
    return `${rationale ?? "Relevant directory resources were selected."} Matched: ${resources.join(", ")}${confidence ? ` · ${confidence} confidence` : ""}.`;
  }
  if (event.event_type === "agent_resource_proposed") {
    return payloadText(payload, "rationale") ?? "The AI selected this resource as its next procurement step.";
  }
  if (event.event_type === "payment_approved" || event.event_type === "payment_rejected") {
    return payloadText(payload, "reason") ?? "PolicyRail evaluated the proposed payment.";
  }
  if (event.event_type === "payment_settled") {
    const provider = payloadText(payload, "provider");
    const resource = payloadText(payload, "resource");
    return `Exact x402 settlement completed${provider ? ` with ${provider}` : ""}${resource ? ` for ${resource}` : ""}.`;
  }
  if (event.event_type === "payment_settlement_failed") {
    return payloadText(payload, "reason") ?? "The authorized payment could not be settled.";
  }
  if (event.event_type === "task_completed") {
    return payloadText(payload, "result") ?? "The agent completed the task.";
  }
  return "Audit event recorded by PolicyRail.";
}

function eventClass(event: AuditEvent) {
  if (event.event_type === "payment_rejected") return styles.timelineRejected;
  if (event.event_type === "payment_settlement_failed") return styles.timelineFailed;
  if (event.event_type === "payment_approved") return styles.timelineApproved;
  if (event.event_type === "payment_settled") return styles.timelineSettled;
  if (event.event_type === "task_completed") return styles.timelineCompleted;
  return "";
}

export default function ActivityDetailPage() {
  const params = useParams();
  const taskId = typeof params.taskId === "string" ? params.taskId : null;
  const [supabase] = useState(() => createClient());
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;

    async function load() {
      try {
        setError(null);
        const { data: claimsData } = await supabase.auth.getClaims();
        if (!claimsData?.claims) {
          const { error: anonymousError } = await supabase.auth.signInAnonymously();
          if (anonymousError) throw anonymousError;
        }

        const response = await fetch(`/api/activity/${taskId}`, { cache: "no-store" });
        const payload = (await response.json()) as DetailPayload;
        if (!response.ok || !payload.task || !payload.payments || !payload.events) {
          throw new Error(payload.error ?? "Could not load task activity.");
        }

        if (!cancelled) setData(payload);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load task activity.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, taskId]);

  const summary = useMemo(() => {
    const payments = data?.payments ?? [];
    return {
      approved: payments.filter((payment) => payment.decision === "approved").length,
      rejected: payments.filter((payment) => payment.decision === "rejected").length,
      settled: payments.filter((payment) => payment.settlement_status === "settled").length,
    };
  }, [data]);

  const task = data?.task;

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

      {loading ? <div className={styles.loading}>Loading execution record…</div> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {task && data?.payments && data.events ? (
        <>
          <section className={styles.detailHeader}>
            <div>
              <p className={styles.eyebrow}>TASK EXECUTION RECORD</p>
              <h1>{task.prompt}</h1>
              <div className={styles.detailMeta}>
                <span>{task.agent_name}</span>
                <span>{dateLabel(task.created_at)}</span>
                <span className={styles.status}>{task.status}</span>
              </div>
            </div>
            <Link className={styles.backLink} href="/activity">← All activity</Link>
          </section>

          <section className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>Task budget</span>
              <strong>
                {formatAtomicUsdDisplay(
                  atomicOrCents(task.budget_atomic, task.budget_cents)
                )}
              </strong>
              <small>Execution ceiling</small>
            </div>
            <div className={styles.summaryCard}>
              <span>Actual spend</span>
              <strong>
                {formatAtomicUsdDisplay(
                  atomicOrCents(task.spent_atomic, task.spent_cents)
                )}
              </strong>
              <small>Settled spend</small>
            </div>
            <div className={styles.summaryCard}>
              <span>Settled payments</span>
              <strong>{summary.settled}</strong>
              <small>{summary.approved} approved</small>
            </div>
            <div className={styles.summaryCard}>
              <span>Blocked attempts</span>
              <strong>{summary.rejected}</strong>
              <small>Stopped before signing</small>
            </div>
          </section>

          <section className={styles.detailGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.label}>EXECUTION TIMELINE</p>
                  <h2>Discovery → intent → policy → settlement</h2>
                </div>
              </div>

              <div className={styles.timeline}>
                {data.events.map((event) => {
                  const amount = payloadMoney(event.payload);
                  const decisionCode = payloadText(event.payload, "decision_code");
                  const signature = payloadText(event.payload, "transaction_signature");
                  const provider = payloadText(event.payload, "provider");

                  return (
                    <article className={`${styles.timelineItem} ${eventClass(event)}`} key={event.id}>
                      <div className={styles.timelineTitle}>
                        <strong>{eventTitle(event)}</strong>
                        <span className={styles.neutral}>{dateLabel(event.created_at)}</span>
                      </div>
                      <p className={styles.timelineBody}>{eventBody(event)}</p>
                      <div className={styles.eventMeta}>
                        {provider ? <span>{provider}</span> : null}
                        {amount ? <span>{amount}</span> : null}
                        {decisionCode ? <span>{decisionCode}</span> : null}
                      </div>
                      {signature ? (
                        <a
                          className={styles.txLink}
                          href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shortSignature(signature)} ↗
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>

            <aside>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.label}>PAYMENTS</p>
                    <h2>Procurement decisions</h2>
                  </div>
                </div>

                <div className={styles.payments}>
                  {data.payments.map((payment) => (
                    <article className={styles.paymentCard} key={payment.id}>
                      <div className={styles.paymentTop}>
                        <div>
                          <strong>{payment.provider}</strong>
                          <div className={styles.paymentMeta}>{payment.resource} · {payment.category}</div>
                        </div>
                        <span>
                          {formatAtomicUsdDisplay(
                            atomicOrCents(payment.amount_atomic, payment.amount_cents)
                          )}
                        </span>
                      </div>
                      <div className={styles.paymentBadges}>
                        <span className={payment.decision === "approved" ? styles.approved : styles.rejected}>
                          {payment.decision}
                        </span>
                        <span className={payment.settlement_status === "settled" ? styles.settled : styles.neutral}>
                          {payment.settlement_status}
                        </span>
                      </div>
                      <p className={styles.paymentReason}>{payment.reason}</p>
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
                    </article>
                  ))}
                </div>
              </section>

              {task.result ? (
                <section className={`${styles.panel} ${styles.resultPanel}`}>
                  <p className={styles.label}>FINAL RESULT</p>
                  <h2>Agent answer</h2>
                  <p className={styles.finalResult}>{task.result}</p>
                </section>
              ) : null}
            </aside>
          </section>
        </>
      ) : null}
    </main>
  );
}
