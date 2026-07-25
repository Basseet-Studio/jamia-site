"use client";
import { useMemo } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  canCreateHouseholdsAndFamilies,
  canDelete,
  canEditFamilies,
  canExport,
  canFinancial,
  canManageAdmins,
  canWriteSettings,
  isFullAdmin,
} from "@/lib/auth/permissions";

export function usePermissions() {
  const { admin } = useAuth();
  return useMemo(
    () => ({
      admin,
      isFullAdmin: isFullAdmin(admin),
      canCreateHouseholdsAndFamilies: canCreateHouseholdsAndFamilies(admin),
      canDelete: canDelete(admin),
      canEditFamilies: canEditFamilies(admin),
      canFinancial: canFinancial(admin),
      canExport: canExport(admin),
      canManageAdmins: canManageAdmins(admin),
      canWriteSettings: canWriteSettings(admin),
    }),
    [admin],
  );
}
