import { z } from "zod";

/**
 * Append-only history row for a household member edit (FR-005).
 * No update / delete — rules + service layer both enforce append-only.
 */
export const memberHistorySchema = z.object({
  previousCount: z.number().int().min(0),
  previousNames: z.array(z.string().min(1).max(80)),
  newCount: z.number().int().min(0),
  newNames: z.array(z.string().min(1).max(80)),
  changedBy: z.string().min(1),
});

export type MemberHistorySchema = z.infer<typeof memberHistorySchema>;
