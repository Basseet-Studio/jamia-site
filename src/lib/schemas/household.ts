import { z } from "zod";

export const householdNameSchema = z
  .string()
  .trim()
  .min(1, "Household name is required")
  .max(80, "Household name too long");

export const createHouseholdSchema = z.object({
  name: householdNameSchema,
});
export type CreateHouseholdSchema = z.infer<typeof createHouseholdSchema>;

export const deleteHouseholdSchema = z.object({
  householdId: z.string().min(1),
  confirmName: z.string().min(1),
});
export type DeleteHouseholdSchema = z.infer<typeof deleteHouseholdSchema>;
