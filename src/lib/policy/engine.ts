import { formatAtomicUsd } from "@/lib/money/usdc";
import type {
  PaymentRequest,
  PolicyDecision,
  SpendingPolicy,
} from "./types";

function result(
  approved: boolean,
  code: PolicyDecision["code"],
  reason: string,
  policy: SpendingPolicy,
  request: PaymentRequest
): PolicyDecision {
  return {
    approved,
    code,
    reason,
    remainingTaskBudgetAtomic: Math.max(
      0,
      policy.taskBudgetAtomic -
        request.taskSpentAtomic -
        (approved ? request.amountAtomic : 0)
    ),
    remainingDailyBudgetAtomic: Math.max(
      0,
      policy.dailyBudgetAtomic -
        request.dailySpentAtomic -
        (approved ? request.amountAtomic : 0)
    ),
  };
}

export function evaluatePayment(
  policy: SpendingPolicy,
  request: PaymentRequest
): PolicyDecision {
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

  if (request.taskSpentAtomic + request.amountAtomic > policy.taskBudgetAtomic) {
    return result(
      false,
      "TASK_BUDGET_EXCEEDED",
      "This purchase would exceed the task budget.",
      policy,
      request
    );
  }

  if (request.dailySpentAtomic + request.amountAtomic > policy.dailyBudgetAtomic) {
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
