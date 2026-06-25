import { z } from "zod";

export const contributionSchema = z.object({
  contributorName: z.string().min(1),
  amount: z.number().positive("Amount must be greater than zero"),
  date: z.date(),
  note: z.string().max(280).nullable(),
});

export type ContributionSchema = z.infer<typeof contributionSchema>;
