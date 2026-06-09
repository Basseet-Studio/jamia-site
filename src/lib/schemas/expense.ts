import { z } from "zod";

export const createExpenseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  amount: z.number().positive("Amount must be greater than zero"),
  date: z.date(),
  note: z.string().max(280).nullable(),
  isRecurring: z.boolean(),
  recurringId: z.string().nullable(),
});
export type CreateExpenseSchema = z.infer<typeof createExpenseSchema>;
