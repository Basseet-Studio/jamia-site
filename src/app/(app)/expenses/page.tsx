"use client";
import { useEffect, useState } from "react";
import { subscribeExpenses } from "@/lib/services/expenses";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog";
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
import type {
  Expense,
  ExpenseFilter,
  ExpenseType,
  MosqueSubCategory,
} from "@/lib/types";

const SUB_OPTIONS: MosqueSubCategory[] = ["maintenance", "salary", "other"];
const NONE = "__none__";

export default function ExpensesPage() {
  const t = useT();
  const [filter, setFilter] = useState<"all" | string>(currentMonthKey());
  const [prevMonth, setPrevMonth] = useState<string>(currentMonthKey());
  const [typeFilter, setTypeFilter] = useState<ExpenseType | "all">("all");
  const [subFilter, setSubFilter] = useState<MosqueSubCategory | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const expenseFilter: ExpenseFilter = {};
    if (typeFilter !== "all") expenseFilter.type = typeFilter;
    if (typeFilter === "mosque" && subFilter) {
      expenseFilter.mosqueSubCategory = subFilter;
    }
    const off = subscribeExpenses(
      filter,
      (rows) => {
        setExpenses(rows);
        setLoading(false);
      },
      expenseFilter,
    );
    return off;
  }, [filter, typeFilter, subFilter]);

  const isAllTime = filter === "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("expenses.heading")}</h1>
        <AddExpenseDialog />
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
        {/* TODO: localise this later — Type filter */}
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            const next = v as ExpenseType | "all";
            setTypeFilter(next);
            if (next !== "mosque") setSubFilter(null);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("expenses.typeFilterAll")}</SelectItem>
            <SelectItem value="household">
              {t("expenses.typeFilterHousehold")}
            </SelectItem>
            <SelectItem value="mosque">
              {t("expenses.typeFilterMosque")}
            </SelectItem>
          </SelectContent>
        </Select>
        {typeFilter === "mosque" ? (
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
        ) : null}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <ExpenseTable expenses={expenses} />
      )}
    </div>
  );
}
