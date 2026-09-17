import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SpendingCategory } from "@/lib/policy/types";

const VALID_CATEGORIES: SpendingCategory[] = [
  "search",
  "data",
  "compute",
  "inference",
  "other",
];

interface UpdatePolicyBody {
  agentId?: string;
  taskBudgetCents?: number;
  dailyBudgetCents?: number;
  maxTransactionCents?: number;
  allowedCategories?: string[];
  blockedProviders?: string[];
}

function validPositiveInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 1_000_000;
}

function normalizeBlockedProviders(providers: string[]) {
  return Array.from(
    new Set(
      providers
        .map((provider) => provider.trim())
        .filter(Boolean)
        .slice(0, 50)
    )
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: UpdatePolicyBody;

  try {
    body = (await request.json()) as UpdatePolicyBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (
    !validPositiveInteger(body.taskBudgetCents) ||
    !validPositiveInteger(body.dailyBudgetCents) ||
    !validPositiveInteger(body.maxTransactionCents)
  ) {
    return NextResponse.json(
      { error: "Budgets must be positive whole cent amounts." },
      { status: 400 }
    );
  }

  const taskBudgetCents = Number(body.taskBudgetCents);
  const dailyBudgetCents = Number(body.dailyBudgetCents);
  const maxTransactionCents = Number(body.maxTransactionCents);

  if (maxTransactionCents > taskBudgetCents) {
    return NextResponse.json(
      { error: "Max transaction cannot exceed the task budget." },
      { status: 400 }
    );
  }

  if (taskBudgetCents > dailyBudgetCents) {
    return NextResponse.json(
      { error: "Task budget cannot exceed the daily budget." },
      { status: 400 }
    );
  }

  const allowedCategories = Array.from(
    new Set((body.allowedCategories ?? []).filter((category) =>
      VALID_CATEGORIES.includes(category as SpendingCategory)
    ))
  );

  if (allowedCategories.length === 0) {
    return NextResponse.json(
      { error: "At least one spending category must be allowed." },
      { status: 400 }
    );
  }

  const blockedProviders = normalizeBlockedProviders(body.blockedProviders ?? []);

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id")
    .eq("id", body.agentId)
    .eq("user_id", userId)
    .single();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { data: previousPolicy, error: previousPolicyError } = await supabase
    .from("policies")
    .select(
      "id,agent_id,task_budget_cents,daily_budget_cents,max_transaction_cents,task_budget_atomic,daily_budget_atomic,max_transaction_atomic,allowed_categories,blocked_providers"
    )
    .eq("agent_id", agent.id)
    .single();

  if (previousPolicyError || !previousPolicy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 });
  }

  const { data: policy, error: updateError } = await supabase
    .from("policies")
    .update({
      task_budget_cents: taskBudgetCents,
      daily_budget_cents: dailyBudgetCents,
      max_transaction_cents: maxTransactionCents,
      allowed_categories: allowedCategories,
      blocked_providers: blockedProviders,
    })
    .eq("id", previousPolicy.id)
    .select(
      "id,agent_id,task_budget_cents,daily_budget_cents,max_transaction_cents,task_budget_atomic,daily_budget_atomic,max_transaction_atomic,allowed_categories,blocked_providers"
    )
    .single();

  if (updateError || !policy) {
    return NextResponse.json(
      { error: updateError?.message ?? "Could not update policy" },
      { status: 500 }
    );
  }

  const { error: auditError } = await supabase.from("audit_events").insert({
    agent_id: agent.id,
    event_type: "policy_updated",
    payload: {
      previous: {
        task_budget_cents: previousPolicy.task_budget_cents,
        daily_budget_cents: previousPolicy.daily_budget_cents,
        max_transaction_cents: previousPolicy.max_transaction_cents,
        task_budget_atomic: previousPolicy.task_budget_atomic,
        daily_budget_atomic: previousPolicy.daily_budget_atomic,
        max_transaction_atomic: previousPolicy.max_transaction_atomic,
        allowed_categories: previousPolicy.allowed_categories,
        blocked_providers: previousPolicy.blocked_providers,
      },
      current: {
        task_budget_cents: policy.task_budget_cents,
        daily_budget_cents: policy.daily_budget_cents,
        max_transaction_cents: policy.max_transaction_cents,
        task_budget_atomic: policy.task_budget_atomic,
        daily_budget_atomic: policy.daily_budget_atomic,
        max_transaction_atomic: policy.max_transaction_atomic,
        allowed_categories: policy.allowed_categories,
        blocked_providers: policy.blocked_providers,
      },
    },
  });

  return NextResponse.json({
    policy,
    auditWarning: auditError ? auditError.message : null,
  });
}
