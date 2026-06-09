"use client";
import { Badge } from "@/components/ui/badge";
import type { FamilyMonthlyStatus } from "@/lib/types";

const STYLES: Record<FamilyMonthlyStatus, string> = {
  Unpaid: "bg-muted text-muted-foreground",
  Partial: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  Met: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  Over: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
};

export function StatusBadge({ status }: { status: FamilyMonthlyStatus }) {
  return (
    <Badge variant="secondary" className={STYLES[status]}>
      {/* TODO(i18n): badge label */}
      {status}
    </Badge>
  );
}
