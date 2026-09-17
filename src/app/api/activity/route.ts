import { NextResponse } from "next/server";
import { atomicUsdcFromDbValue } from "@/lib/money/usdc";
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

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id,name")
    .eq("user_id", userId);

  if (agentsError) {
    return NextResponse.json({ error: agentsError.message }, { status: 500 });
  }

  if (!agents?.length) {
    return NextResponse.json({ tasks: [] });
  }

  const agentIds = agents.map((agent) => agent.id);
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select(
      "id,agent_id,prompt,status,budget_cents,budget_atomic,spent_cents,spent_atomic,result,created_at,completed_at"
    )
    .in("agent_id", agentIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  const taskIds = (tasks ?? []).map((task) => task.id);
  let payments: Array<{
    task_id: string | null;
    decision: string;
    settlement_status: string;
    amount_cents: number | null;
    amount_atomic: unknown;
  }> = [];

  if (taskIds.length) {
    const { data: paymentRows, error: paymentsError } = await supabase
      .from("payment_requests")
      .select("task_id,decision,settlement_status,amount_cents,amount_atomic")
      .in("task_id", taskIds);

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 });
    }

    payments = paymentRows ?? [];
  }

  const stats = new Map<
    string,
    { approved: number; rejected: number; settled: number; settledAtomic: number }
  >();

  try {
    for (const payment of payments) {
      if (!payment.task_id) continue;
      const current = stats.get(payment.task_id) ?? {
        approved: 0,
        rejected: 0,
        settled: 0,
        settledAtomic: 0,
      };

      if (payment.decision === "approved") current.approved += 1;
      if (payment.decision === "rejected") current.rejected += 1;
      if (payment.settlement_status === "settled") {
        current.settled += 1;
        current.settledAtomic = addAtomic(
          current.settledAtomic,
          requireAtomic(payment.amount_atomic, "settled payment amount"),
          "task settled spend"
        );
      }

      stats.set(payment.task_id, current);
    }

    return NextResponse.json({
      tasks: (tasks ?? []).map((task) => ({
        ...task,
        budget_atomic: requireAtomic(task.budget_atomic, "task budget"),
        spent_atomic: requireAtomic(task.spent_atomic, "task spend"),
        agent_name: agentNames.get(task.agent_id) ?? "Agent",
        activity: stats.get(task.id) ?? {
          approved: 0,
          rejected: 0,
          settled: 0,
          settledAtomic: 0,
        },
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid atomic ledger data" },
      { status: 500 }
    );
  }
}
