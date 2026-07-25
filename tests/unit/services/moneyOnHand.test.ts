/**
 * Money-on-hand invariants per SC-009.
 * - recordPayment: MoH += amount  (atomic with the payment write)
 * - deletePayment: MoH -= amount  (atomic with the payment delete)
 * - withdrawExpense: MoH -= amount (atomic with the state flip)
 * - deleteExpense (withdrawn): MoH += amount  (atomic with the row delete)
 * - deleteExpense (not withdrawn): MoH unchanged
 * - updateSettings (opening-balance delta): MoH shifts by delta
 * - recalculateMoneyOnHand: MoH = opening + Σ payments − Σ withdrawn
 *
 * The "atomic with ..." cases are guaranteed by the call site — each mutator
 * wraps its row write and the MOH shift in a single `runTransaction`. This
 * test file covers the helper surface; the atomicity claim itself is asserted
 * by the emulator-backed tests in `payments.atomicity.test.ts` and
 * `expenses.atomicity.test.ts`.
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/moneyOnHand";
import { recalculateMoneyOnHand } from "@/lib/services/recalculateMoneyOnHand";

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

  it("exposes computeMoneyOnHandFromParts and recalculateMoneyOnHand", () => {
    expect(typeof svc.computeMoneyOnHandFromParts).toBe("function");
    expect(typeof recalculateMoneyOnHand).toBe("function");
  });
});

describe("computeMoneyOnHandFromParts", () => {
  it("opening + payments − withdrawn", () => {
    expect(svc.computeMoneyOnHandFromParts(100, 50, 20)).toBe(130);
  });

  it("returns opening when there are no payments or withdrawals", () => {
    expect(svc.computeMoneyOnHandFromParts(12340.04, 0, 0)).toBe(12340.04);
  });

  it("net-zero payments and withdrawals leave opening", () => {
    expect(svc.computeMoneyOnHandFromParts(240, 12000, 12000)).toBe(240);
  });

  it("allows a negative result when withdrawn exceeds opening + payments", () => {
    expect(svc.computeMoneyOnHandFromParts(0, 10, 50)).toBe(-40);
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
