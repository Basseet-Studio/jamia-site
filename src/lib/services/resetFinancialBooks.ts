/**
 * Reset financial books to zero while keeping members (households + families).
 *
 * Deletes every payment and expense document, then sets
 * `openingBalance` and `moneyOnHand` to 0. Does not soft-delete or remove
 * households/families.
 *
 * Uses raw batch deletes (not deletePayment / deleteExpense) so MoH is not
 * shifted N times — the final settings write sets the canonical total.
 */
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import { listAllHouseholds } from "@/lib/services/households";
import { listFamilies } from "@/lib/services/families";
import { listPayments } from "@/lib/services/payments";

export type ResetFinancialBooksResult = {
  deletedPayments: number;
  deletedExpenses: number;
  previousMoneyOnHand: number;
  previousOpeningBalance: number;
};

const BATCH_LIMIT = 400;

async function deletePaths(paths: string[]): Promise<void> {
  const db = getDb();
  for (let i = 0; i < paths.length; i += BATCH_LIMIT) {
    const chunk = paths.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const path of chunk) {
      batch.delete(doc(db, path));
    }
    await batch.commit();
  }
}

async function listAllPaymentPaths(): Promise<string[]> {
  const db = getDb();
  try {
    const snap = await getDocs(collectionGroup(db, "payments"));
    return snap.docs.map((d) => d.ref.path);
  } catch {
    const households = await listAllHouseholds();
    const families = (
      await Promise.all(households.map((h) => listFamilies(h.id)))
    ).flat();
    const nested = await Promise.all(
      families.map((f) => listPayments(f.householdId, f.id)),
    );
    const paths: string[] = [];
    for (let i = 0; i < families.length; i++) {
      const fam = families[i]!;
      for (const p of nested[i]!) {
        paths.push(
          `households/${fam.householdId}/families/${fam.id}/payments/${p.id}`,
        );
      }
    }
    return paths;
  }
}

/**
 * Wipe all Varisankya + Chelavakal and zero opening/MoH.
 * Members (households + families) are left untouched.
 */
export async function resetFinancialBooksToZero(
  uid: string,
): Promise<ResetFinancialBooksResult> {
  const db = getDb();
  const settingsRef = doc(db, "settings", "global");
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    throw new Error(
      "settings/global not initialised — run seed:settings first",
    );
  }
  const data = settingsSnap.data() as Record<string, unknown>;
  const previousOpeningBalance =
    typeof data.openingBalance === "number" ? data.openingBalance : 0;
  const previousMoneyOnHand =
    typeof data.moneyOnHand === "number"
      ? data.moneyOnHand
      : previousOpeningBalance;

  const paymentPaths = await listAllPaymentPaths();
  const expenseSnap = await getDocs(collection(db, "expenses"));
  const expensePaths = expenseSnap.docs.map((d) => d.ref.path);

  await deletePaths(paymentPaths);
  await deletePaths(expensePaths);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(settingsRef);
    if (!snap.exists()) {
      throw new Error(
        "settings/global not initialised — run seed:settings first",
      );
    }
    tx.update(settingsRef, {
      openingBalance: 0,
      moneyOnHand: 0,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  });

  return {
    deletedPayments: paymentPaths.length,
    deletedExpenses: expensePaths.length,
    previousMoneyOnHand,
    previousOpeningBalance,
  };
}
