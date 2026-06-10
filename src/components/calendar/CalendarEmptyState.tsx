"use client";
import { useT } from "@/lib/i18n";

export function CalendarEmptyState() {
  const t = useT();
  return (
    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
      {t("calendar.empty")}
    </div>
  );
}
