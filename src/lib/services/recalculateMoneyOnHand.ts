/**
 * Rebuild money on hand from source documents (admin Settings action).
 *
 * Kept separate from `moneyOnHand.ts` so payments/expenses can import the
 * running-total helpers without a circular dependency.
 */
import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { listExpenses } from "@/lib/services/expenses";
import { listFamilies } from "@/lib/services/families";
import { listAllHouseholds } from "@/lib/services/households";
import {
  computeMoneyOnHandFromParts,
  type RecalculateMoneyOnHandResult,
} from "@/lib/services/moneyOnHand";
import { listPayments } from "@/lib/services/payments";

export type { RecalculateMoneyOnHandResult };

/**
 * Rebuild `settings/global.moneyOnHand` from source documents:
 *   openingBalance + Σ all payments (all households/families) − Σ withdrawn expenses
 *
 * Walks nested payment paths (same pattern as Excel export) so soft-deleted
 * households and families are included. Does not invent a zero — leftover
 * Varisankya or opening balance remain in the total.
 */
export async function recalculateMoneyOnHand(
  uid: string,
): Promise<RecalculateMoneyOnHandResult> {
  const households = await listAllHouseholds();
  const familiesByHousehold = await Promise.all(
    households.map((h) => listFamilies(h.id)),
  );
  const families = familiesByHousehold.flat();
  const paymentsByFamily = await Promise.all(
    families.map((f) => listPayments(f.householdId, f.id)),
  );
  const paymentsSum = paymentsByFamily
    .flat()
    .reduce((sum, p) => sum + p.amount, 0);

  const expenses = await listExpenses("all");
  const withdrawnSum = expenses
    .filter((e) => e.withdrawn)
    .reduce((sum, e) => sum + e.amount, 0);

  const ref = doc(getDb(), "settings", "global");

  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error(
        "settings/global not initialised — run seed:settings first",
      );
    }
    const data = snap.data() as Record<string, unknown>;
    const openingBalance =
      typeof data.openingBalance === "number" ? data.openingBalance : 0;
    const previous =
      typeof data.moneyOnHand === "number" ? data.moneyOnHand : openingBalance;
    const next = computeMoneyOnHandFromParts(
      openingBalance,
      paymentsSum,
      withdrawnSum,
    );

    tx.update(ref, {
      moneyOnHand: next,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });

    return {
      previous,
      next,
      openingBalance,
      paymentsSum,
      withdrawnSum,
    };
  });
}
