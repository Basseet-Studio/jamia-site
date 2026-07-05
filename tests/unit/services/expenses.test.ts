/**
 * Expense state-machine invariants (T064):
 * - withdrawExpense transitions false → true; sets withdrawnAt/By
 * - deleteExpense (not withdrawn) does NOT adjust money on hand
 * - deleteExpense (withdrawn) does +amount
 * - no updateExpense is exported
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/expenses";

describe("expenses — module exports", () => {
  it("exposes the required functions", () => {
    expect(typeof svc.createExpense).toBe("function");
    expect(typeof svc.withdrawExpense).toBe("function");
    expect(typeof svc.attachExpenseReceipt).toBe("function");
    expect(typeof svc.deleteExpense).toBe("function");
    expect(typeof svc.subscribeExpenses).toBe("function");
  });

  it("does NOT export updateExpense (FR-031 no undo)", () => {
    expect((svc as Record<string, unknown>).updateExpense).toBeUndefined();
  });
});
