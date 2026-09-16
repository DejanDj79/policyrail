import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CreateTaskBody {
  agentId?: string;
  prompt?: string;
}

interface CompleteTaskBody {
  taskId?: string;
  result?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: CreateTaskBody;

  try {
    body = (await request.json()) as CreateTaskBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.agentId || !body.prompt?.trim()) {
    return NextResponse.json({ error: "agentId and prompt are required" }, { status: 400 });
  }

  const { data: policy, error: policyError } = await supabase
    .from("policies")
    .select("task_budget_cents")
    .eq("agent_id", body.agentId)
    .single();

  if (policyError) {
    return NextResponse.json({ error: "Agent policy not found" }, { status: 404 });
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      agent_id: body.agentId,
      prompt: body.prompt.trim(),
      budget_cents: policy.task_budget_cents,
      spent_cents: 0,
      status: "running",
    })
    .select("id,agent_id,prompt,budget_cents,spent_cents,status")
    .single();

  if (taskError) {
    return NextResponse.json({ error: taskError.message }, { status: 500 });
  }

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
    .select("id,spent_cents,status,result,completed_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ task });
}
