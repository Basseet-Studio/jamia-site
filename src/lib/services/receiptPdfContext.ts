import type {
  ContributionReceiptContext,
  ExpenseReceiptContext,
  PaymentReceiptContext,
} from "@/lib/services/receiptPdf";
import type { Contribution, Expense, Family, Payment } from "@/lib/types";

/** All payments recorded together with `payment` (same coverageGroupId), sorted by month. */
export function paymentReceiptGroup(
  payment: Payment,
  allPayments: Payment[],
): Payment[] {
  if (!payment.coverageGroupId) return [payment];
  const siblings = allPayments.filter(
    (p) =>
      p.coverageGroupId === payment.coverageGroupId &&
      p.familyId === payment.familyId,
  );
  if (!siblings.some((p) => p.id === payment.id)) siblings.push(payment);
  return siblings.sort((a, b) => a.month.localeCompare(b.month));
}

export function buildPaymentReceiptContext(
  payment: Payment,
  opts: {
    householdName: string;
    householdId: string;
    family: Family | null;
    currency: string;
    relatedPayments?: Payment[];
    orgName?: string;
  },
): PaymentReceiptContext {
  return {
    kind: "payment",
    payment,
    householdName: opts.householdName || opts.householdId,
    familyName: opts.family?.name ?? payment.familyId,
    relatedPayments: opts.relatedPayments,
    currency: opts.currency,
    orgName: opts.orgName,
  };
}

export function buildExpenseReceiptContext(
  expense: Expense,
  opts: { currency: string; householdName?: string; orgName?: string },
): ExpenseReceiptContext {
  return {
    kind: "expense",
    expense,
    currency: opts.currency,
    householdName: opts.householdName,
    orgName: opts.orgName,
  };
}

export function buildContributionReceiptContext(
  contribution: Contribution,
  opts: { currency: string; orgName?: string },
): ContributionReceiptContext {
  return {
    kind: "contribution",
    contribution,
    currency: opts.currency,
    orgName: opts.orgName,
  };
}
