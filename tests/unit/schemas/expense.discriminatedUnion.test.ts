/**
 * Expense `createExpenseSchema` is a Zod discriminated union over `type`
 * (FR-008..FR-010). Two branches:
 *   - "household": requires householdId; familyId optional; mosqueSubCategory = null
 *   - "mosque":    requires mosqueSubCategory; householdId/familyId = null
 *
 * The XOR is enforced by the union, not by the form. The form sets the
 * irrelevant branch's fields to null on type change; the service re-parses
 * on every write.
 */
import { describe, expect, it } from "vitest";
import { createExpenseSchema } from "@/lib/schemas/expense";

const validHousehold = {
  name: "Water share",
  amount: 50,
  date: new Date("2026-06-15"),
  note: null,
  isRecurring: false,
  recurringId: null,
  type: "household" as const,
  householdId: "hh-1",
  familyId: null,
  mosqueSubCategory: null,
};

const validMosque = {
  name: "Imam salary",
  amount: 500,
  date: new Date("2026-06-15"),
  note: null,
  isRecurring: false,
  recurringId: null,
  type: "mosque" as const,
  householdId: null,
  familyId: null,
  mosqueSubCategory: "salary" as const,
};

describe("createExpenseSchema — discriminated union", () => {
  it("accepts a well-formed household branch", () => {
    const r = createExpenseSchema.safeParse(validHousehold);
    expect(r.success).toBe(true);
  });

  it("accepts a well-formed mosque branch", () => {
    const r = createExpenseSchema.safeParse(validMosque);
    expect(r.success).toBe(true);
  });

  it("rejects household branch with empty householdId", () => {
    const r = createExpenseSchema.safeParse({
      ...validHousehold,
      householdId: "",
    });
    expect(r.success).toBe(false);
  });

  it("rejects mosque branch with no sub-category", () => {
    const r = createExpenseSchema.safeParse({
      ...validMosque,
      mosqueSubCategory: null,
    });
    expect(r.success).toBe(false);
  });

  it("rejects mosque branch with an unknown sub-category", () => {
    const r = createExpenseSchema.safeParse({
      ...validMosque,
      mosqueSubCategory: "unknown",
    });
    expect(r.success).toBe(false);
  });

  it("rejects when type is missing", () => {
    const r = createExpenseSchema.safeParse({
      name: "X",
      amount: 10,
      date: new Date(),
      note: null,
      isRecurring: false,
      recurringId: null,
    });
    expect(r.success).toBe(false);
  });

  it("rejects when both mosqueSubCategory and householdId are set (XOR violation)", () => {
    // type = "mosque" but householdId is non-null — discriminated union
    // dispatches to mosqueBranch, which requires householdId === null.
    const r = createExpenseSchema.safeParse({
      ...validMosque,
      householdId: "hh-1",
    });
    expect(r.success).toBe(false);
  });
});
