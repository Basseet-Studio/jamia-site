import { z } from "zod";

/**
 * Members input for a family (per-family census).
 * Hierarchy: household -> family -> members.
 * Invariant enforced in the service layer: memberCount === memberNames.length.
 * The form computes memberCount from memberNames.length before submit.
 */
export const familyMemberSchema = z.object({
  memberCount: z
    .number()
    .int("Member count must be a whole number")
    .min(0, "Member count cannot be negative"),
  memberNames: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Member name cannot be empty")
        .max(80, "Member name too long"),
    )
    .max(200, "Too many members"),
});

export type FamilyMemberSchema = z.infer<typeof familyMemberSchema>;
