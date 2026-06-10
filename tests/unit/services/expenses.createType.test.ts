/**
 * Expenses — module exports for the 002 type field.
 *
 * Mirrors the v1 pattern: a small module-export smoke test that runs without
 * the Firestore emulator, plus a check that the new helper subscriptions
 * are present. The full happy-path lives in the e2e suite (test:e2e).
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/expenses";

describe("expenses — module exports (002 delta)", () => {
  it("still exposes the four v1 functions", () => {
    expect(typeof svc.createExpense).toBe("function");
    expect(typeof svc.withdrawExpense).toBe("function");
    expect(typeof svc.deleteExpense).toBe("function");
    expect(typeof svc.subscribeExpenses).toBe("function");
  });

  it("exposes the 002 type-aware subscriptions + filter", () => {
    expect(typeof svc.subscribeHouseholdExpenses).toBe("function");
    expect(typeof svc.subscribeMosqueExpenses).toBe("function");
    expect(typeof svc.listHouseholdExpenses).toBe("function");
    expect(typeof svc.getExpense).toBe("function");
  });

  it("does NOT expose updateExpense (FR-031 no undo)", () => {
    expect((svc as Record<string, unknown>).updateExpense).toBeUndefined();
  });
});
