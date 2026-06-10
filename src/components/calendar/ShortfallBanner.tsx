"use client";
import { useT } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/currency";
import type { CalendarView as CalendarViewType } from "@/lib/types";

export function ShortfallBanner({
  view,
  currency,
}: {
  view: CalendarViewType;
  currency: string;
}) {
  const t = useT();
  const s = view.shortfall;
  if (!s) return null;
  // FR-030: hide the banner entirely when no active recurring templates.
  if (s.recurringTotal === 0) return null;

  const classes = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-100",
    watch:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100",
    risk: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100",
  }[s.severity];

  const body = {
    ok: t("calendar.shortfall.onTrack"),
    watch: t("calendar.shortfall.watch", {
      amount: formatCurrency(s.shortfall, currency),
    }),
    risk: t("calendar.shortfall.risk", {
      amount: formatCurrency(s.shortfall, currency),
    }),
  }[s.severity];

  return (
    <div
      role="status"
      data-severity={s.severity}
      className={`rounded-md border p-3 text-sm ${classes}`}
    >
      <div className="font-medium">{body}</div>
      {s.severity === "risk" ? (
        <div className="mt-1 text-xs opacity-90">
          {t("calendar.shortfall.suggestion")}
        </div>
      ) : null}
    </div>
  );
}
