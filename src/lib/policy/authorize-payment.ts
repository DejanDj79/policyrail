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

export interface PolicySimulationRequest {
  agentId: string;
  provider: string;
  category: SpendingCategory;
  amountAtomic: number;
}

export interface FinalizeSettlementRequest {
  paymentRequestId: string;
  status: "simulated" | "settled";
  transactionSignature?: string | null;
}

export interface PolicyRequiredChange {
  field: "provider" | "category" | "amountAtomic";
  operator: "not_in" | "in" | "lte";
  maxAtomic?: number;
  allowedCategories?: SpendingCategory[];
  blockedProviders?: string[];
}

export interface PolicyConstraintEnvelope {
  policyId: string;
  policyUpdatedAt: string;
  effectiveTaskBudgetAtomic: number;
  dailyBudgetAtomic: number;
  maxTransactionAtomic: number;
  remainingTaskBudgetAtomic: number;
  remainingDailyBudgetAtomic: number;
  maxCompliantAmountAtomic: number;
  allowedCategories: SpendingCategory[];
  blockedProviders: string[];
  providerAllowed: boolean;
  categoryAllowed: boolean;
  retryAllowed: boolean;
  requiredChange: PolicyRequiredChange | null;
}

interface AtomicAuthorizationResult {
  approved: boolean;
  code: PolicyDecisionCode;
  reason: string;
  remainingTaskBudgetAtomic: number;
  remainingDailyBudgetAtomic: number;
  policyEnvelope: PolicyConstraintEnvelope;
  paymentRequestId: string;
  agentId: string;
  taskId: string;
}

export interface PolicySimulationResult {
  simulation: true;
  ledgerMutated: false;
  approved: boolean;
  code: PolicyDecisionCode;
  reason: string;
  policyEnvelope: PolicyConstraintEnvelope;
}

const DECISION_CODES = new Set<PolicyDecisionCode>([
  "APPROVED",
  "TASK_BUDGET_EXCEEDED",
  "DAILY_BUDGET_EXCEEDED",
  "TRANSACTION_LIMIT_EXCEEDED",
  "CATEGORY_NOT_ALLOWED",
  "PROVIDER_BLOCKED",
]);

