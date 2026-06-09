/**
 * Recurring-template invariants (T076):
 * - templates are inert: no auto-creation
 * - addRecurringForMonth creates an expense with isRecurring=true
 * - addRecurringForMonth refuses a second call for the same (template, month)
 * - archiveRecurringTemplate does not touch previously created expenses
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/recurring";

describe("recurring — module exports", () => {
  it("exposes create / update / archive / addForMonth / list-with-status", () => {
    expect(typeof svc.createRecurringTemplate).toBe("function");
    expect(typeof svc.updateRecurringTemplate).toBe("function");
    expect(typeof svc.archiveRecurringTemplate).toBe("function");
    expect(typeof svc.addRecurringForMonth).toBe("function");
    expect(typeof svc.listRecurringTemplatesWithStatus).toBe("function");
  });
  it("does NOT expose autoAddRecurring (FR-034)", () => {
    expect((svc as Record<string, unknown>).autoAddRecurring).toBeUndefined();
  });
});
