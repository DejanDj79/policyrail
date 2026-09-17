import { NextResponse } from "next/server";
import { centsToAtomicUsdc } from "@/lib/money/usdc";
import { createClient } from "@/lib/supabase/server";

interface CreateTaskBody {
  agentId?: string;
  prompt?: string;
  budgetCents?: number;
}

interface CompleteTaskBody {
  taskId?: string;
  result?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: CreateTaskBody;

  try {
    body = (await request.json()) as CreateTaskBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();

  if (!body.agentId || !prompt) {
    return NextResponse.json({ error: "agentId and prompt are required" }, { status: 400 });
  }

  if (prompt.length > 4000) {
    return NextResponse.json({ error: "Task is too long. Keep it under 4000 characters." }, { status: 400 });
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("id", body.agentId)
    .eq("user_id", userId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .select("task_budget_cents,task_budget_atomic")
    .eq("agent_id", agent.id)
    .single();

  if (policyError || !policy) {
    return NextResponse.json({ error: "Agent policy not found" }, { status: 404 });
  }

  const requestedBudgetCents = body.budgetCents ?? policy.task_budget_cents;

  if (!Number.isInteger(requestedBudgetCents) || requestedBudgetCents <= 0) {
    return NextResponse.json({ error: "Task budget must be a positive whole-cent amount." }, { status: 400 });
  }

  if (requestedBudgetCents > policy.task_budget_cents) {
    return NextResponse.json(
      {
        error: `Task budget cannot exceed the agent policy limit of $${(
          policy.task_budget_cents / 100
        ).toFixed(2)}.`,
      },
      { status: 400 }
    );
  }

  const requestedBudgetAtomic = centsToAtomicUsdc(requestedBudgetCents);

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      agent_id: agent.id,
      prompt,
      budget_cents: requestedBudgetCents,
      spent_cents: 0,
      spent_atomic: 0,
      status: "running",
    })
    .select(
      "id,agent_id,prompt,budget_cents,budget_atomic,spent_cents,spent_atomic,status,created_at"
    )
    .single();

  if (taskError || !task) {
    return NextResponse.json(
      { error: taskError?.message ?? "Could not create task" },
      { status: 500 }
    );
  }

  await supabase.from("audit_events").insert({
    agent_id: agent.id,
    task_id: task.id,
    event_type: "task_created",
    payload: {
      prompt,
      budget_cents: requestedBudgetCents,
      budget_atomic: requestedBudgetAtomic,
      policy_task_budget_cents: policy.task_budget_cents,
      policy_task_budget_atomic: policy.task_budget_atomic,
    },
  });

  return NextResponse.json({ task });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: CompleteTaskBody;

  try {
    body = (await request.json()) as CompleteTaskBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const { data: task, error: updateError } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      result: body.result ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", body.taskId)
    .select("id,spent_cents,spent_atomic,status,result,completed_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ task });
}
