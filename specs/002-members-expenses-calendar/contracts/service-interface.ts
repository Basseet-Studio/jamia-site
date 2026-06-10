/**
 * Service interface — 002 delta.
 *
 * Adds (a) household members + member history, (b) expense type
 * (household | mosque) with linkage, (c) monthly calendar view, and
 * (d) budget shortfall service.
 *
 * Inherits everything else from
 * `specs/001-household-finance-dashboard/contracts/service-interface.ts`.
 * This file is additive — it does NOT redeclare v1 types. Importers
 * should import v1 types from the v1 contract file (or from the
 * runtime `src/lib/services/index.ts` barrel, which re-exports them).
 */

import type { Timestamp } from "firebase/firestore";
import type {
  Expense as V1Expense,
  RecurringTemplate as V1RecurringTemplate,
} from "../../001-household-finance-dashboard/contracts/service-interface";

// ============================================================================
// New + modified entity types
// ============================================================================

/** "household" (linked to a household, optionally a family) or "mosque". */
export type ExpenseType = "household" | "mosque";

/** Sub-category on mosque-scoped expenses and templates. */
export type MosqueSubCategory = "maintenance" | "salary" | "other";

/** Household (extended). */
export interface Household {
  id: string;
  name: string;
  memberCount: number;
  memberNames: string[]; // length MUST equal memberCount
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp | null; // last member edit
  updatedBy: string | null;
}

/** Append-only history of member edits. */
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

/** Expense (extended). */
export interface Expense extends V1Expense {
  type: ExpenseType;
  householdId: string | null; // required iff type === "household"
  familyId: string | null; // optional iff type === "household"
  mosqueSubCategory: MosqueSubCategory | null; // required iff type === "mosque"
}

/** Recurring template (extended). */
export interface RecurringTemplate extends V1RecurringTemplate {
  type: ExpenseType;
  householdId: string | null;
  familyId: string | null;
  mosqueSubCategory: MosqueSubCategory | null;
}

// ============================================================================
// Derived types
// ============================================================================

/** Live budget shortfall for a month. */
export type ShortfallSeverity = "ok" | "watch" | "risk";

export interface MonthlyBudgetShortfall {
  month: string; // "YYYY-MM"
  available: number;
  recurringTotal: number;
  shortfall: number;
  severity: ShortfallSeverity;
  asOf: Timestamp;
}

/** Per-month status of one recurring template, used by Calendar. */
export type CalendarTemplateStatus = "NotAdded" | "PendingWithdrawal" | "Withdrawn";

export interface CalendarTemplateRow {
  template: RecurringTemplate;
  status: CalendarTemplateStatus;
  expenseId: string | null; // present iff status !== "NotAdded"
}

/** One row in the Calendar view (an ad-hoc expense for the selected month). */
export interface CalendarAdHocRow {
  expense: Expense; // expense.recurringId === null
}

/** Calendar view data: two groups + shortfall. */
export interface CalendarView {
  month: string;
  templates: CalendarTemplateRow[];
  adHoc: CalendarAdHocRow[];
  shortfall: MonthlyBudgetShortfall | null; // null while computing
}

/** Helper: month totals for the withdraw confirmation dialog. */
export interface MonthlyExpenseTotals {
  month: string;
  totalAdded: number;
  totalWithdrawn: number;
  totalPending: number;
  shortfall: MonthlyBudgetShortfall;
}

// ============================================================================
// Input types
// ============================================================================

export interface UpdateMembersInput {
  memberCount: number; // must equal memberNames.length
  memberNames: string[]; // each 1-80 chars, trimmed
}

export interface CreateExpenseInput {
  name: string;
  amount: number;
  date: Date;
  note: string | null;
  isRecurring: boolean;
  recurringId: string | null;
  type: ExpenseType;
  householdId: string | null; // required iff type === "household"
  familyId: string | null; // optional iff type === "household"
  mosqueSubCategory: MosqueSubCategory | null; // required iff type === "mosque"
}

export interface CreateRecurringTemplateInput {
  name: string;
  amount: number;
  description: string | null;
  type: ExpenseType; // defaults to "mosque" in service
  householdId: string | null;
  familyId: string | null;
  mosqueSubCategory: MosqueSubCategory | null;
}

