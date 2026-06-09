import { z } from "zod";

export const familyNameSchema = z
  .string()
  .trim()
  .min(1, "Family name is required")
  .max(80, "Family name too long");

export const createFamilySchema = z.object({
  householdId: z.string().min(1),
  name: familyNameSchema,
  contributionTarget: z.number().int().min(0),
});
export type CreateFamilySchema = z.infer<typeof createFamilySchema>;

export const editFamilySchema = z.object({
  householdId: z.string().min(1),
  familyId: z.string().min(1),
  name: familyNameSchema,
  contributionTarget: z.number().int().min(0),
});
export type EditFamilySchema = z.infer<typeof editFamilySchema>;
