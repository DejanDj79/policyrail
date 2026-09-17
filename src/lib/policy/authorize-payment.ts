import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PolicyDecisionCode,
  SpendingCategory,
} from "@/lib/policy/types";

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

interface AtomicAuthorizationResult {
  approved: boolean;
  code: PolicyDecisionCode;
  reason: string;
  remainingTaskBudgetAtomic: number;
  remainingDailyBudgetAtomic: number;
  paymentRequestId: string;
  agentId: string;
  taskId: string;
}

const DECISION_CODES = new Set<PolicyDecisionCode>([
  "APPROVED",
  "TASK_BUDGET_EXCEEDED",
  "DAILY_BUDGET_EXCEEDED",
  "TRANSACTION_LIMIT_EXCEEDED",
  "CATEGORY_NOT_ALLOWED",
  "PROVIDER_BLOCKED",
]);

function safeAtomic(value: unknown, label: string) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value)
        : Number.NaN;

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label} returned by authorization RPC`);
  }

  return parsed;
}

function parseAuthorizationResult(value: unknown): AtomicAuthorizationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid authorization RPC response");
  }

  const result = value as Record<string, unknown>;

  if (typeof result.approved !== "boolean") {
    throw new Error("Invalid authorization approval state");
  }
  if (
    typeof result.code !== "string" ||
    !DECISION_CODES.has(result.code as PolicyDecisionCode)
  ) {
    throw new Error("Invalid authorization decision code");
  }
  if (typeof result.reason !== "string" || !result.reason.trim()) {
    throw new Error("Invalid authorization reason");
  }
  if (
    typeof result.paymentRequestId !== "string" ||
    typeof result.agentId !== "string" ||
    typeof result.taskId !== "string"
  ) {
    throw new Error("Invalid authorization identifiers");
  }

  return {
    approved: result.approved,
    code: result.code as PolicyDecisionCode,
    reason: result.reason,
    remainingTaskBudgetAtomic: safeAtomic(
      result.remainingTaskBudgetAtomic,
      "remaining task budget"
    ),
    remainingDailyBudgetAtomic: safeAtomic(
      result.remainingDailyBudgetAtomic,
      "remaining daily budget"
    ),
    paymentRequestId: result.paymentRequestId,
    agentId: result.agentId,
    taskId: result.taskId,
  };
}

export async function authorizePaymentForTask(
  supabase: SupabaseClient,
  request: AuthorizationRequest
) {
  if (!Number.isSafeInteger(request.amountAtomic) || request.amountAtomic <= 0) {
    throw new Error("Invalid atomic USDC amount");
  }

  const provider = request.provider.trim();
  const resource = request.resource.trim();

  if (!provider || !resource) {
    throw new Error("Invalid payment request");
  }

  const { data, error } = await supabase.rpc("authorize_payment_atomic", {
    p_task_id: request.taskId,
    p_provider: provider,
    p_resource: resource,
    p_category: request.category,
    p_amount_atomic: request.amountAtomic,
  });

  if (error) {
    throw new Error(error.message);
  }

  return parseAuthorizationResult(data);
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
  const { data, error } = await supabase.rpc("fail_payment_settlement", {
    p_payment_request_id: paymentRequestId,
    p_reason: reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
