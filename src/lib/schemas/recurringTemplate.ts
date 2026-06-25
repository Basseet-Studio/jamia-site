import { z } from "zod";

/**
 * Recurring template schemas.
 *
 * Mosque-only: per product decision, household-type recurring expenses are not
 * allowed. Recurring on the income side is handled via `payments`, so a
 * household-level "recurring expense" is not a meaningful concept. New
 * templates are forced to `type: "mosque"` here and in the service layer.
 *
 * `type` is retained on the schema for forward-compat with any legacy rows
 * already in `recurringExpenses` that may still carry a `type` field, but
 * the create/update paths cannot set it to anything other than "mosque".
 */
const mosqueBaseShape = {
  name: z.string().trim().min(1, "Name is required").max(80),
  amount: z.number().positive("Amount must be greater than zero"),
  description: z.string().max(280).nullable(),
};

export const createRecurringTemplateSchema = z
  .object({
    ...mosqueBaseShape,
    type: z.literal("mosque"),
    mosqueSubCategory: z.enum(["maintenance", "salary", "other"]),
  })
  .strict();
export type CreateRecurringTemplateSchema = z.infer<
  typeof createRecurringTemplateSchema
>;

/** Update allows the editable mosque fields; `type` and household linkage
 *  are intentionally absent — they cannot change. Strict mode rejects any
 *  attempt to pass them. */
export const updateRecurringTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    amount: z.number().positive().optional(),
    description: z.string().max(280).nullable().optional(),
    active: z.boolean().optional(),
    mosqueSubCategory: z
      .enum(["maintenance", "salary", "other"])
      .nullable()
      .optional(),
  })
  .strict();
export type UpdateRecurringTemplateSchema = z.infer<
  typeof updateRecurringTemplateSchema
>;