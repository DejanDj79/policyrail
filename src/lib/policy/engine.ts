import { formatAtomicUsd } from "@/lib/money/usdc";
import type {
  PaymentRequest,
  PolicyDecision,
  SpendingPolicy,
} from "./types";

function assertNonNegativeAtomic(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer atomic USDC amount.`);
  }
}

function assertPositiveAtomic(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer atomic USDC amount.`);
  }
}

function assertPolicyInputs(policy: SpendingPolicy, request: PaymentRequest) {
  assertNonNegativeAtomic(policy.taskBudgetAtomic, "Task budget");
  assertNonNegativeAtomic(policy.dailyBudgetAtomic, "Daily budget");
  assertNonNegativeAtomic(policy.maxTransactionAtomic, "Transaction limit");
  assertPositiveAtomic(request.amountAtomic, "Payment amount");
  assertNonNegativeAtomic(request.taskSpentAtomic, "Task spend");
  assertNonNegativeAtomic(request.dailySpentAtomic, "Daily spend");
}

function result(
  approved: boolean,
  code: PolicyDecision["code"],
  reason: string,
  policy: SpendingPolicy,
  request: PaymentRequest
): PolicyDecision {
  const taskCharge = approved ? request.amountAtomic : 0;
  const dailyCharge = approved ? request.amountAtomic : 0;

  return {
    approved,
    code,
    reason,
    remainingTaskBudgetAtomic: Math.max(
      0,
      policy.taskBudgetAtomic - request.taskSpentAtomic - taskCharge
    ),
    remainingDailyBudgetAtomic: Math.max(
      0,
      policy.dailyBudgetAtomic - request.dailySpentAtomic - dailyCharge
    ),
  };
}

export function evaluatePayment(
  policy: SpendingPolicy,
  request: PaymentRequest
): PolicyDecision {
  assertPolicyInputs(policy, request);

  const provider = request.provider.trim().toLowerCase();
  const blocked = policy.blockedProviders.map((item) =>
    item.trim().toLowerCase()
  );

  if (blocked.includes(provider)) {
    return result(
      false,
      "PROVIDER_BLOCKED",
      `${request.provider} is blocked by policy.`,
      policy,
      request
    );
  }

  if (!policy.allowedCategories.includes(request.category)) {
    return result(
      false,
      "CATEGORY_NOT_ALLOWED",
      `Category "${request.category}" is not allowed by policy.`,
      policy,
      request
    );
  }

  if (request.amountAtomic > policy.maxTransactionAtomic) {
    return result(
      false,
      "TRANSACTION_LIMIT_EXCEEDED",
      `Requested ${formatAtomicUsd(request.amountAtomic)}, above the ${formatAtomicUsd(
        policy.maxTransactionAtomic
      )} per-transaction limit.`,
      policy,
      request
    );
  }

  if (
    request.taskSpentAtomic > policy.taskBudgetAtomic ||
    request.amountAtomic > policy.taskBudgetAtomic - request.taskSpentAtomic
  ) {
    return result(
      false,
      "TASK_BUDGET_EXCEEDED",
      "This purchase would exceed the task budget.",
      policy,
      request
    );
  }

  if (
    request.dailySpentAtomic > policy.dailyBudgetAtomic ||
    request.amountAtomic > policy.dailyBudgetAtomic - request.dailySpentAtomic
  ) {
    return result(
      false,
      "DAILY_BUDGET_EXCEEDED",
      "This purchase would exceed the agent's daily budget.",
      policy,
      request
    );
  }

  return result(
    true,
    "APPROVED",
    "Payment satisfies all active spending policies.",
    policy,
    request
  );
}
