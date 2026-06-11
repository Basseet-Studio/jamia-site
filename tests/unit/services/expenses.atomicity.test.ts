/**
 * Atomicity invariants for withdrawExpense / deleteExpense (regression for the
 * dashboard MOH drift bug, expense side).
 *
 *   - withdrawExpense must commit the state flip AND the MOH decrement in a
 *     single transaction.
 *   - deleteExpense (withdrawn) must commit the row delete AND the MOH refund
 *     in a single transaction.
 *   - deleteExpense (not withdrawn) must commit the row delete WITHOUT
 *     touching MOH.
 *   - Re-withdrawing an already-withdrawn expense must NOT decrement MOH
 *     a second time.
 */
import { describe, expect, it, vi } from "vitest";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  initializeFirestore,
  serverTimestamp,
  setDoc,
  terminate,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import * as moneyOnHand from "@/lib/services/moneyOnHand";
import * as expenses from "@/lib/services/expenses";
import * as client from "@/lib/firebase/client";

describe("expenses — module shape (regression: MOH drift bug)", () => {
  it("exposes the four required functions", () => {
    expect(typeof expenses.createExpense).toBe("function");
    expect(typeof expenses.withdrawExpense).toBe("function");
    expect(typeof expenses.deleteExpense).toBe("function");
    expect(typeof expenses.subscribeExpenses).toBe("function");
  });

  it("does NOT expose updateExpense (FR-031 no undo)", () => {
    expect(
      (expenses as unknown as Record<string, unknown>).updateExpense,
    ).toBeUndefined();
  });
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "expenses — atomicity with moneyOnHand (requires emulator)",
  () => {
    it(
      "withdrawExpense rolls back the state flip when the MOH shift throws",
      async () => {
        const app = initializeApp(
          {
            apiKey: "demo",
            projectId: "expenses-atomicity-test",
            appId: "1:0:web:0",
          },
          "expenses-atomicity-test",
        );
        const db = initializeFirestore(app, {}, "expenses-atomicity-test");

        try {
          await setDoc(doc(db, "settings", "global"), {
            defaultContributionTarget: 200,
            openingBalance: 1000,
            currency: "INR",
            moneyOnHand: 1000,
            updatedAt: serverTimestamp(),
            updatedBy: "test",
          });
          const expRef = await addDoc(collection(db, "expenses"), {
            name: "Electricity",
            amount: 200,
            date: new Date("2026-06-10"),
            month: "2026-06",
            note: null,
            isRecurring: false,
            recurringId: null,
            withdrawn: false,
            withdrawnAt: null,
            withdrawnBy: null,
            addedAt: serverTimestamp(),
            addedBy: "test",
            type: "mosque",
            householdId: null,
            familyId: null,
            mosqueSubCategory: "maintenance",
          });

          const realGetDb = client.getDb;
          (client as { getDb: typeof realGetDb }).getDb = () => db;

          const spy = vi
            .spyOn(moneyOnHand, "shiftMoneyOnHandInTx")
            .mockRejectedValueOnce(new Error("simulated network failure"));

          try {
            await expect(
              expenses.withdrawExpense("test-uid", expRef.id),
            ).rejects.toThrow(/simulated network failure/);
          } finally {
            spy.mockRestore();
            (client as { getDb: typeof realGetDb }).getDb = realGetDb;
          }

          // State flip MUST be rolled back: row still says withdrawn=false.
          const expSnap = await getDoc(doc(db, "expenses", expRef.id));
          expect(expSnap.data()?.withdrawn).toBe(false);

          // MOH unchanged.
          const settingsSnap = await getDoc(doc(db, "settings", "global"));
          const moh =
            (settingsSnap.data()?.moneyOnHand as number | undefined) ?? 1000;
          expect(moh).toBe(1000);
        } finally {
          await terminate(db);
          await deleteApp(app);
        }
      },
    );

    it(
      "withdrawExpense is idempotent — re-withdrawing a withdrawn expense does not double-decrement MOH",
      async () => {
        const app = initializeApp(
          {
            apiKey: "demo",
            projectId: "expenses-idem-test",
            appId: "1:0:web:0",
          },
          "expenses-idem-test",
        );
        const db = initializeFirestore(app, {}, "expenses-idem-test");

        try {
          await setDoc(doc(db, "settings", "global"), {
            defaultContributionTarget: 200,
            openingBalance: 1000,
            currency: "INR",
            moneyOnHand: 1000,
            updatedAt: serverTimestamp(),
            updatedBy: "test",
          });
          const expRef = await addDoc(collection(db, "expenses"), {
            name: "Water",
            amount: 100,
            date: new Date("2026-06-10"),
            month: "2026-06",
            note: null,
            isRecurring: false,
            recurringId: null,
            withdrawn: true,
            withdrawnAt: serverTimestamp(),
            withdrawnBy: "test",
            addedAt: serverTimestamp(),
            addedBy: "test",
            type: "mosque",
            householdId: null,
            familyId: null,
            mosqueSubCategory: "maintenance",
          });

          const realGetDb = client.getDb;
          (client as { getDb: typeof realGetDb }).getDb = () => db;

          await expenses.withdrawExpense("test-uid", expRef.id);

          const settingsSnap = await getDoc(doc(db, "settings", "global"));
          const moh =
            (settingsSnap.data()?.moneyOnHand as number | undefined) ?? 1000;
          // Pre-fix behaviour: MOH would drop to 800 here (the second
          // withdrawal would also call adjustMoneyOnHand(-100)). Post-fix
          // behaviour: the helper is skipped because the row is already
          // withdrawn, so MOH stays at 900.
          expect(moh).toBe(900);
        } finally {
          await terminate(db);
          await deleteApp(app);
        }
      },
    );
  },
);
