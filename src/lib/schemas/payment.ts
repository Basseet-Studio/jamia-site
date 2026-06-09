import { z } from "zod";

export const recordPaymentSchema = z.object({
  householdId: z.string().min(1),
  familyId: z.string().min(1),
  amount: z.number().positive("Amount must be greater than zero"),
  date: z.date(),
  note: z.string().max(280).nullable(),
});
export type RecordPaymentSchema = z.infer<typeof recordPaymentSchema>;
