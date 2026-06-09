import { z } from "zod";

export const createRecurringTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  amount: z.number().positive("Amount must be greater than zero"),
  description: z.string().max(280).nullable(),
});
export type CreateRecurringTemplateSchema = z.infer<typeof createRecurringTemplateSchema>;

export const updateRecurringTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  amount: z.number().positive().optional(),
  description: z.string().max(280).nullable().optional(),
  active: z.boolean().optional(),
});
export type UpdateRecurringTemplateSchema = z.infer<typeof updateRecurringTemplateSchema>;
