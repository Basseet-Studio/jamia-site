"use client";
import { useEffect, useMemo, useState } from "react";
import { subscribeRecurringTotalForMonth } from "@/lib/services/derived";
import { subscribeSettings } from "@/lib/services/settings";
import { subscribeHouseholds } from "@/lib/services/households";
import { subscribeFamilies } from "@/lib/services/families";
import { subscribeExpenses } from "@/lib/services/expenses";
import { RecurringTemplatesSection } from "@/components/expenses/RecurringTemplatesSection";
import { RecurringWarningChip } from "@/components/expenses/RecurringWarningChip";
import { MonthNavigator } from "@/components/nav/MonthNavigator";
import { currentMonthKey } from "@/lib/utils/dates";
import { useT } from "@/lib/i18n";
import type { Family, Household, Setting } from "@/lib/types";

export default function RecurringPage() {
  const t = useT();
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [settings, setSettings] = useState<Setting | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeFamilyCount, setActiveFamilyCount] = useState(0);
  const [recurringTotal, setRecurringTotal] = useState(0);
  const [recurringRefreshKey, setRecurringRefreshKey] = useState(0);

  useEffect(() => {
    return subscribeSettings(setSettings);
  }, []);

  useEffect(() => {
    return subscribeHouseholds(setHouseholds);
  }, []);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    let cancelled = false;
    const familiesByHousehold = new Map<string, Family[]>();
    const recompute = () => {
      let count = 0;
      for (const list of familiesByHousehold.values()) {
        for (const f of list) if (f.active) count += 1;
      }
      setActiveFamilyCount(count);
    };
    households.forEach((h) => {
      const off = subscribeFamilies(h.id, (rows) => {
        if (cancelled) return;
        familiesByHousehold.set(h.id, rows);
        recompute();
      });
      unsubs.push(off);
    });
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [households]);

  useEffect(() => {
    return subscribeRecurringTotalForMonth(month, setRecurringTotal);
  }, [month]);

  // Bump refresh key when mosque expenses change so template status stays in sync.
  useEffect(() => {
    const off = subscribeExpenses(
      month,
      () => setRecurringRefreshKey((k) => k + 1),
      { type: "mosque" },
    );
    return off;
  }, [month]);

  const isFutureMonth = useMemo(() => month > currentMonthKey(), [month]);

  const expectedPayments = useMemo(() => {
    if (!settings) return 0;
    return settings.defaultContributionTarget * activeFamilyCount;
  }, [settings, activeFamilyCount]);

  const showWarning =
    isFutureMonth &&
    recurringTotal > expectedPayments &&
    settings != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("recurring.heading")}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <MonthNavigator month={month} onChange={setMonth} capAtCurrent={false} />
        <span className="text-xs text-muted-foreground">
          {t("recurring.monthStatus")}
        </span>
        {showWarning ? (
          <RecurringWarningChip
            recurringTotal={recurringTotal}
            expectedPayments={expectedPayments}
            currency={settings?.currency ?? "AED"}
          />
        ) : null}
      </div>
      <RecurringTemplatesSection
        month={month}
        currency={settings?.currency ?? "AED"}
        refreshKey={recurringRefreshKey}
      />
    </div>
  );
}
