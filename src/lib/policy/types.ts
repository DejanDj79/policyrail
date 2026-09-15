export type SpendingCategory = "search" | "data" | "compute" | "inference" | "other";

export interface SpendingPolicy {
  taskBudgetCents: number;
  dailyBudgetCents: number;
  maxTransactionCents: number;
  allowedCategories: SpendingCategory[];
  blockedProviders: string[];
}

export interface PaymentRequest {
  provider: string;
  resource: string;
  category: SpendingCategory;
  amountCents: number;
  taskSpentCents: number;
  dailySpentCents: number;
}

export type PolicyDecisionCode =
  | "APPROVED"
  | "TASK_BUDGET_EXCEEDED"
  | "DAILY_BUDGET_EXCEEDED"
  | "TRANSACTION_LIMIT_EXCEEDED"
  | "CATEGORY_NOT_ALLOWED"
  | "PROVIDER_BLOCKED";

export interface PolicyDecision {
  approved: boolean;
  code: PolicyDecisionCode;
  reason: string;
  remainingTaskBudgetCents: number;
  remainingDailyBudgetCents: number;
}
