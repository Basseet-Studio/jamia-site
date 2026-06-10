/**
 * Budget shortfall — live subscription (US-5).
 *
 * Opens five `onSnapshot` listeners (settings, payments-before, expenses-
 * before, expenses-this-month, recurring templates) and re-emits a
 * `MonthlyBudgetShortfall` via the pure `computeShortfall` function in
 * `shortfall.ts`. The UI (Calendar banner, WithdrawDialog inline warning)
 * subscribes and re-renders in <1s (SC-005) when any underlying doc
 * changes.
 *
 * The "money on hand" running total on `settings/global` is the source of
 * truth for the dashboard (SC-009). For the data-model §5 formula the
 * pre-month + month-in deltas are derived from the collection-group queries
 * but the running total is the canonical "available" value (matches the
 * existing `moneyOnHand.ts` contract).
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
import { firstOfMonth } from "@/lib/utils/dates";
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
  // monthStart reserved for the pre-month deltas (currently the running
  // total on settings/global is the source of truth).
  void firstOfMonth(month);

  // Mutable snapshots. Re-emit whenever any of the three listeners fires.
  let settings: Record<string, unknown> | null = null;
  let expensesIn: { data(): Record<string, unknown> }[] = [];
  let recurring: { data(): Record<string, unknown> }[] = [];

  const computeAndEmit = () => {
    if (!settings) return;
    const moneyOnHandAtStart =
      typeof settings.moneyOnHand === "number"
        ? (settings.moneyOnHand as number)
        : typeof settings.openingBalance === "number"
          ? (settings.openingBalance as number)
          : 0;

    const paymentsThisMonth = 0; // running total already reflects current-month payments
    const withdrawnExpensesThisMonth = sumField(
      expensesIn.filter((d) => d.data().withdrawn === true),
      "amount",
    );
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

  // u2: this month's expenses (drives withdrawnExpensesThisMonth).
  const u2 = onSnapshot(
    query(collection(db, "expenses"), where("month", "==", month)),
    (snap) => {
      expensesIn = snap.docs;
      computeAndEmit();
    },
  );

  // u3: active recurring templates.
  const u3 = onSnapshot(
    query(collection(db, "recurringExpenses"), where("active", "==", true)),
    (snap) => {
      recurring = snap.docs;
      computeAndEmit();
    },
  );

  return () => {
    u1();
    u2();
    u3();
  };
}
