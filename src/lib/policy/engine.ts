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
    remainingTaskBudgetCents: Math.max(
      0,
      policy.taskBudgetCents -
        request.taskSpentCents -
        (approved ? request.amountCents : 0)
    ),
    remainingDailyBudgetCents: Math.max(
      0,
      policy.dailyBudgetCents -
        request.dailySpentCents -
        (approved ? request.amountCents : 0)
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

  if (request.amountCents > policy.maxTransactionCents) {
    return result(
      false,
      "TRANSACTION_LIMIT_EXCEEDED",
      `Requested $${(request.amountCents / 100).toFixed(2)}, above the $${(
        policy.maxTransactionCents / 100
      ).toFixed(2)} per-transaction limit.`,
      policy,
      request
    );
  }

  if (request.taskSpentCents + request.amountCents > policy.taskBudgetCents) {
    return result(
      false,
      "TASK_BUDGET_EXCEEDED",
      "This purchase would exceed the task budget.",
      policy,
      request
    );
  }

  if (request.dailySpentCents + request.amountCents > policy.dailyBudgetCents) {
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
