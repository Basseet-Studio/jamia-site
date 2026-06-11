import { z } from "zod";

/**
 * Append-only history row for a family's member edit.
 * Lives at `households/{householdId}/families/{familyId}/memberHistory/{historyId}`.
 * No update / delete — rules + service layer both enforce append-only.
 */
export const familyMemberHistorySchema = z.object({
  householdId: z.string().min(1),
  familyId: z.string().min(1),
  previousCount: z.number().int().min(0),
  previousNames: z.array(z.string().min(1).max(80)),
  newCount: z.number().int().min(0),
  newNames: z.array(z.string().min(1).max(80)),
  changedBy: z.string().min(1),
});

export type FamilyMemberHistorySchema = z.infer<typeof familyMemberHistorySchema>;
