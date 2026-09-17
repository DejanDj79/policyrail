import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ taskId: string }>;
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

  const [paymentsResult, eventsResult] = await Promise.all([
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

  return NextResponse.json({
    task: {
      ...task,
      agent_name: agent.name,
    },
    payments: paymentsResult.data ?? [],
    events: eventsResult.data ?? [],
  });
}
