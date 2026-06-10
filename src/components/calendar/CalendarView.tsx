"use client";
import { useT } from "@/lib/i18n";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { MonthNavigator } from "@/components/nav/MonthNavigator";
import { RecurringExpensesGroup } from "@/components/calendar/RecurringExpensesGroup";
import { AdHocExpensesGroup } from "@/components/calendar/AdHocExpensesGroup";
import { ShortfallBanner } from "@/components/calendar/ShortfallBanner";
import { CalendarEmptyState } from "@/components/calendar/CalendarEmptyState";
import type { CalendarView as CalendarViewType } from "@/lib/types";

export interface CalendarViewProps {
  view: CalendarViewType | null;
  month: string;
  onChange: (next: string) => void;
}

export function CalendarView({ view, month, onChange }: CalendarViewProps) {
  const t = useT();
  const { moh } = useMoneyOnHand();
  const cur = moh.currency || t("common.dash");

  const isEmpty =
    !!view && view.templates.length === 0 && view.adHoc.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("calendar.title")}</h1>
        <MonthNavigator
          month={month}
          onChange={onChange}
          capAtCurrent={false}
        />
      </div>
      {view ? <ShortfallBanner view={view} currency={cur} /> : null}
      {isEmpty ? (
        <CalendarEmptyState />
      ) : view ? (
        <>
          <RecurringExpensesGroup
            rows={view.templates}
            currency={cur}
            month={month}
          />
          <AdHocExpensesGroup rows={view.adHoc} currency={cur} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
    </div>
  );
}
