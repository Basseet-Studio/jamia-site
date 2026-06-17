import { z } from "zod";

export const recordPaymentSchema = z.object({
  householdId: z.string().min(1),
  familyId: z.string().min(1),
  amount: z.number().positive("Amount must be greater than zero"),
  date: z.date(),
  note: z.string().max(280).nullable(),
  // 003 — optional UUID v4 linking cascaded sibling docs. Absent on legacy.
  coverageGroupId: z.string().uuid().optional(),
});
export type RecordPaymentSchema = z.infer<typeof recordPaymentSchema>;

/**
 * 003 — Schema for a cascade-aware payment submission. Used by
 * `recordPaymentWithCoverage()` in the payments service.
 *
 * `coverageGroupId` is REQUIRED here (the txn writes N docs that all share it).
 * `applyToFutureMonths` plumbs the dialog checkbox into the algorithm.
 * `payment` carries the same shape as `recordPaymentSchema` (without
 * `coverageGroupId`, which is hoisted to the top level).
 */
export const recordPaymentWithCoverageSchema = z.object({
  householdId: z.string().min(1),
  familyId: z.string().min(1),
  coverageGroupId: z.string().uuid(),
  applyToFutureMonths: z.boolean(),
  date: z.date(),
  note: z.string().max(280).nullable(),
  amount: z.number().positive("Amount must be greater than zero"),
});
export type RecordPaymentWithCoverageSchema = z.infer<
  typeof recordPaymentWithCoverageSchema
>;
