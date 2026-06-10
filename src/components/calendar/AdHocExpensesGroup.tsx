"use client";
import { useT } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/currency";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { CalendarAdHocRow } from "@/lib/types";

export function AdHocExpensesGroup({
  rows,
  currency,
}: {
  rows: CalendarAdHocRow[];
  currency: string;
}) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">
        {t("calendar.adHocHeading")}
      </h2>
      <ul className="divide-y rounded-md border">
        {rows.map(({ expense }) => {
          const date = expense.date?.toDate
            ? expense.date.toDate()
            : new Date();
          // TODO: localise this later — type label
          const typeLabel =
            expense.type === "mosque"
              ? `${t("expenseType.mosque")}${
                  expense.mosqueSubCategory
                    ? ` · ${t(`mosqueSubCategory.${expense.mosqueSubCategory}`)}`
                    : ""
                }`
              : t("expenseType.household");
          return (
            <li
              key={expense.id}
              className="flex items-center justify-between gap-4 p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{expense.name}</div>
                  <Badge variant="secondary">{typeLabel}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(date, "yyyy-MM-dd")}
                  {expense.note ? ` · ${expense.note}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium tabular-nums">
                  {formatCurrency(expense.amount, currency)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {expense.withdrawn
                    ? t("expenses.statusWithdrawn")
                    : t("expenses.statusPending")}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
