import { z } from "zod";

/**
 * Recurring template schemas — 002 discriminated union (US-2 / US-4).
 * Mirrors expense.ts. The service defaults `type` to "mosque" on create.
 */
const baseShape = {
  name: z.string().trim().min(1, "Name is required").max(80),
  amount: z.number().positive("Amount must be greater than zero"),
  description: z.string().max(280).nullable(),
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

export const createRecurringTemplateSchema = z.discriminatedUnion("type", [
  householdBranch,
  mosqueBranch,
]);
export type CreateRecurringTemplateSchema = z.infer<
  typeof createRecurringTemplateSchema
>;

/** Update allows the new fields too, but never changes `createdAt`/`createdBy`. */
const updateBranchShape = {
  name: z.string().trim().min(1).max(80).optional(),
  amount: z.number().positive().optional(),
  description: z.string().max(280).nullable().optional(),
  active: z.boolean().optional(),
  type: z.enum(["household", "mosque"]).optional(),
  householdId: z.string().min(1).nullable().optional(),
  familyId: z.string().min(1).nullable().optional(),
  mosqueSubCategory: z
    .enum(["maintenance", "salary", "other"])
    .nullable()
    .optional(),
};

export const updateRecurringTemplateSchema = z
  .object(updateBranchShape)
  .refine(
    (v) =>
      v.type === undefined ||
      v.householdId !== undefined ||
      v.mosqueSubCategory !== undefined,
    "type and linkage fields must be updated together",
  );
export type UpdateRecurringTemplateSchema = z.infer<
  typeof updateRecurringTemplateSchema
>;
