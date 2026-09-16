"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./live-execution.module.css";

type AuditEvent = {
  id: string;
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type ActivityPayload = {
  task?: {
    status: string;
    spent_cents: number;
  };
  events?: AuditEvent[];
  error?: string;
};

function payloadText(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function payloadNumber(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "number" ? value : null;
}

function eventTitle(event: AuditEvent) {
  const payload = event.payload;

  switch (event.event_type) {
    case "task_created":
      return "Task created";
    case "resource_discovery_completed": {
      const count = payloadNumber(payload, "resource_count") ?? 0;
      return count === 0
        ? "No suitable resources"
        : `Discovery found ${count} resource${count === 1 ? "" : "s"}`;
    }
    case "agent_resource_proposed":
      return `Agent proposed ${payloadText(payload, "resource_name") ?? "resource"}`;
    case "payment_rejected":
      return "PolicyRail blocked payment";
    case "payment_approved":
      return "PolicyRail approved payment";
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
    const budget = payloadNumber(payload, "budget_cents");
    return budget === null
      ? "Execution entered the policy-controlled flow."
      : `Task budget: $${(budget / 100).toFixed(2)}.`;
  }

  if (event.event_type === "resource_discovery_completed") {
    const confidence = payloadText(payload, "confidence");
    const rationale = payloadText(payload, "rationale");
    return `${confidence ? `${confidence.toUpperCase()} confidence · ` : ""}${rationale ?? "Directory discovery completed."}`;
  }

  if (event.event_type === "agent_resource_proposed") {
    const provider = payloadText(payload, "provider");
    const amount = payloadNumber(payload, "amount_cents");
    const rationale = payloadText(payload, "rationale");
    const proposal = [provider, amount === null ? null : `$${(amount / 100).toFixed(2)}`]
      .filter(Boolean)
      .join(" · ");
    return `${proposal}${proposal && rationale ? " — " : ""}${rationale ?? "Agent selected its next procurement step."}`;
  }

  if (event.event_type === "payment_rejected" || event.event_type === "payment_approved") {
    return payloadText(payload, "reason") ?? "Deterministic spending policy evaluated the proposal.";
  }

  if (event.event_type === "payment_settled") {
    const provider = payloadText(payload, "provider");
    const amount = payloadNumber(payload, "amount_cents");
    return `Real x402 settlement${provider ? ` with ${provider}` : ""}${amount === null ? "" : ` for $${(amount / 100).toFixed(2)}`}.`;
  }

  if (event.event_type === "payment_settlement_failed") {
    return payloadText(payload, "reason") ?? "The authorized payment could not be settled.";
  }

  if (event.event_type === "task_completed") {
    const spent = payloadNumber(payload, "total_spent_cents");
    return spent === null
      ? "The agent completed the task."
      : `Execution completed with $${(spent / 100).toFixed(2)} settled spend.`;
  }

  return "Audit event recorded.";
}

function eventTone(event: AuditEvent) {
  if (event.event_type === "payment_rejected" || event.event_type === "payment_settlement_failed") {
    return styles.blocked;
  }
  if (event.event_type === "payment_approved") return styles.approved;
  if (event.event_type === "payment_settled") return styles.settled;
  if (event.event_type === "task_completed") return styles.completed;
  if (event.event_type === "resource_discovery_completed") return styles.discovery;
  return styles.neutral;
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LiveExecution({
  taskId,
  running,
  compact = false,
}: {
  taskId: string;
  running: boolean;
  compact?: boolean;
}) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [status, setStatus] = useState("running");
  const [spentCents, setSpentCents] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      try {
        const response = await fetch(`/api/activity/${taskId}`, { cache: "no-store" });
        const payload = (await response.json()) as ActivityPayload;

        if (!response.ok || !payload.task || !payload.events) {
          throw new Error(payload.error ?? "Could not load live execution.");
        }

        if (cancelled) return;

        setEvents(payload.events);
        setStatus(payload.task.status);
        setSpentCents(payload.task.spent_cents ?? 0);
        setError(null);

        if (running || payload.task.status === "running") {
          timer = setTimeout(refresh, 900);
        }
      } catch (refreshError) {
        if (cancelled) return;
        setError(refreshError instanceof Error ? refreshError.message : "Could not load live execution.");
        if (running) timer = setTimeout(refresh, 1400);
      }
    }

    void refresh();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [taskId, running]);

  useEffect(() => {
    if (!compact || !timelineRef.current) return;
    timelineRef.current.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: events.length > 1 ? "smooth" : "auto",
    });
  }, [compact, events.length]);

  const headline = useMemo(() => {
    if (status === "completed") return "Execution complete";
    if (status === "failed") return "Execution failed";
    if (events.some((event) => event.event_type === "payment_settled")) return "Settling & synthesizing";
    if (events.some((event) => event.event_type === "payment_rejected")) return "Adapting to policy";
    if (events.some((event) => event.event_type === "agent_resource_proposed")) return "Evaluating procurement";
    if (events.some((event) => event.event_type === "resource_discovery_completed")) return "Discovery complete";
    return "Discovering resources";
  }, [events, status]);

  return (
    <section className={`${styles.panel} ${compact ? styles.compact : ""}`} aria-live="polite">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>LIVE EXECUTION</p>
          <h2>{headline}</h2>
        </div>
        <div className={styles.statusBlock}>
          <span className={`${styles.dot} ${status === "running" ? styles.dotLive : ""}`} />
          <strong>{status.toUpperCase()}</strong>
          <small>${(spentCents / 100).toFixed(2)} settled</small>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.timeline} ref={timelineRef}>
        {events.length === 0 ? (
          <div className={styles.waiting}>
            <span className={styles.waitingDot} />
            Waiting for the first audit event…
          </div>
        ) : (
          events.map((event) => (
            <article className={`${styles.event} ${eventTone(event)}`} key={event.id}>
              <div className={styles.eventMarker} />
              <div className={styles.eventContent}>
                <div className={styles.eventTop}>
                  <strong>{eventTitle(event)}</strong>
                  <span>{timeLabel(event.created_at)}</span>
                </div>
                <p>{eventBody(event)}</p>
              </div>
            </article>
          ))
        )}

        {running && status === "running" ? (
          <div className={styles.waiting}>
            <span className={styles.waitingDot} />
            Waiting for the next decision…
          </div>
        ) : null}
      </div>
    </section>
  );
}
