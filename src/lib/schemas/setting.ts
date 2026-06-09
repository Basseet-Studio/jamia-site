import { z } from "zod";

export const settingSchema = z.object({
  defaultContributionTarget: z.number().int().min(0),
  openingBalance: z.number(),
  currency: z.string().min(1).max(8),
});

export const updateSettingsSchema = z.object({
  defaultContributionTarget: z.number().int().min(0).optional(),
  openingBalance: z.number().optional(),
  currency: z.string().min(1).max(8).optional(),
});

export type SettingInput = z.infer<typeof settingSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
