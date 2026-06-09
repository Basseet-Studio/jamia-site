"use client";
import { useState } from "react";
import type { RecurringTemplateWithStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { AddForMonthButton } from "@/components/recurring/AddForMonthButton";
import { Button } from "@/components/ui/button";
import { archiveRecurringTemplate } from "@/lib/services/recurring";
import { useAuth } from "@/lib/hooks/useAuth";

const STATUS_LABEL: Record<
  RecurringTemplateWithStatus["currentMonthStatus"],
  string
> = {
  NotAdded: "Not added",
  PendingWithdrawal: "Pending withdrawal",
  Withdrawn: "Withdrawn",
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
  const cur = moh.currency || "—";
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {archived ? "No archived templates." : "No recurring templates yet."}
      </div>
    );
  }

  async function onArchive(id: string) {
    if (!user) return;
    if (
      !confirm(
        "Archive this template? Previously generated expenses stay intact.",
      )
    )
      return;
    setBusyId(id);
    try {
      await archiveRecurringTemplate(user.uid, id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ul className="divide-y rounded-md border">
      {templates.map((t) => (
        <li key={t.id} className="flex items-center justify-between gap-4 p-3">
          <div className="flex-1">
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(t.amount, cur)} ·{" "}
              {STATUS_LABEL[t.currentMonthStatus]}
              {t.description ? ` · ${t.description}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!archived && t.currentMonthStatus === "NotAdded" ? (
              <AddForMonthButton
                templateId={t.id}
                month={currentMonth}
                onAdded={onAdded}
              />
            ) : null}
            {!archived ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onArchive(t.id)}
                disabled={busyId === t.id}
              >
                {busyId === t.id ? "Archiving…" : "Archive"}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
