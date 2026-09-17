export type SpendingCategory = "search" | "data" | "compute" | "inference" | "other";

export interface SpendingPolicy {
  taskBudgetAtomic: number;
  dailyBudgetAtomic: number;
  maxTransactionAtomic: number;
  allowedCategories: SpendingCategory[];
  blockedProviders: string[];
}

export interface PaymentRequest {
  provider: string;
  resource: string;
  category: SpendingCategory;
  amountAtomic: number;
  taskSpentAtomic: number;
  dailySpentAtomic: number;
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
  remainingTaskBudgetAtomic: number;
  remainingDailyBudgetAtomic: number;
}
