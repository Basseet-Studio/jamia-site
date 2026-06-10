"use client";
import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/currency";
import { addRecurringForMonth } from "@/lib/services/recurring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { CalendarTemplateRow } from "@/lib/types";

const STATUS_KEY: Record<CalendarTemplateRow["status"], string> = {
  NotAdded: "calendar.status.notAdded",
  PendingWithdrawal: "calendar.status.pendingWithdrawal",
  Withdrawn: "calendar.status.withdrawn",
};

export function RecurringExpensesGroup({
  rows,
  currency,
  month,
}: {
  rows: CalendarTemplateRow[];
  currency: string;
  month: string;
}) {
  const t = useT();
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(templateId: string, month: string) {
    if (!user) return;
    setBusyId(templateId);
    setError(null);
    try {
      await addRecurringForMonth(user.uid, templateId, month);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">
        {t("calendar.recurringHeading")}
      </h2>
      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
      <ul className="divide-y rounded-md border">
        {rows.map((row) => {
          const tpl = row.template;
          const typeLabel =
            tpl.type === "mosque"
              ? `${t("expenseType.mosque")}${
                  tpl.mosqueSubCategory
                    ? ` · ${t(`mosqueSubCategory.${tpl.mosqueSubCategory}`)}`
                    : ""
                }`
              : t("expenseType.household");
          return (
            <li
              key={tpl.id}
              className="flex items-center justify-between gap-4 p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{tpl.name}</div>
                  <Badge variant="secondary">{typeLabel}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(tpl.amount, currency)} ·{" "}
                  {t(STATUS_KEY[row.status])}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {row.status === "NotAdded" ? (
                  <Button
                    size="sm"
                    onClick={() => onAdd(tpl.id, month)}
                    disabled={busyId === tpl.id}
                  >
                    {busyId === tpl.id
                      ? t("recurring.adding")
                      : t("calendar.action.addForMonth")}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
