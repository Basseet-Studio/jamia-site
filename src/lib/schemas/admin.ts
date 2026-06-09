import { z } from "zod";

export const adminRoleSchema = z.enum(["owner", "admin"]);
export type AdminRoleSchema = z.infer<typeof adminRoleSchema>;

export const adminSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: adminRoleSchema,
  addedAt: z.unknown(), // Firestore Timestamp at runtime; validated separately
});
