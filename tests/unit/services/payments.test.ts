/**
 * Payment invariants (T083):
 * - month is derived from date at write time
 * - no updatePayment is exported
 * - delete updates money on hand
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/payments";

describe("payments — module exports", () => {
  it("exposes recordPayment + deletePayment + subscriptions", () => {
    expect(typeof svc.recordPayment).toBe("function");
    expect(typeof svc.deletePayment).toBe("function");
    expect(typeof svc.subscribePayments).toBe("function");
    expect(typeof svc.subscribeFamilyPaymentsByMonth).toBe("function");
  });

  it("does NOT export updatePayment (FR-020)", () => {
    expect((svc as Record<string, unknown>).updatePayment).toBeUndefined();
  });
});
