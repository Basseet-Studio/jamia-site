import { z } from "zod";

/**
 * Expense schema — 002 discriminated union over `type` (FR-008..FR-010).
 *
 * Two branches:
 *   - "household": requires householdId; familyId is optional; mosqueSubCategory = null
 *   - "mosque":    requires mosqueSubCategory; householdId/familyId = null
 *
 * The XOR is enforced by the union, not by the form. The form sets the
 * irrelevant branch's fields to null on type change. The service layer
 * re-parses on every write.
 */
const baseShape = {
  name: z.string().trim().min(1, "Name is required").max(80),
  amount: z.number().positive("Amount must be greater than zero"),
  date: z.date(),
  note: z.string().max(280).nullable(),
  isRecurring: z.boolean(),
  recurringId: z.string().nullable(),
};

const householdBranch = z.object({
  ...baseShape,
  type: z.literal("household"),
  householdId: z.string().min(1, "Household is required"),
  familyId: z.string().nullable().optional(),
  mosqueSubCategory: z.null(),
});

const mosqueBranch = z.object({
  ...baseShape,
  type: z.literal("mosque"),
  householdId: z.null(),
  familyId: z.null(),
  mosqueSubCategory: z.enum(["maintenance", "salary", "other"]),
});

export const createExpenseSchema = z.discriminatedUnion("type", [
  householdBranch,
  mosqueBranch,
]);
export type CreateExpenseSchema = z.infer<typeof createExpenseSchema>;