export interface UpdateRecurringTemplateInput {
  name?: string;
  amount?: number;
  description?: string | null;
  active?: boolean;
  type?: ExpenseType;
  householdId?: string | null;
  familyId?: string | null;
  mosqueSubCategory?: MosqueSubCategory | null;
}

export interface ExpenseFilter {
  type?: ExpenseType;
  mosqueSubCategory?: MosqueSubCategory;
}

// ============================================================================
// Service interface — 002 delta
// ============================================================================

export interface HouseholdFinanceService002 {
  // ---- Household members (US-1) ----

  /**
   * Update the household's memberCount + memberNames AND append a
   * HouseholdMemberHistory doc in a single batched write. The service
   * MUST reject if memberCount !== memberNames.length.
   */
  updateMembers(uid: string, householdId: string, input: UpdateMembersInput): Promise<void>;

  /**
   * Live subscription to the member-change history for a household,
   * newest-first.
   */
  subscribeMemberHistory(
    householdId: string,
    callback: (h: HouseholdMemberHistory[]) => void
  ): () => void;

  // ---- Expense types (US-2) ----

  /** Read one expense, parsed through the 002 schema. */
  getExpense(expenseId: string): Promise<Expense | null>;

  /** Mosque-scoped expense subscription (optionally filtered by sub-category). */
  subscribeMosqueExpenses(
    month: string,
    subCategory: MosqueSubCategory | null,
    callback: (e: Expense[]) => void
  ): () => void;

  /** Household-scoped expense subscription. */
  subscribeHouseholdExpenses(
    householdId: string,
    month: string,
    callback: (e: Expense[]) => void
  ): () => void;

  /**
   * Extended listExpenses with optional filter. v1 callers that pass
   * `month: "all"` still work and ignore the filter.
   */
  listExpenses(
    month: string | "all",
    filter?: ExpenseFilter
  ): Promise<Expense[]>;

  // ---- Recurring templates (type field, US-2 / US-4) ----

  /**
   * Add a template for a month. Creates an expense with isRecurring=true,
   * recurringId=templateId, the template's name/amount/type/linkage,
   * `date = firstOfMonth(selectedMonth)`, `withdrawn = false`. Refuses if
   * an expense for this template in this month already exists.
   */
  addRecurringForMonth(
    uid: string,
    templateId: string,
    month: string
  ): Promise<string>;

  // ---- Calendar view (US-4) ----

  /** Live subscription to the calendar view for a selected month. */
  subscribeCalendarView(
    month: string,
    callback: (v: CalendarView) => void
  ): () => void;

  /** Per-month totals + shortfall for the withdraw confirmation dialog. */
  getMonthlyTotals(month: string): Promise<MonthlyExpenseTotals>;

  // ---- Budget shortfall service (US-5) ----

  /**
   * Pure synchronous function. No Firestore calls. Unit-testable in
   * isolation. Inputs are the four raw numbers + recurringTotal needed
   * by the formula. The subscription below hydrates these from Firestore.
   */
  computeShortfall(args: {
    month: string;
    moneyOnHandAtStartOfMonth: number;
    paymentsThisMonth: number;
    withdrawnExpensesThisMonth: number;
    recurringTotal: number;
    asOf: Timestamp;
  }): MonthlyBudgetShortfall;

  /** Live subscription to the monthly shortfall. */
  subscribeMonthlyShortfall(
    month: string,
    callback: (s: MonthlyBudgetShortfall) => void
  ): () => void;

  // ---- Household hard delete (extended cascade) ----

  /**
   * Hard delete a household. Cascades in chunked batches of 500 to:
   *   - the household doc
   *   - all families under it
   *   - all payments under each family
   *   - all member-history docs under the household
   *   - all expenses where type === "household" AND householdId === hhId
   *
   * Mosque expenses and unrelated households are unaffected.
   * Idempotent: re-running on an already-deleted household is a no-op.
   */
  deleteHousehold(uid: string, householdId: string): Promise<void>;
}
