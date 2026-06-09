import { describe, expect, it } from "vitest";
import { recordPaymentSchema } from "@/lib/schemas/payment";
import { createExpenseSchema } from "@/lib/schemas/expense";
import { createRecurringTemplateSchema } from "@/lib/schemas/recurringTemplate";
import { createHouseholdSchema } from "@/lib/schemas/household";
import { createFamilySchema } from "@/lib/schemas/family";

describe("Zod schemas", () => {
  it("recordPaymentSchema rejects non-positive amounts", () => {
    const r = recordPaymentSchema.safeParse({
      householdId: "h",
      familyId: "f",
      amount: 0,
      date: new Date(),
      note: null,
    });
    expect(r.success).toBe(false);
  });

  it("recordPaymentSchema accepts positive amount", () => {
    const r = recordPaymentSchema.safeParse({
      householdId: "h",
      familyId: "f",
      amount: 100,
      date: new Date(),
      note: null,
    });
    expect(r.success).toBe(true);
  });

  it("createExpenseSchema requires name", () => {
    const r = createExpenseSchema.safeParse({
      name: "",
      amount: 10,
      date: new Date(),
      note: null,
      isRecurring: false,
      recurringId: null,
    });
    expect(r.success).toBe(false);
  });

  it("createRecurringTemplateSchema requires positive amount", () => {
    const r = createRecurringTemplateSchema.safeParse({
      name: "Water",
      amount: -5,
      description: null,
    });
    expect(r.success).toBe(false);
  });

  it("createHouseholdSchema trims and requires non-empty name", () => {
    expect(
      createHouseholdSchema.safeParse({ name: "  " }).success
    ).toBe(false);
    expect(
      createHouseholdSchema.safeParse({ name: "  Main  " }).success
    ).toBe(true);
  });

  it("createFamilySchema requires non-negative target", () => {
    expect(
      createFamilySchema.safeParse({
        householdId: "h",
        name: "A",
        contributionTarget: -1,
      }).success
    ).toBe(false);
    expect(
      createFamilySchema.safeParse({
        householdId: "h",
        name: "A",
        contributionTarget: 0,
      }).success
    ).toBe(true);
  });
});
