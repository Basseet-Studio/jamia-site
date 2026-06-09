/**
 * Service layer interface — the single contract between UI and data.
 *
 * The UI (Server Components, Client Components, Server Actions) MUST call this
 * service layer. It MUST NOT call Firebase directly. This keeps business
 * invariants (soft-delete, family ID reservation, money-on-hand formula,
 * month-key derivation) in one testable place.
 *
 * See `docs/specs/001-household-finance-dashboard/spec.md` and `data-model.md`.
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// Entity types
// ============================================================================

export type AdminRole = "owner" | "admin";

export interface Admin {
  uid: string; // document id == auth uid
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
  createdAt: Timestamp;
  createdBy: string;
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
  month: string; // "YYYY-MM"
  note: string | null;
  recordedAt: Timestamp;
  recordedBy: string;
}

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
}

export interface RecurringTemplate {
  id: string;
  name: string;
  amount: number;
  description: string | null;
  active: boolean;
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// Derived types (NOT stored in Firestore)
// ============================================================================

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
  collectionRate: number | null; // null when totalTarget == 0
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
// Input types
// ============================================================================

export interface CreateHouseholdInput {
  name: string;
}

export interface CreateFamilyInput {
  householdId: string;
  name: string;
  contributionTarget: number; // admin can override the global default
}

export interface RecordPaymentInput {
  householdId: string;
  familyId: string;
  amount: number;
  date: Date; // date assigned by admin
  note: string | null;
}

export interface CreateExpenseInput {
  name: string;
  amount: number;
  date: Date;
  note: string | null;
  isRecurring: boolean;
  recurringId: string | null;
}

export interface CreateRecurringTemplateInput {
  name: string;
  amount: number;
  description: string | null;
}

export interface UpdateRecurringTemplateInput {
  name?: string;
  amount?: number;
  description?: string | null;
  active?: boolean;
}

export interface UpdateSettingsInput {
  defaultContributionTarget?: number;
  openingBalance?: number;
  currency?: string;
}

// ============================================================================
// Service interface
// ============================================================================

export interface HouseholdFinanceService {
  // ---- Auth bootstrap ----

  /** Get the signed-in admin's profile (or null if not authorised). */
  getCurrentAdmin(): Promise<Admin | null>;

  // ---- Settings ----

  /** Live subscription to the global settings doc. */
  subscribeSettings(callback: (s: Setting | null) => void): () => void;

  updateSettings(uid: string, input: UpdateSettingsInput): Promise<void>;

  // ---- Households ----

  listHouseholds(): Promise<Household[]>;
  subscribeHouseholds(callback: (h: Household[]) => void): () => void;
  getHousehold(id: string): Promise<Household | null>;
  createHousehold(uid: string, input: CreateHouseholdInput): Promise<string>;
  /** Hard delete; cascades to all families + all payments. Confirmation enforced in UI. */
  deleteHousehold(uid: string, householdId: string): Promise<void>;

  // ---- Families ----

  listFamilies(householdId: string): Promise<Family[]>;
  subscribeFamilies(
    householdId: string,
    callback: (f: Family[]) => void
  ): () => void;
  getFamily(householdId: string, familyId: string): Promise<Family | null>;
  /**
   * Create a family. `contributionTarget` defaults to settings.global.defaultContributionTarget
   * if not provided. ID is auto-generated and permanently reserved.
   */
  createFamily(uid: string, input: CreateFamilyInput): Promise<string>;
  /** Soft delete. Preserves all payments. ID never reused. */
  softDeleteFamily(
    uid: string,
    householdId: string,
    familyId: string
  ): Promise<void>;
  /** Update the contribution target. (Per spec FR-009 admin can override at any time.) */
  updateFamilyTarget(
    uid: string,
    householdId: string,
    familyId: string,
    contributionTarget: number
  ): Promise<void>;

  // ---- Payments ----

  listPayments(householdId: string, familyId: string): Promise<Payment[]>;
  subscribePayments(
    householdId: string,
    familyId: string,
    callback: (p: Payment[]) => void
  ): () => void;
  /** Record a payment. `month` is derived from `date` at write time. */
  recordPayment(uid: string, input: RecordPaymentInput): Promise<string>;
  deletePayment(
    uid: string,
    householdId: string,
    familyId: string,
    paymentId: string
  ): Promise<void>;

  // ---- Expenses ----

  listExpenses(month: string | "all"): Promise<Expense[]>;
  subscribeExpenses(
    month: string | "all",
    callback: (e: Expense[]) => void
  ): () => void;
  createExpense(uid: string, input: CreateExpenseInput): Promise<string>;
  /** Withdraw. Sets withdrawn, withdrawnAt, withdrawnBy. Confirmation enforced in UI. */
  withdrawExpense(uid: string, expenseId: string): Promise<void>;
  deleteExpense(uid: string, expenseId: string): Promise<void>;

  // ---- Recurring templates ----

  listRecurringTemplates(activeOnly: boolean): Promise<RecurringTemplate[]>;
  subscribeRecurringTemplates(
    activeOnly: boolean,
    callback: (t: RecurringTemplate[]) => void
  ): () => void;
  listRecurringTemplatesWithStatus(
    month: string
  ): Promise<RecurringTemplateWithStatus[]>;
  createRecurringTemplate(
    uid: string,
    input: CreateRecurringTemplateInput
  ): Promise<string>;
  updateRecurringTemplate(
    uid: string,
    templateId: string,
    input: UpdateRecurringTemplateInput
  ): Promise<void>;
  archiveRecurringTemplate(uid: string, templateId: string): Promise<void>;
  /**
   * Add a template for a month. Creates a new expense with isRecurring=true,
   * recurringId=templateId, withdrawn=false, month=`month`. Refuses if an expense
   * for this template in this month already exists.
   */
  addRecurringForMonth(
    uid: string,
    templateId: string,
    month: string
  ): Promise<string>;

  // ---- Derived (live) ----

  /** Reactive: live money on hand. */
  subscribeMoneyOnHand(callback: (m: MoneyOnHand) => void): () => void;

  /** Reactive: monthly summary for one household. */
  subscribeHouseholdMonthlySummary(
    householdId: string,
    month: string,
    callback: (s: HouseholdMonthlySummary) => void
  ): () => void;

  /** Reactive: per-family status for one household in one month. */
  subscribeFamilyMonthlyStatuses(
    householdId: string,
    month: string,
    callback: (s: FamilyMonthlySummary[]) => void
  ): () => void;

  /** Reactive: monthly or all-time expense summary. */
  subscribeExpenseSummary(
    scope: { kind: "month"; month: string } | { kind: "all" },
    callback: (s: MonthlyExpenseSummary | AllTimeExpenseSummary) => void
  ): () => void;
}
