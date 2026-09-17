import { NextResponse } from "next/server";
import { atomicUsdcFromDbValue } from "@/lib/money/usdc";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

function requireAtomic(value: unknown, label: string) {
  const atomic = atomicUsdcFromDbValue(value);
  if (atomic === null) throw new Error(`Invalid ${label}`);
  return atomic;
}

export async function GET(_request: Request, context: RouteContext) {
  const { taskId } = await context.params;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id,agent_id,prompt,status,budget_cents,budget_atomic,spent_cents,spent_atomic,result,created_at,completed_at"
    )
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id,name,user_id")
    .eq("id", task.agent_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (agentError) {
    return NextResponse.json({ error: agentError.message }, { status: 500 });
  }

  if (!agent) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const [paymentsResult, eventsResult, receiptsResult] = await Promise.all([
    supabase
      .from("payment_requests")
      .select(
        "id,provider,resource,category,amount_cents,amount_atomic,decision,decision_code,reason,settlement_status,transaction_signature,created_at,settled_at"
      )
      .eq("task_id", task.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("audit_events")
      .select("id,payment_request_id,event_type,payload,created_at")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("policy_decision_receipts")
      .select("id,payment_request_id,policy_id,receipt_version,receipt,receipt_hash,created_at")
      .eq("task_id", task.id)
      .order("created_at", { ascending: true }),
  ]);

  if (paymentsResult.error) {
    return NextResponse.json(
      { error: paymentsResult.error.message },
      { status: 500 }
    );
  }

  if (eventsResult.error) {
    return NextResponse.json(
      { error: eventsResult.error.message },
      { status: 500 }
    );
  }

  if (receiptsResult.error) {
    return NextResponse.json(
      { error: receiptsResult.error.message },
      { status: 500 }
    );
  }

  try {
    return NextResponse.json({
      task: {
        ...task,
        budget_atomic: requireAtomic(task.budget_atomic, "task budget"),
        spent_atomic: requireAtomic(task.spent_atomic, "task spend"),
        agent_name: agent.name,
      },
      payments: (paymentsResult.data ?? []).map((payment) => ({
        ...payment,
        amount_atomic: requireAtomic(payment.amount_atomic, "payment amount"),
      })),
      events: eventsResult.data ?? [],
      receipts: receiptsResult.data ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid atomic ledger data" },
      { status: 500 }
    );
  }
}
