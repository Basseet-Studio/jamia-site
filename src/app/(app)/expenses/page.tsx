"use client";
import { useEffect, useState } from "react";
import { subscribeExpenses } from "@/lib/services/expenses";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog";
import { MonthNavigator } from "@/components/nav/MonthNavigator";
import { currentMonthKey } from "@/lib/utils/dates";
import { Button } from "@/components/ui/button";
import type { Expense } from "@/lib/types";

export default function ExpensesPage() {
  const [filter, setFilter] = useState<"all" | string>(currentMonthKey());
  const [prevMonth, setPrevMonth] = useState<string>(currentMonthKey());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const off = subscribeExpenses(filter, (rows) => {
      setExpenses(rows);
      setLoading(false);
    });
    return off;
  }, [filter]);

  const isAllTime = filter === "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Expenses</h1>
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
          {isAllTime ? "Show by month" : "Show all time"}
        </Button>
        {isAllTime ? (
          <span className="text-xs text-muted-foreground">
            All-time totals across every recorded expense.
          </span>
        ) : null}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ExpenseTable expenses={expenses} />
      )}
    </div>
  );
}
