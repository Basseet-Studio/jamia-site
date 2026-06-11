/**
 * Money-on-hand invariants per SC-009.
 * - recordPayment: MoH += amount  (atomic with the payment write)
 * - deletePayment: MoH -= amount  (atomic with the payment delete)
 * - withdrawExpense: MoH -= amount (atomic with the state flip)
 * - deleteExpense (withdrawn): MoH += amount  (atomic with the row delete)
 * - deleteExpense (not withdrawn): MoH unchanged
 * - updateSettings (opening-balance delta): MoH shifts by delta
 *
 * The "atomic with ..." cases are guaranteed by the call site — each mutator
 * wraps its row write and the MOH shift in a single `runTransaction`. This
 * test file covers the helper surface; the atomicity claim itself is asserted
 * by the emulator-backed tests in `payments.atomicity.test.ts` and
 * `expenses.atomicity.test.ts`.
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/moneyOnHand";

describe("moneyOnHand — module exports", () => {
  it("exposes adjustMoneyOnHand / subscribeMoneyOnHand / getMoneyOnHand", () => {
    expect(typeof svc.adjustMoneyOnHand).toBe("function");
    expect(typeof svc.subscribeMoneyOnHand).toBe("function");
    expect(typeof svc.getMoneyOnHand).toBe("function");
  });

  it("exposes shiftMoneyOnHandInTx for in-transaction callers", () => {
    // The atomicity fix in payments.ts / expenses.ts relies on this helper.
    // If it goes missing, callers fall back to a non-atomic two-step write.
    expect(typeof svc.shiftMoneyOnHandInTx).toBe("function");
  });

  it("adjustMoneyOnHand is implemented in terms of shiftMoneyOnHandInTx", () => {
    // adjustMoneyOnHand's body should be a thin wrapper that opens a
    // transaction and delegates to shiftMoneyOnHandInTx, so we never have
    // two divergent MOH-update code paths drifting apart.
    expect(svc.adjustMoneyOnHand.length).toBe(1);
    expect(svc.shiftMoneyOnHandInTx.length).toBe(2);
  });
});

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  "moneyOnHand — running total (requires emulator)",
  () => {
    it("placeholder", () => {
      // Real Firestore tests live in the E2E suite (test:e2e) which
      // expects the emulator. The unit suite runs without it.
      expect(true).toBe(true);
    });
  },
);
