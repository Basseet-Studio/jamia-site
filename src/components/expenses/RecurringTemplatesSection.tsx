"use client";
/**
 * RecurringTemplatesSection — mosque-only template list with per-month
 * status, "Add for this month" trigger, and an "Add template" button.
 *
 * Subscribes live to `recurringExpenses` (mosque-only) and refreshes the
 * per-template month-status whenever the month changes or templates
 * change. Status reflects whether a recurring expense for this template
 * already exists for the selected month (and whether it's been withdrawn).
 *
 * NOTE: this section intentionally never reads the `payments` or
 * `families` collections — it shows expenses-only data. The
 * future-month warning is computed on the parent Expenses page.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddMosqueTemplateDialog } from "./AddMosqueTemplateDialog";
import {
  subscribeRecurringTemplates,
  addRecurringForMonth,
  archiveRecurringTemplate,
  listRecurringTemplatesWithStatus,
} from "@/lib/services/recurring";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/currency";
import type {
  MosqueSubCategory,
  RecurringTemplateWithStatus,
} from "@/lib/types";

type Status = RecurringTemplateWithStatus["currentMonthStatus"];

export interface RecurringTemplatesSectionProps {
  month: string;
  currency: string;
  /** Bumped by parent to force a status refresh (e.g. after month change). */
  refreshKey?: number;
}

function statusVariant(status: Status): "default" | "secondary" | "outline" {
  switch (status) {
    case "NotAdded":
      return "secondary";
    case "PendingWithdrawal":
      return "default";
    case "Withdrawn":
      return "outline";
  }
}

function statusKey(status: Status): string {
  switch (status) {
    case "NotAdded":
      return "expenses.recurring.statusNotAdded";
    case "PendingWithdrawal":
      return "expenses.recurring.statusPendingWithdrawal";
    case "Withdrawn":
      return "expenses.recurring.statusWithdrawn";
  }
}

export function RecurringTemplatesSection({
  month,
  currency,
  refreshKey = 0,
}: RecurringTemplatesSectionProps) {
  const t = useT();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<RecurringTemplateWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Live subscription to templates (active + archived). The status field
  // is overwritten by the per-month refresh below.
  useEffect(() => {
    const off = subscribeRecurringTemplates(false, (rows) => {
      // Strip the status fields; they'll be re-applied by the month refresh.
      setTemplates(
        rows.map((r) => ({
          ...r,
          currentMonthStatus: "NotAdded",
          currentMonthExpenseId: null,
        })),
      );
    });
    return off;
  }, []);

  // Refresh per-month status when month changes, or when parent signals a
  // refresh (e.g. after a successful add/archive).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRecurringTemplatesWithStatus(month)
      .then((rows) => {
        if (cancelled) return;
        setTemplates(rows);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("listRecurringTemplatesWithStatus failed:", e);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, refreshKey]);

  const handleAdd = useCallback(
    async (templateId: string) => {
      if (!user) return;
      setBusyId(templateId);
      try {
        await addRecurringForMonth(user.uid, templateId, month);
        // Refresh status for the current month.
        const rows = await listRecurringTemplatesWithStatus(month);
        setTemplates(rows);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("addRecurringForMonth failed:", (e as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [user, month],
  );

  const handleArchive = useCallback(
    async (templateId: string) => {
      if (!user) return;
      setBusyId(templateId);
      try {
        await archiveRecurringTemplate(user.uid, templateId);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(
          "archiveRecurringTemplate failed:",
          (e as Error).message,
        );
      } finally {
        setBusyId(null);
      }
    },
    [user],
  );

  const active = templates.filter((r) => r.active);
  const archived = templates.filter((r) => !r.active);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{t("expenses.recurring.sectionTitle")}</CardTitle>
          <CardDescription>
            {t("expenses.recurring.sectionDescription")}
          </CardDescription>
        </div>
        <AddMosqueTemplateDialog />
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("expenses.recurring.empty")}
          </p>
        ) : (
          <ul className="divide-y">
            {active.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {t(
                        `mosqueSubCategory.${row.mosqueSubCategory as MosqueSubCategory}`,
                      )}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(row.amount, currency)}
                    </span>
                  </div>
                  {row.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={statusVariant(row.currentMonthStatus)}
                    className="text-[10px]"
                  >
                    {t(statusKey(row.currentMonthStatus))}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      busyId === row.id || row.currentMonthStatus !== "NotAdded"
                    }
                    onClick={() => handleAdd(row.id)}
                  >
                    {busyId === row.id
                      ? t("expenses.recurring.adding")
                      : t("expenses.recurring.addForMonth")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === row.id}
                    onClick={() => handleArchive(row.id)}
                    className="text-muted-foreground"
                  >
                    {t("expenses.recurring.archive")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {archived.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {t("expenses.recurring.archived")}
            </summary>
            <ul className="mt-2 divide-y">
              {archived.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between py-2 text-sm text-muted-foreground"
                >
                  <span>{row.name}</span>
                  <span>{formatCurrency(row.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}