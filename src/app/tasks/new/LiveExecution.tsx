"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  centsToAtomicUsdc,
  formatAtomicUsdDisplay,
} from "@/lib/money/usdc";
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
    spent_atomic: number | null;
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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function payloadRecord(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function payloadStringArray(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value as string[]
    : [];
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

function payloadMoney(
  payload: Record<string, unknown> | null,
  atomicKey: string,
  centsKey: string
) {
  const atomic = payloadAtomic(payload, atomicKey);
  if (atomic !== null) return formatAtomicUsdDisplay(atomic);

  const cents = payloadNumber(payload, centsKey);
  if (cents !== null && Number.isSafeInteger(cents) && cents >= 0) {
    return formatAtomicUsdDisplay(centsToAtomicUsdc(cents));
  }
  return null;
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
      return "Constraint envelope returned to agent";
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
    const budget = payloadMoney(payload, "budget_atomic", "budget_cents");
    return budget === null
      ? "Execution entered the policy-controlled flow."
      : `Task budget: ${budget}.`;
  }

  if (event.event_type === "resource_discovery_completed") {
    const confidence = payloadText(payload, "confidence");
    const rationale = payloadText(payload, "rationale");
    return `${confidence ? `${confidence.toUpperCase()} confidence · ` : ""}${rationale ?? "Directory discovery completed."}`;
  }

  if (event.event_type === "agent_resource_proposed") {
    const provider = payloadText(payload, "provider");
    const amount = payloadMoney(payload, "amount_atomic", "amount_cents");
    const rationale = payloadText(payload, "rationale");
    const proposal = [provider, amount]
      .filter(Boolean)
      .join(" · ");
    return `${proposal}${proposal && rationale ? " — " : ""}${rationale ?? "Agent selected its next procurement step."}`;
  }

  if (event.event_type === "payment_rejected") {
    const reason =
      payloadText(payload, "reason") ??
      "Deterministic spending policy rejected the proposal.";
    const envelope = payloadRecord(payload, "policy_envelope");
    const change = payloadRecord(envelope, "requiredChange");
    const maxCompliant = payloadAtomic(envelope, "maxCompliantAmountAtomic");
    const retryAllowed = envelope?.retryAllowed === true;

    let correction = "";
    if (change?.field === "amountAtomic" && maxCompliant !== null) {
      correction = ` Retry at or below ${formatAtomicUsdDisplay(maxCompliant)}.`;
    } else if (change?.field === "category") {
      const allowed = payloadStringArray(envelope, "allowedCategories");
      correction = allowed.length
        ? ` Retry using an allowed category: ${allowed.join(", ")}.`
        : "";
    } else if (change?.field === "provider") {
      const blocked = payloadStringArray(envelope, "blockedProviders");
      correction = blocked.length
        ? ` Retry with a provider outside: ${blocked.join(", ")}.`
        : " Retry with another provider.";
    }

    return `${reason} Constraint envelope returned to the agent.${correction}${
      retryAllowed ? " Autonomous retry allowed." : ""
    }`;
  }

  if (event.event_type === "payment_approved") {
    return payloadText(payload, "reason") ?? "All active spending constraints were satisfied.";
  }

  if (event.event_type === "payment_settled") {
    const provider = payloadText(payload, "provider");
    const amount = payloadMoney(payload, "amount_atomic", "amount_cents");
    return `Real x402 settlement${provider ? ` with ${provider}` : ""}${amount ? ` for ${amount}` : ""}.`;
  }

  if (event.event_type === "payment_settlement_failed") {
    return payloadText(payload, "reason") ?? "The authorized payment could not be settled.";
  }

  if (event.event_type === "task_completed") {
    const spent = payloadMoney(payload, "total_spent_atomic", "total_spent_cents");
    return spent === null
      ? "The agent completed the task."
      : `Execution completed with ${spent} settled spend.`;
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
  const [spentAtomic, setSpentAtomic] = useState(0);
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

        const taskSpentAtomic = Number(payload.task.spent_atomic);
        const fallbackSpentAtomic = Number.isSafeInteger(payload.task.spent_cents)
          ? centsToAtomicUsdc(payload.task.spent_cents)
          : 0;

        setEvents(payload.events);
        setStatus(payload.task.status);
        setSpentAtomic(
          Number.isSafeInteger(taskSpentAtomic) && taskSpentAtomic >= 0
            ? taskSpentAtomic
            : fallbackSpentAtomic
        );
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
    if (events.some((event) => event.event_type === "payment_rejected")) {
      return "Agent adapting to constraint envelope";
    }
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
          <small>{formatAtomicUsdDisplay(spentAtomic)} settled</small>
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
