"use client";
import { useEffect, useMemo, useState } from "react";
import { subscribeExpenses } from "@/lib/services/expenses";
import { subscribeRecurringTemplates } from "@/lib/services/recurring";
import { subscribeRecurringTotalForMonth } from "@/lib/services/derived";
import { subscribeSettings } from "@/lib/services/settings";
import { subscribeHouseholds } from "@/lib/services/households";
import { subscribeFamilies } from "@/lib/services/families";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog";
import { RecurringTemplatesSection } from "@/components/expenses/RecurringTemplatesSection";
import { RecurringWarningChip } from "@/components/expenses/RecurringWarningChip";
import { MonthNavigator } from "@/components/nav/MonthNavigator";
import { currentMonthKey } from "@/lib/utils/dates";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import { FullReportButton } from "@/components/excel/FullReportButton";
import { PerScreenExportButton } from "@/components/excel/PerScreenExportButton";
import type {
  Expense,
  ExpenseFilter,
  Family,
  Household,
  MosqueSubCategory,
  RecurringTemplate,
  Setting,
} from "@/lib/types";

const SUB_OPTIONS: MosqueSubCategory[] = ["maintenance", "salary", "other"];
const NONE = "__none__";

export default function ExpensesPage() {
  const t = useT();
  const [filter, setFilter] = useState<"all" | string>(currentMonthKey());
  const [prevMonth, setPrevMonth] = useState<string>(currentMonthKey());
  const [subFilter, setSubFilter] = useState<MosqueSubCategory | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Live data for the warning chip.
  const [settings, setSettings] = useState<Setting | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeFamilyCount, setActiveFamilyCount] = useState(0);
  const [recurringTotal, setRecurringTotal] = useState(0);
  const [recurringRefreshKey, setRecurringRefreshKey] = useState(0);
  const [recurringTemplates, setRecurringTemplates] = useState<
    RecurringTemplate[]
  >([]);

  useEffect(() => {
    return subscribeSettings(setSettings);
  }, []);

  useEffect(() => {
    return subscribeHouseholds(setHouseholds);
  }, []);

  // Subscribe to families in every household and sum active counts.
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

  // Recurring total for the selected month (or 0 for all-time).
  useEffect(() => {
    if (filter === "all") {
      setRecurringTotal(0);
      return;
    }
    return subscribeRecurringTotalForMonth(filter, setRecurringTotal);
  }, [filter]);

  // Subscribe to recurring templates for the export (active-only).
  useEffect(() => {
    return subscribeRecurringTemplates(true, setRecurringTemplates);
  }, []);

  useEffect(() => {
    setLoading(true);
    const expenseFilter: ExpenseFilter = { type: "mosque" };
    if (subFilter) {
      expenseFilter.mosqueSubCategory = subFilter;
    }
    const off = subscribeExpenses(
      filter,
      (rows) => {
        setExpenses(rows);
        setLoading(false);
        // Bump refresh key so the recurring section re-reads its month
        // status whenever the underlying expenses change.
        setRecurringRefreshKey((k) => k + 1);
      },
      expenseFilter,
    );
    return off;
  }, [filter, subFilter]);

  const isAllTime = filter === "all";
  const isFutureMonth = useMemo(() => {
    if (filter === "all") return false;
    return filter > currentMonthKey();
  }, [filter]);

  const expectedPayments = useMemo(() => {
    if (!settings) return 0;
    return settings.defaultContributionTarget * activeFamilyCount;
  }, [settings, activeFamilyCount]);

  const showWarning =
    !isAllTime &&
    isFutureMonth &&
    recurringTotal > expectedPayments &&
    settings != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("expenses.heading")}</h1>
        <div className="flex items-center gap-2">
          <FullReportButton />
          <AddExpenseDialog />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!isAllTime ? (
          <MonthNavigator
            month={filter as string}
            onChange={setFilter}
            capAtCurrent
          />
        ) : null}
        <Button
          variant={isAllTime ? "default" : "outline"}
          onClick={() => {
            if (isAllTime) {
              setFilter(prevMonth);
            } else {
              setPrevMonth(filter as string);
              setFilter("all");
            }
          }}
        >
          {isAllTime ? t("expenses.showByMonth") : t("expenses.showAllTime")}
        </Button>
        {isAllTime ? (
          <span className="text-xs text-muted-foreground">
            {t("expenses.allTimeNote")}
          </span>
        ) : null}
        <Select
          value={subFilter ?? NONE}
          onValueChange={(v) =>
            setSubFilter(v === NONE ? null : (v as MosqueSubCategory))
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>
              {t("expenses.subCategoryFilterAll")}
            </SelectItem>
            {SUB_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`mosqueSubCategory.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PerScreenExportButton
          buildFilter={() => ({
            kind: "expenses",
            month: filter,
            subCategory: subFilter,
            expenseType: "mosque",
          })}
          buildData={() => ({
            households: [],
            families: [],
            payments: [],
            expenses,
            recurringTemplates: [],
          })}
          // TODO: localise this later
          label="Export expenses"
        />
        {showWarning ? (
          <RecurringWarningChip
            recurringTotal={recurringTotal}
            expectedPayments={expectedPayments}
            currency={settings?.currency ?? "AED"}
          />
        ) : null}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <ExpenseTable expenses={expenses} />
      )}
      <RecurringTemplatesSection
        month={isAllTime ? currentMonthKey() : (filter as string)}
        currency={settings?.currency ?? "AED"}
        refreshKey={recurringRefreshKey}
      />
    </div>
  );
}
