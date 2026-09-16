import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      "id,agent_id,prompt,status,budget_cents,spent_cents,result,created_at,completed_at"
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
    amount_cents: number;
  }> = [];

  if (taskIds.length) {
    const { data: paymentRows, error: paymentsError } = await supabase
      .from("payment_requests")
      .select("task_id,decision,settlement_status,amount_cents")
      .in("task_id", taskIds);

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 });
    }

    payments = paymentRows ?? [];
  }

  const stats = new Map<
    string,
    { approved: number; rejected: number; settled: number; settledCents: number }
  >();

  for (const payment of payments) {
    if (!payment.task_id) continue;
    const current = stats.get(payment.task_id) ?? {
      approved: 0,
      rejected: 0,
      settled: 0,
      settledCents: 0,
    };

    if (payment.decision === "approved") current.approved += 1;
    if (payment.decision === "rejected") current.rejected += 1;
    if (payment.settlement_status === "settled") {
      current.settled += 1;
      current.settledCents += payment.amount_cents;
    }

    stats.set(payment.task_id, current);
  }

  return NextResponse.json({
    tasks: (tasks ?? []).map((task) => ({
      ...task,
      agent_name: agentNames.get(task.agent_id) ?? "Agent",
      activity: stats.get(task.id) ?? {
        approved: 0,
        rejected: 0,
        settled: 0,
        settledCents: 0,
      },
    })),
  });
}
