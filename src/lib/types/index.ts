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
  month: string;
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
