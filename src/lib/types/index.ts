import type { Timestamp } from "firebase/firestore";

export type AdminRole = "owner" | "admin";

export interface Admin {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  addedAt: Timestamp;
}

export interface Setting {
  defaultContributionTarget: number;
  openingBalance: number;
  currency: string;
}

export interface Household {
  id: string;
  name: string;
  // 002: member census metadata
  memberCount: number;
  memberNames: string[];
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp | null;
  updatedBy: string | null;
}

export interface Family {
  id: string;
  householdId: string;
  name: string;
  contributionTarget: number;
  createdAt: Timestamp;
  createdBy: string;
  active: boolean;
  deletedAt: Timestamp | null;
  deletedBy: string | null;
}

export interface Payment {
  id: string;
  householdId: string;
  familyId: string;
  amount: number;
  date: Timestamp;
  month: string;
  note: string | null;
  recordedAt: Timestamp;
  recordedBy: string;
}

// 002: expense "household" (linked to a household) or "mosque".
export type ExpenseType = "household" | "mosque";
// 002: sub-category on mosque-scoped expenses and templates.
export type MosqueSubCategory = "maintenance" | "salary" | "other";

export interface Expense {
  id: string;
  name: string;
  amount: number;
  date: Timestamp;
  month: string;
  note: string | null;
  isRecurring: boolean;
  recurringId: string | null;
  withdrawn: boolean;
  withdrawnAt: Timestamp | null;
  withdrawnBy: string | null;
  addedAt: Timestamp;
  addedBy: string;
  // 002 fields
  type: ExpenseType;
  householdId: string | null;
  familyId: string | null;
  mosqueSubCategory: MosqueSubCategory | null;
}

export interface RecurringTemplate {
  id: string;
  name: string;
  amount: number;
  description: string | null;
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
  // 002 fields
  type: ExpenseType;
  householdId: string | null;
  familyId: string | null;
  mosqueSubCategory: MosqueSubCategory | null;
}

export type FamilyMonthlyStatus = "Unpaid" | "Partial" | "Met" | "Over";

export interface FamilyMonthlySummary {
  familyId: string;
  month: string;
  totalPaid: number;
  target: number;
  status: FamilyMonthlyStatus;
}

export interface HouseholdMonthlySummary {
  householdId: string;
  month: string;
  totalFamilies: number;
  familiesPaidFull: number;
  familiesPartial: number;
  familiesUnpaid: number;
  totalCollected: number;
  totalTarget: number;
  collectionRate: number | null;
}

export interface MonthlyExpenseSummary {
  month: string;
  totalAdded: number;
  totalWithdrawn: number;
  totalPending: number;
}

export interface AllTimeExpenseSummary {
  totalAdded: number;
  totalWithdrawn: number;
}

export interface MoneyOnHand {
  value: number;
  currency: string;
  asOf: Timestamp;
}

export type RecurringTemplateMonthStatus =
  | "NotAdded"
  | "PendingWithdrawal"
  | "Withdrawn";

export interface RecurringTemplateWithStatus extends RecurringTemplate {
  currentMonthStatus: RecurringTemplateMonthStatus;
  currentMonthExpenseId: string | null;
}

// ============================================================================
// 002: Append-only member-change history (FR-005).
// ============================================================================

export interface HouseholdMemberHistory {
  id: string;
  householdId: string;
  previousCount: number;
  previousNames: string[];
  newCount: number;
  newNames: string[];
  changedAt: Timestamp;
  changedBy: string;
}

// ============================================================================
// 002: Filter for the expenses list (US-2).
// ============================================================================

export interface ExpenseFilter {
  type?: ExpenseType;
  mosqueSubCategory?: MosqueSubCategory;
}

// ============================================================================
// 002: Budget shortfall (US-5).
// ============================================================================

export type ShortfallSeverity = "ok" | "watch" | "risk";

export interface MonthlyBudgetShortfall {
  month: string;
  available: number;
  recurringTotal: number;
  shortfall: number;
  severity: ShortfallSeverity;
  asOf: Timestamp;
}

export interface MonthlyExpenseTotals {
  month: string;
  totalAdded: number;
  totalWithdrawn: number;
  totalPending: number;
  shortfall: MonthlyBudgetShortfall;
}

// ============================================================================
// 002: Calendar view (US-4).
// ============================================================================

export type CalendarTemplateStatus =
  | "NotAdded"
  | "PendingWithdrawal"
  | "Withdrawn";

export interface CalendarTemplateRow {
  template: RecurringTemplate;
  status: CalendarTemplateStatus;
  expenseId: string | null;
}

export interface CalendarAdHocRow {
  expense: Expense;
}

export interface CalendarView {
  month: string;
  templates: CalendarTemplateRow[];
  adHoc: CalendarAdHocRow[];
  shortfall: MonthlyBudgetShortfall | null;
}
