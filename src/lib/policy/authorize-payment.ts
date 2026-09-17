import type { SupabaseClient } from "@supabase/supabase-js";
import {
  atomicUsdcToExactCents,
  formatAtomicUsdc,
} from "@/lib/money/usdc";
import { evaluatePayment } from "@/lib/policy/engine";
import type { SpendingCategory, SpendingPolicy } from "@/lib/policy/types";

const VALID_CATEGORIES: SpendingCategory[] = [
  "search",
  "data",
  "compute",
  "inference",
  "other",
];

export interface AuthorizationRequest {
  taskId: string;
  provider: string;
  resource: string;
  category: SpendingCategory;
  amountAtomic: number;
}

export interface FinalizeSettlementRequest {
  paymentRequestId: string;
  status: "simulated" | "settled";
  transactionSignature?: string | null;
}

export async function authorizePaymentForTask(
  supabase: SupabaseClient,
  request: AuthorizationRequest
) {
  if (!Number.isSafeInteger(request.amountAtomic) || request.amountAtomic <= 0) {
    throw new Error("Invalid atomic USDC amount");
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,agent_id,budget_atomic,spent_atomic,status")
    .eq("id", request.taskId)
    .single();

  if (taskError || !task) {
    throw new Error("Task not found");
  }

  if (task.status !== "running") {
    throw new Error("Task is not running");
  }

  const { data: storedPolicy, error: policyError } = await supabase
    .from("policies")
    .select(
      "task_budget_atomic,daily_budget_atomic,max_transaction_atomic,allowed_categories,blocked_providers"
    )
    .eq("agent_id", task.agent_id)
    .single();

  if (policyError || !storedPolicy) {
    throw new Error("Policy not found");
  }

  const rollingDayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: approvedPayments, error: spendError } = await supabase
    .from("payment_requests")
    .select("amount_atomic")
    .eq("agent_id", task.agent_id)
    .eq("decision", "approved")
    .in("settlement_status", ["simulated", "settled"])
    .gte("created_at", rollingDayStart);

  if (spendError) {
    throw new Error(spendError.message);
  }

  const dailySpentAtomic = (approvedPayments ?? []).reduce(
    (sum, payment) => sum + Number(payment.amount_atomic),
    0
  );

  const policy: SpendingPolicy = {
    taskBudgetAtomic: Math.min(
      Number(task.budget_atomic),
      Number(storedPolicy.task_budget_atomic)
    ),
    dailyBudgetAtomic: Number(storedPolicy.daily_budget_atomic),
    maxTransactionAtomic: Number(storedPolicy.max_transaction_atomic),
    allowedCategories: storedPolicy.allowed_categories.filter((category: string) =>
      VALID_CATEGORIES.includes(category as SpendingCategory)
    ) as SpendingCategory[],
    blockedProviders: storedPolicy.blocked_providers,
  };

  const decision = evaluatePayment(policy, {
    provider: request.provider.trim(),
    resource: request.resource.trim(),
    category: request.category,
    amountAtomic: request.amountAtomic,
    taskSpentAtomic: Number(task.spent_atomic),
    dailySpentAtomic,
  });

  const legacyAmountCents = atomicUsdcToExactCents(request.amountAtomic);

  const { data: paymentRequest, error: paymentInsertError } = await supabase
    .from("payment_requests")
    .insert({
      agent_id: task.agent_id,
      task_id: task.id,
      provider: request.provider.trim(),
      resource: request.resource.trim(),
      category: request.category,
      amount_atomic: request.amountAtomic,
      amount_cents: legacyAmountCents,
      decision: decision.approved ? "approved" : "rejected",
      decision_code: decision.code,
      reason: decision.reason,
      settlement_status: decision.approved ? "authorized" : "not_applicable",
    })
    .select("id")
    .single();

  if (paymentInsertError) {
    throw new Error(paymentInsertError.message);
  }

  const { error: auditError } = await supabase.from("audit_events").insert({
    agent_id: task.agent_id,
    task_id: task.id,
    payment_request_id: paymentRequest.id,
    event_type: decision.approved ? "payment_approved" : "payment_rejected",
    payload: {
      provider: request.provider.trim(),
      resource: request.resource.trim(),
      category: request.category,
      amount_atomic: request.amountAtomic,
      amount_usdc: formatAtomicUsdc(request.amountAtomic),
      amount_cents: legacyAmountCents,
      decision_code: decision.code,
      reason: decision.reason,
      settlement_status: decision.approved ? "authorized" : "not_applicable",
      effective_task_budget_atomic: policy.taskBudgetAtomic,
    },
  });

  if (auditError) {
    throw new Error(auditError.message);
  }

  return {
    ...decision,
    paymentRequestId: paymentRequest.id,
    agentId: task.agent_id,
    taskId: task.id,
  };
}

export async function finalizePaymentSettlement(
  supabase: SupabaseClient,
  request: FinalizeSettlementRequest
) {
  const { data, error } = await supabase.rpc("finalize_payment_settlement", {
    p_payment_request_id: request.paymentRequestId,
    p_settlement_status: request.status,
    p_transaction_signature: request.transactionSignature ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function markPaymentSettlementFailed(
  supabase: SupabaseClient,
  paymentRequestId: string,
  reason: string
) {
  const { data: payment, error: readError } = await supabase
    .from("payment_requests")
    .select("id,agent_id,task_id,settlement_status")
    .eq("id", paymentRequestId)
    .single();

  if (readError || !payment) {
    throw new Error(readError?.message ?? "Payment request not found");
  }

  if (payment.settlement_status !== "authorized") {
    return;
  }

  const { error: updateError } = await supabase
    .from("payment_requests")
    .update({ settlement_status: "failed" })
    .eq("id", paymentRequestId)
    .eq("settlement_status", "authorized");

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: auditError } = await supabase.from("audit_events").insert({
    agent_id: payment.agent_id,
    task_id: payment.task_id,
    payment_request_id: payment.id,
    event_type: "payment_settlement_failed",
    payload: { reason },
  });

  if (auditError) {
    throw new Error(auditError.message);
  }
}
