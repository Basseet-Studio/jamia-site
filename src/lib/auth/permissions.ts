import type { Admin, AdminRole } from "@/lib/types";

const FULL_ACCESS: AdminRole[] = ["owner", "admin"];

export function isFullAdmin(admin: Admin | null | undefined): boolean {
  return !!admin && FULL_ACCESS.includes(admin.role);
}

/** Add households and families (clerks included). */
export function canCreateHouseholdsAndFamilies(
  admin: Admin | null | undefined,
): boolean {
  return !!admin;
}

/** Soft-delete / hard-delete / archive. */
export function canDelete(admin: Admin | null | undefined): boolean {
  return isFullAdmin(admin);
}

/** Payments, expenses, contributions, withdrawals, receipt uploads. */
export function canFinancial(admin: Admin | null | undefined): boolean {
  return isFullAdmin(admin);
}

/** Excel export. */
export function canExport(admin: Admin | null | undefined): boolean {
  return isFullAdmin(admin);
}

/** Promote/demote admins. */
export function canManageAdmins(admin: Admin | null | undefined): boolean {
  return isFullAdmin(admin);
}

/** Edit settings/global (opening balance, currency, default target). */
export function canWriteSettings(admin: Admin | null | undefined): boolean {
  return isFullAdmin(admin);
}

/** Edit existing family name/target/members (clerks are add-only). */
export function canEditFamilies(admin: Admin | null | undefined): boolean {
  return isFullAdmin(admin);
}
