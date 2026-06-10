/**
 * Budget shortfall — pure function (US-5).
 *
 * The function is intentionally pure (no Firestore, no clock). The
 * subscription in `shortfallSubscription.ts` hydrates the inputs and feeds
 * the output to the UI.
 *
 * Formula (FR-027, data-model.md §5):
 *   moneyOnHandAtStartOfMonth(M) =
 *     settings.global.openingBalance
 *     + Σ payments.amount where date < firstOfMonth(M)
 *     − Σ expenses.amount where date < firstOfMonth(M) AND withdrawn === true
 *
 *   available(M) =
 *     moneyOnHandAtStartOfMonth(M)
 *     + Σ payments.amount where month === M
 *     − Σ expenses.amount where month === M AND withdrawn === true
 *
 *   recurringTotal(M) = Σ recurringExpenses.amount where active === true
 *   shortfall(M) = max(0, recurringTotal(M) − available(M))
 *   severity(M) =
 *     shortfall == 0                       ? "ok"
 *     : shortfall <= 0.10 * recurringTotal ? "watch"
 *     :                                     "risk"
 *
 * Edge cases (all handled):
 *   - Zero active templates → recurringTotal=0, shortfall=0, severity="ok".
 *   - Exact match → severity="ok".
 *   - 10% boundary inclusive (== 0.10 * recurringTotal → "watch").
 *   - Negative available → service does not throw; shortfall may exceed
 *     recurringTotal.
 */
import type { MonthlyBudgetShortfall, ShortfallSeverity } from "@/lib/types";

export interface ComputeShortfallInput {
  month: string;
  moneyOnHandAtStartOfMonth: number;
  paymentsThisMonth: number;
  withdrawnExpensesThisMonth: number;
  recurringTotal: number;
  asOf: import("firebase/firestore").Timestamp;
}

export function computeShortfall(input: ComputeShortfallInput): MonthlyBudgetShortfall {
  const {
    month,
    moneyOnHandAtStartOfMonth,
    paymentsThisMonth,
    withdrawnExpensesThisMonth,
    recurringTotal,
    asOf,
  } = input;

  const available =
    moneyOnHandAtStartOfMonth + paymentsThisMonth - withdrawnExpensesThisMonth;
  const rawShortfall = recurringTotal - available;
  const shortfall = Math.max(0, rawShortfall);

  let severity: ShortfallSeverity;
  if (shortfall === 0) {
    severity = "ok";
  } else if (recurringTotal > 0 && shortfall <= 0.1 * recurringTotal) {
    // 10% boundary inclusive: shortfall <= 0.10 * recurringTotal → "watch".
    severity = "watch";
  } else if (recurringTotal === 0) {
    // Defensive: shortfall > 0 with zero recurring is impossible (max(0,…)),
    // but be explicit.
    severity = "ok";
  } else {
    severity = "risk";
  }

  return { month, available, recurringTotal, shortfall, severity, asOf };
}
