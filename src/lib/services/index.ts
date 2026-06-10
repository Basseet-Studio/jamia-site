/**
 * Service barrel — convenience re-exports for tests + screens.
 * Per spec: each function lives in its own module; this file is a thin facade.
 */
export * from "@/lib/services/admins";
export * from "@/lib/services/settings";
export * from "@/lib/services/households";
export * from "@/lib/services/families";
export * from "@/lib/services/payments";
export * from "@/lib/services/expenses";
export * from "@/lib/services/recurring";
export * from "@/lib/services/moneyOnHand";
export * from "@/lib/services/derived";

// 002: re-exported types for downstream convenience (US-2 / US-4 / US-5).
export type {
  ExpenseType,
  MosqueSubCategory,
  ExpenseFilter,
  HouseholdMemberHistory,
  MonthlyBudgetShortfall,
  ShortfallSeverity,
  MonthlyExpenseTotals,
  CalendarTemplateStatus,
  CalendarTemplateRow,
  CalendarAdHocRow,
  CalendarView,
} from "@/lib/types";
