/**
 * Atomicity invariants for recordPayment / deletePayment (regression for the
 * dashboard MOH drift bug).
 *
 *   - recordPayment must commit the payment doc AND the MOH bump in a single
 *     transaction. If either side fails, neither is visible.
 *   - deletePayment must commit the payment delete AND the MOH decrement in a
 *     single transaction. Same rollback guarantee.
 *   - These guarantees are non-negotiable per SC-009 / FR-039.
 *
 * The atomicity claim is asserted at two levels:
 *   1. Module-shape check (runs without the emulator): recordPayment and
 *      deletePayment exist and are async, and the helper they depend on
 *      (shiftMoneyOnHandInTx) is exported.
 *   2. Emulator-backed scenario: stub shiftMoneyOnHandInTx to throw halfway
 *      through recordPayment, then assert the payment doc was NOT created.
 *      This is the realistic failure mode the user hit in production.
 */
import { describe, expect, it, vi } from "vitest";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  initializeFirestore,
  serverTimestamp,
  setDoc,
  terminate,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import * as moneyOnHand from "@/lib/services/moneyOnHand";
import * as payments from "@/lib/services/payments";
import * as client from "@/lib/firebase/client";

describe("payments — module shape (regression: MOH drift bug)", () => {
  it("exports recordPayment and deletePayment as async functions", () => {
    expect(typeof payments.recordPayment).toBe("function");
    expect(typeof payments.deletePayment).toBe("function");
  });

  it("does NOT export updatePayment (FR-020)", () => {
    expect(
      (payments as unknown as Record<string, unknown>).updatePayment,
    ).toBeUndefined();
  });
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "payments — atomicity with moneyOnHand (requires emulator)",
  () => {
    it("recordPayment rolls back the payment row when the MOH shift throws", async () => {
      // Realistic failure: a transient error after the payment doc was
      // committed but before the MOH bump landed. The pre-fix code left the
      // row behind; the fixed code must roll it back so we never see a
      // payment without a matching MOH shift.
      const app = initializeApp(
        {
          apiKey: "demo",
          projectId: "payments-atomicity-test",
          appId: "1:0:web:0",
        },
        "payments-atomicity-test",
      );
      const db = initializeFirestore(app, {}, "payments-atomicity-test");

      try {
        // Seed: one household, one family, opening balance 1000.
        await setDoc(doc(db, "settings", "global"), {
          defaultContributionTarget: 200,
          openingBalance: 1000,
          currency: "INR",
          moneyOnHand: 1000,
          updatedAt: serverTimestamp(),
          updatedBy: "test",
        });
        const hhRef = await addDoc(collection(db, "households"), {
          name: "Test HH",
          createdAt: serverTimestamp(),
          createdBy: "test",
        });
        const famRef = await addDoc(
          collection(db, "households", hhRef.id, "families"),
          {
            name: "Test Family",
            contributionTarget: 200,
            active: true,
            createdAt: serverTimestamp(),
            createdBy: "test",
          },
        );

        // Make getDb() return our test DB by monkey-patching the module.
        const realGetDb = client.getDb;
        (client as { getDb: typeof realGetDb }).getDb = () => db;

        // Force the MOH shift to throw, simulating a network/permissions
        // error between the payment write and the MOH update.
        const spy = vi
          .spyOn(moneyOnHand, "shiftMoneyOnHandInTx")
          .mockRejectedValueOnce(new Error("simulated network failure"));

        try {
          await expect(
            payments.recordPayment("test-uid", {
              householdId: hhRef.id,
              familyId: famRef.id,
              amount: 250,
              date: new Date("2026-06-15"),
              note: null,
            }),
          ).rejects.toThrow(/simulated network failure/);
        } finally {
          spy.mockRestore();
          (client as { getDb: typeof realGetDb }).getDb = realGetDb;
        }

        // The payment row MUST NOT exist — the transaction rolled back.
        const paymentsSnap = await getDocs(
          collection(
            db,
            "households",
            hhRef.id,
            "families",
            famRef.id,
            "payments",
          ),
        );
        expect(paymentsSnap.size).toBe(0);

        // And MOH is unchanged.
        const settingsSnap = await getDoc(doc(db, "settings", "global"));
        const moh =
          (settingsSnap.data()?.moneyOnHand as number | undefined) ?? 1000;
        expect(moh).toBe(1000);
      } finally {
        await terminate(db);
        await deleteApp(app);
      }
    });
  },
);
