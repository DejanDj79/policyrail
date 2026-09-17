import { NextResponse } from "next/server";
import { atomicUsdcToExactCents } from "@/lib/money/usdc";
import { createClient } from "@/lib/supabase/server";

function sumAtomic(rows: Array<{ amount_atomic: number | string | null }>) {
  return rows.reduce((total, row) => {
    const amount = Number(row.amount_atomic ?? 0);
    return Number.isSafeInteger(amount) && amount >= 0 ? total + amount : total;
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
  ].find(Boolean);

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const settled24hAtomic =
    sumAtomic(settledDayResult.data ?? []) +
    sumAtomic(legacySettledDayResult.data ?? []);

  return NextResponse.json({
    agent,
    policy: policyResult.data,
    summary: {
      settled24hAtomic,
      settled24hCents: atomicUsdcToExactCents(settled24hAtomic),
      completedTasks: completedTasksResult.count ?? 0,
      rejectedPayments: rejectedPaymentsResult.count ?? 0,
      settledPayments: settledPaymentsResult.count ?? 0,
    },
    recentTasks: recentTasksResult.data ?? [],
    recentPayments: recentPaymentsResult.data ?? [],
  });
}
