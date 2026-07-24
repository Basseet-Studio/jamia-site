/**
 * Budget shortfall — live subscription (US-5).
 *
 * Opens two `onSnapshot` listeners (settings, recurring templates) and
 * re-emits a `MonthlyBudgetShortfall` via the pure `computeShortfall`
 * function in `shortfall.ts`. The UI (Calendar banner, WithdrawDialog
 * inline warning) subscribes and re-renders in <1s (SC-005) when any
 * underlying doc changes.
 *
 * The "money on hand" running total on `settings/global` is the source of
 * truth for available cash (SC-009). Because that running total already
 * includes this month's payments and withdrawals, both month deltas are
 * passed as 0 so they are not double-counted.
 */
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { computeShortfall } from "@/lib/services/shortfall";
import type { MonthlyBudgetShortfall } from "@/lib/types";

function sumField(
  docs: { data(): Record<string, unknown> }[],
  field: string,
): number {
  return docs.reduce((s, d) => {
    const v = d.data()[field];
    return s + (typeof v === "number" ? (v as number) : 0);
  }, 0);
}

export function subscribeMonthlyShortfall(
  month: string,
  callback: (s: MonthlyBudgetShortfall) => void,
): Unsubscribe {
  const db = getDb();

  // Mutable snapshots. Re-emit whenever any listener fires.
  let settings: Record<string, unknown> | null = null;
  let recurring: { data(): Record<string, unknown> }[] = [];

  const computeAndEmit = () => {
    if (!settings) return;
    const moneyOnHandAtStart =
      typeof settings.moneyOnHand === "number"
        ? (settings.moneyOnHand as number)
        : typeof settings.openingBalance === "number"
          ? (settings.openingBalance as number)
          : 0;

    // Live `moneyOnHand` already includes this month's payments and
    // withdrawals, so both deltas must be zero — otherwise withdrawals are
    // double-subtracted and shortfall is overstated.
    const paymentsThisMonth = 0;
    const withdrawnExpensesThisMonth = 0;
    const recurringTotal = sumField(
      recurring.filter((d) => d.data().active !== false),
      "amount",
    );

    const shortfall = computeShortfall({
      month,
      moneyOnHandAtStartOfMonth: moneyOnHandAtStart,
      paymentsThisMonth,
      withdrawnExpensesThisMonth,
      recurringTotal,
      asOf:
        (settings.updatedAt as Timestamp | undefined) ??
        (serverTimestamp() as unknown as Timestamp),
    });
    callback(shortfall);
  };

  // u1: settings/global (the source of truth for `available`).
  const u1 = onSnapshot(doc(db, "settings", "global"), (snap) => {
    settings = snap.exists() ? snap.data() : {};
    computeAndEmit();
  });

  // u2: active recurring templates.
  const u2 = onSnapshot(
    query(collection(db, "recurringExpenses"), where("active", "==", true)),
    (snap) => {
      recurring = snap.docs;
      computeAndEmit();
    },
  );

  return () => {
    u1();
    u2();
  };
}
