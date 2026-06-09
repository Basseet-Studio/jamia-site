"use client";
import { useEffect, useState } from "react";
import { listRecurringTemplatesWithStatus } from "@/lib/services/recurring";
import { AddTemplateDialog } from "@/components/recurring/AddTemplateDialog";
import { RecurringTemplateList } from "@/components/recurring/RecurringTemplateList";
import { MonthNavigator } from "@/components/nav/MonthNavigator";
import { currentMonthKey } from "@/lib/utils/dates";
import { useT } from "@/lib/i18n";
import type { RecurringTemplateWithStatus } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecurringPage() {
  const t = useT();
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [templates, setTemplates] = useState<RecurringTemplateWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const rows = await listRecurringTemplatesWithStatus(month);
    setTemplates(rows);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const active = templates.filter((tpl) => tpl.active);
  const archived = templates.filter((tpl) => !tpl.active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("recurring.heading")}</h1>
        <AddTemplateDialog />
      </div>
      <div className="flex items-center gap-3">
        <MonthNavigator
          month={month}
          onChange={setMonth}
          capAtCurrent={false}
        />
        <span className="text-xs text-muted-foreground">
          {t("recurring.monthStatus")}
        </span>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("recurring.activeTemplates")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : (
            <RecurringTemplateList
              templates={active}
              currentMonth={month}
              onAdded={refresh}
            />
          )}
        </CardContent>
      </Card>
      {archived.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("recurring.archived")}</CardTitle>
          </CardHeader>
          <CardContent>
            <RecurringTemplateList
              templates={archived}
              currentMonth={month}
              archived
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
