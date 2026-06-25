/**
 * Recurring template schema — mosque-only.
 *
 * Product decision: household-type recurring templates are not allowed
 * (recurring on the income side is handled by `payments`). The
 * `createRecurringTemplateSchema` is therefore a flat mosque-only object
 * — no discriminated union. This test pins that behaviour:
 *   - Valid mosque input parses.
 *   - Any attempt to set `type: "household"` is rejected at the Zod layer.
 *   - Mosque-only fields (householdId / familyId) are not accepted.
 */
import { describe, expect, it } from "vitest";
import {
  createRecurringTemplateSchema,
  updateRecurringTemplateSchema,
} from "@/lib/schemas/recurringTemplate";

describe("createRecurringTemplateSchema — mosque-only", () => {
  it("accepts a valid mosque template", () => {
    const parsed = createRecurringTemplateSchema.parse({
      name: "Imam salary",
      amount: 500,
      description: null,
      type: "mosque",
      mosqueSubCategory: "salary",
    });
    expect(parsed.type).toBe("mosque");
    expect(parsed.mosqueSubCategory).toBe("salary");
  });

  it("rejects type === 'household' (household recurring is forbidden)", () => {
    expect(() =>
      createRecurringTemplateSchema.parse({
        name: "Bad template",
        amount: 100,
        description: null,
        type: "household",
        householdId: "hh-1",
        familyId: null,
        mosqueSubCategory: null,
      }),
    ).toThrow();
  });

  it("rejects any extra linkage fields the schema doesn't declare", () => {
    expect(() =>
      createRecurringTemplateSchema.parse({
        name: "Bad template",
        amount: 100,
        description: null,
        type: "mosque",
        mosqueSubCategory: "maintenance",
        householdId: "hh-1",
      }),
    ).toThrow();
  });
});

describe("updateRecurringTemplateSchema — mosque-only fields", () => {
  it("accepts mosque-only editable fields", () => {
    const parsed = updateRecurringTemplateSchema.parse({
      name: "Renamed",
      amount: 600,
      active: false,
      mosqueSubCategory: "other",
    });
    expect(parsed.name).toBe("Renamed");
    expect(parsed.mosqueSubCategory).toBe("other");
  });

  it("rejects attempts to set type", () => {
    expect(() =>
      updateRecurringTemplateSchema.parse({
        type: "household",
      }),
    ).toThrow();
  });
});
