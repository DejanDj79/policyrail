import { NextResponse } from "next/server";
import {
  atomicUsdcFromDbValue,
  atomicUsdcToExactCents,
} from "@/lib/money/usdc";
import { createClient } from "@/lib/supabase/server";

function requireAtomic(value: unknown, label: string) {
  const atomic = atomicUsdcFromDbValue(value);
  if (atomic === null) throw new Error(`Invalid ${label}`);
  return atomic;
}

function addAtomic(left: number, right: number, label: string) {
  if (left > Number.MAX_SAFE_INTEGER - right) {
    throw new Error(`${label} exceeds JavaScript safe integer range`);
  }
  return left + right;
}

function sumAtomic(rows: Array<{ amount_atomic: unknown }>) {
  return rows.reduce((total, row, index) => {
    const amount = requireAtomic(row.amount_atomic, `settled amount[${index}]`);
    return addAtomic(total, amount, "settled 24h spend");
  }, 0);
}

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id,name,status,description,wallet_address")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const rollingDayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    policyResult,
    recentTasksResult,
    recentPaymentsResult,
    settledDayResult,
    legacySettledDayResult,
    completedTasksResult,
    rejectedPaymentsResult,
    settledPaymentsResult,
    decisionReceiptsResult,
  ] = await Promise.all([
    supabase
      .from("policies")
      .select(
        "id,task_budget_cents,daily_budget_cents,max_transaction_cents,task_budget_atomic,daily_budget_atomic,max_transaction_atomic,allowed_categories,blocked_providers,updated_at"
      )
      .eq("agent_id", agent.id)
      .single(),
    supabase
      .from("tasks")
      .select(
        "id,prompt,status,budget_cents,budget_atomic,spent_cents,spent_atomic,result,created_at,completed_at"
      )
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("payment_requests")
      .select(
        "id,task_id,provider,resource,category,amount_cents,amount_atomic,decision,decision_code,reason,settlement_status,transaction_signature,created_at,settled_at"
      )
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("payment_requests")
      .select("amount_atomic")
      .eq("agent_id", agent.id)
      .eq("settlement_status", "settled")
      .gte("settled_at", rollingDayStart),
    supabase
      .from("payment_requests")
      .select("amount_atomic")
      .eq("agent_id", agent.id)
      .eq("settlement_status", "settled")
      .is("settled_at", null)
      .gte("created_at", rollingDayStart),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .eq("status", "completed"),
    supabase
      .from("payment_requests")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .eq("decision", "rejected"),
    supabase
      .from("payment_requests")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id)
      .eq("settlement_status", "settled"),
    supabase
      .from("policy_decision_receipts")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agent.id),
  ]);

  const firstError = [
    policyResult.error,
    recentTasksResult.error,
    recentPaymentsResult.error,
    settledDayResult.error,
    legacySettledDayResult.error,
    completedTasksResult.error,
    rejectedPaymentsResult.error,
    settledPaymentsResult.error,
    decisionReceiptsResult.error,
  ].find(Boolean);

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  try {
    const settled24hAtomic = addAtomic(
      sumAtomic(settledDayResult.data ?? []),
      sumAtomic(legacySettledDayResult.data ?? []),
      "settled 24h spend"
    );

    const policy = policyResult.data
      ? {
          ...policyResult.data,
          task_budget_atomic: requireAtomic(
            policyResult.data.task_budget_atomic,
            "policy task budget"
          ),
          daily_budget_atomic: requireAtomic(
            policyResult.data.daily_budget_atomic,
            "policy daily budget"
          ),
          max_transaction_atomic: requireAtomic(
            policyResult.data.max_transaction_atomic,
            "policy max transaction"
          ),
        }
      : null;

    const recentTasks = (recentTasksResult.data ?? []).map((task) => ({
      ...task,
      budget_atomic: requireAtomic(task.budget_atomic, "task budget"),
      spent_atomic: requireAtomic(task.spent_atomic, "task spend"),
    }));

    const recentPaymentIds = (recentPaymentsResult.data ?? []).map((payment) => payment.id);
    let settlementNetworkByPayment = new Map<string, string>();

    if (recentPaymentIds.length > 0) {
      const { data: settlementEvents, error: settlementEventsError } = await supabase
        .from("audit_events")
        .select("payment_request_id,payload")
        .in("payment_request_id", recentPaymentIds)
        .eq("event_type", "payment_settled");

      if (settlementEventsError) {
        return NextResponse.json({ error: settlementEventsError.message }, { status: 500 });
      }

      settlementNetworkByPayment = new Map(
        (settlementEvents ?? [])
          .map((event) => {
            const payload =
              event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
                ? event.payload as Record<string, unknown>
                : null;
            const network = typeof payload?.network === "string" ? payload.network : null;
            return event.payment_request_id && network
              ? [event.payment_request_id, network] as const
              : null;
          })
          .filter((entry): entry is readonly [string, string] => entry !== null)
      );
    }

    const recentPayments = (recentPaymentsResult.data ?? []).map((payment) => ({
      ...payment,
      amount_atomic: requireAtomic(payment.amount_atomic, "payment amount"),
      settlement_network: settlementNetworkByPayment.get(payment.id) ?? null,
    }));

    return NextResponse.json({
      agent,
      policy,
      summary: {
        settled24hAtomic,
        settled24hCents: atomicUsdcToExactCents(settled24hAtomic),
        completedTasks: completedTasksResult.count ?? 0,
        rejectedPayments: rejectedPaymentsResult.count ?? 0,
        settledPayments: settledPaymentsResult.count ?? 0,
        decisionReceipts: decisionReceiptsResult.count ?? 0,
      },
      recentTasks,
      recentPayments,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid atomic ledger data" },
      { status: 500 }
    );
  }
}
