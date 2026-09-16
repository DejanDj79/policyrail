import { NextResponse } from "next/server";
import { evaluatePayment } from "@/lib/policy/engine";
import type { SpendingCategory, SpendingPolicy } from "@/lib/policy/types";
import { createClient } from "@/lib/supabase/server";

interface EvaluateBody {
  taskId?: string;
  provider?: string;
  resource?: string;
  category?: SpendingCategory;
  amountCents?: number;
}

const VALID_CATEGORIES: SpendingCategory[] = [
  "search",
  "data",
  "compute",
  "inference",
  "other",
];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: EvaluateBody;

  try {
    body = (await request.json()) as EvaluateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !body.taskId ||
    !body.provider?.trim() ||
    !body.resource?.trim() ||
    !body.category ||
    !VALID_CATEGORIES.includes(body.category) ||
    !Number.isInteger(body.amountCents) ||
    (body.amountCents ?? 0) <= 0
  ) {
    return NextResponse.json({ error: "Invalid payment request" }, { status: 400 });
  }

  const amountCents = body.amountCents as number;

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,agent_id,spent_cents,status")
    .eq("id", body.taskId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "running") {
    return NextResponse.json({ error: "Task is not running" }, { status: 409 });
  }

  const { data: storedPolicy, error: policyError } = await supabase
    .from("policies")
    .select(
      "task_budget_cents,daily_budget_cents,max_transaction_cents,allowed_categories,blocked_providers"
    )
    .eq("agent_id", task.agent_id)
    .single();

  if (policyError || !storedPolicy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const rollingDayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: approvedPayments, error: spendError } = await supabase
    .from("payment_requests")
    .select("amount_cents")
    .eq("agent_id", task.agent_id)
    .eq("decision", "approved")
    .gte("created_at", rollingDayStart);

  if (spendError) {
    return NextResponse.json({ error: spendError.message }, { status: 500 });
  }

  const dailySpentCents = (approvedPayments ?? []).reduce(
    (sum, payment) => sum + payment.amount_cents,
    0
  );

  const policy: SpendingPolicy = {
    taskBudgetCents: storedPolicy.task_budget_cents,
    dailyBudgetCents: storedPolicy.daily_budget_cents,
    maxTransactionCents: storedPolicy.max_transaction_cents,
    allowedCategories: storedPolicy.allowed_categories.filter((category) =>
      VALID_CATEGORIES.includes(category as SpendingCategory)
    ) as SpendingCategory[],
    blockedProviders: storedPolicy.blocked_providers,
  };

  const decision = evaluatePayment(policy, {
    provider: body.provider.trim(),
    resource: body.resource.trim(),
    category: body.category,
    amountCents,
    taskSpentCents: task.spent_cents,
    dailySpentCents,
  });

  const { data: paymentRequest, error: paymentInsertError } = await supabase
    .from("payment_requests")
    .insert({
      agent_id: task.agent_id,
      task_id: task.id,
      provider: body.provider.trim(),
      resource: body.resource.trim(),
      category: body.category,
      amount_cents: amountCents,
      decision: decision.approved ? "approved" : "rejected",
      decision_code: decision.code,
      reason: decision.reason,
    })
    .select("id")
    .single();

  if (paymentInsertError) {
    return NextResponse.json({ error: paymentInsertError.message }, { status: 500 });
  }

  const { error: auditError } = await supabase.from("audit_events").insert({
    agent_id: task.agent_id,
    task_id: task.id,
    payment_request_id: paymentRequest.id,
    event_type: decision.approved ? "payment_approved" : "payment_rejected",
    payload: {
      provider: body.provider.trim(),
      resource: body.resource.trim(),
      category: body.category,
      amount_cents: amountCents,
      decision_code: decision.code,
      reason: decision.reason,
    },
  });

  if (auditError) {
    return NextResponse.json({ error: auditError.message }, { status: 500 });
  }

  if (decision.approved) {
    const { error: taskUpdateError } = await supabase
      .from("tasks")
      .update({ spent_cents: task.spent_cents + amountCents })
      .eq("id", task.id);

    if (taskUpdateError) {
      return NextResponse.json({ error: taskUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    ...decision,
    paymentRequestId: paymentRequest.id,
  });
}
