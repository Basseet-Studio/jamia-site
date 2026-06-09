"use client";
import { useState } from "react";
import type { RecurringTemplateWithStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { AddForMonthButton } from "@/components/recurring/AddForMonthButton";
import { Button } from "@/components/ui/button";
import { archiveRecurringTemplate } from "@/lib/services/recurring";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";

const STATUS_KEY: Record<
  RecurringTemplateWithStatus["currentMonthStatus"],
  string
> = {
  NotAdded: "recurring.statusNotAdded",
  PendingWithdrawal: "recurring.statusPendingWithdrawal",
  Withdrawn: "recurring.statusWithdrawn",
};

export function RecurringTemplateList({
  templates,
  currentMonth,
  archived = false,
  onAdded,
}: {
  templates: RecurringTemplateWithStatus[];
  currentMonth: string;
  archived?: boolean;
  onAdded?: () => void;
}) {
  const { moh } = useMoneyOnHand();
  const t = useT();
  const cur = moh.currency || t("common.dash");
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {archived ? t("recurring.noArchived") : t("recurring.noTemplates")}
      </div>
    );
  }

  async function onArchive(id: string) {
    if (!user) return;
    if (!confirm(t("recurring.confirmArchive"))) return;
    setBusyId(id);
    try {
      await archiveRecurringTemplate(user.uid, id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="divide-y rounded-md border">
      {templates.map((tpl) => (
        <li
          key={tpl.id}
          className="flex items-center justify-between gap-4 p-3"
        >
          <div className="flex-1">
            <div className="font-medium">{tpl.name}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(tpl.amount, cur)} ·{" "}
              {t(STATUS_KEY[tpl.currentMonthStatus])}
              {tpl.description ? ` · ${tpl.description}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!archived && tpl.currentMonthStatus === "NotAdded" ? (
              <AddForMonthButton
                templateId={tpl.id}
                month={currentMonth}
                onAdded={onAdded}
              />
            ) : null}
            {!archived ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onArchive(tpl.id)}
                disabled={busyId === tpl.id}
              >
                {busyId === tpl.id
                  ? t("recurring.archiving")
                  : t("recurring.archive")}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