const SPENDING_CATEGORIES = new Set<SpendingCategory>([
  "search",
  "data",
  "compute",
  "inference",
  "other",
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

function stringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Invalid ${label} returned by authorization RPC`);
  }
  return value as string[];
}

function categoryArray(value: unknown) {
  const values = stringArray(value, "allowed categories");
  if (!values.every((item) => SPENDING_CATEGORIES.has(item as SpendingCategory))) {
    throw new Error("Invalid allowed category returned by authorization RPC");
  }
  return values as SpendingCategory[];
}

function parseRequiredChange(value: unknown): PolicyRequiredChange | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid policy required change");
  }

  const change = value as Record<string, unknown>;
  const field = change.field;
  const operator = change.operator;

  if (
    field !== "provider" &&
    field !== "category" &&
    field !== "amountAtomic"
  ) {
    throw new Error("Invalid policy required-change field");
  }
  if (operator !== "not_in" && operator !== "in" && operator !== "lte") {
    throw new Error("Invalid policy required-change operator");
  }

  const parsed: PolicyRequiredChange = { field, operator };
  if (change.maxAtomic !== undefined) {
    parsed.maxAtomic = safeAtomic(change.maxAtomic, "required-change max amount");
  }
  if (change.allowedCategories !== undefined) {
    parsed.allowedCategories = categoryArray(change.allowedCategories);
  }
  if (change.blockedProviders !== undefined) {
    parsed.blockedProviders = stringArray(change.blockedProviders, "blocked providers");
  }
  return parsed;
}

export function parsePolicyEnvelope(value: unknown): PolicyConstraintEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid policy constraint envelope");
  }

  const envelope = value as Record<string, unknown>;
  if (
    typeof envelope.policyId !== "string" ||
    typeof envelope.policyUpdatedAt !== "string" ||
    typeof envelope.providerAllowed !== "boolean" ||
    typeof envelope.categoryAllowed !== "boolean" ||
    typeof envelope.retryAllowed !== "boolean"
  ) {
    throw new Error("Invalid policy constraint envelope metadata");
  }

  return {
    policyId: envelope.policyId,
    policyUpdatedAt: envelope.policyUpdatedAt,
    effectiveTaskBudgetAtomic: safeAtomic(
      envelope.effectiveTaskBudgetAtomic,
      "effective task budget"
    ),
    dailyBudgetAtomic: safeAtomic(envelope.dailyBudgetAtomic, "daily budget"),
    maxTransactionAtomic: safeAtomic(
      envelope.maxTransactionAtomic,
      "max transaction"
    ),
    remainingTaskBudgetAtomic: safeAtomic(
      envelope.remainingTaskBudgetAtomic,
      "remaining task budget"
    ),
    remainingDailyBudgetAtomic: safeAtomic(
      envelope.remainingDailyBudgetAtomic,
      "remaining daily budget"
    ),
    maxCompliantAmountAtomic: safeAtomic(
      envelope.maxCompliantAmountAtomic,
      "max compliant amount"
    ),
    allowedCategories: categoryArray(envelope.allowedCategories),
    blockedProviders: stringArray(envelope.blockedProviders, "blocked providers"),
    providerAllowed: envelope.providerAllowed,
    categoryAllowed: envelope.categoryAllowed,
    retryAllowed: envelope.retryAllowed,
    requiredChange: parseRequiredChange(envelope.requiredChange),
  };
}

function parseDecisionFields(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid policy decision RPC response");
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

  return {
    raw: result,
    approved: result.approved,
    code: result.code as PolicyDecisionCode,
    reason: result.reason,
    policyEnvelope: parsePolicyEnvelope(result.policyEnvelope),
  };
}

function parseAuthorizationResult(value: unknown): AtomicAuthorizationResult {
  const parsed = parseDecisionFields(value);
  const result = parsed.raw;

  if (
    typeof result.paymentRequestId !== "string" ||
    typeof result.agentId !== "string" ||
    typeof result.taskId !== "string"
  ) {
    throw new Error("Invalid authorization identifiers");
  }

  return {
    approved: parsed.approved,
    code: parsed.code,
    reason: parsed.reason,
    remainingTaskBudgetAtomic: safeAtomic(
      result.remainingTaskBudgetAtomic,
      "remaining task budget"
    ),
    remainingDailyBudgetAtomic: safeAtomic(
      result.remainingDailyBudgetAtomic,
      "remaining daily budget"
    ),
    policyEnvelope: parsed.policyEnvelope,
    paymentRequestId: result.paymentRequestId,
    agentId: result.agentId,
    taskId: result.taskId,
  };
}

function parsePolicySimulationResult(value: unknown): PolicySimulationResult {
  const parsed = parseDecisionFields(value);
  const result = parsed.raw;

  if (result.simulation !== true || result.ledgerMutated !== false) {
    throw new Error("Invalid policy simulation markers");
  }

  return {
    simulation: true,
    ledgerMutated: false,
    approved: parsed.approved,
    code: parsed.code,
    reason: parsed.reason,
    policyEnvelope: parsed.policyEnvelope,
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

export async function simulatePaymentPolicy(
  supabase: SupabaseClient,
  request: PolicySimulationRequest
) {
  if (!Number.isSafeInteger(request.amountAtomic) || request.amountAtomic <= 0) {
    throw new Error("Invalid atomic USDC amount");
  }

  const agentId = request.agentId.trim();
  const provider = request.provider.trim();

  if (!agentId || !provider || !SPENDING_CATEGORIES.has(request.category)) {
    throw new Error("Invalid policy simulation request");
  }

  const { data, error } = await supabase.rpc("simulate_payment_atomic", {
    p_agent_id: agentId,
    p_provider: provider,
    p_category: request.category,
    p_amount_atomic: request.amountAtomic,
  });

  if (error) {
    throw new Error(error.message);
  }

  return parsePolicySimulationResult(data);
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
