"use client";
import { useEffect, useState } from "react";
import { subscribeHouseholds } from "@/lib/services/households";
import { AddHouseholdDialog } from "@/components/households/AddHouseholdDialog";
import { DeleteHouseholdDialog } from "@/components/households/DeleteHouseholdDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import { format } from "date-fns";
import type { Household } from "@/lib/types";
import { FullReportButton } from "@/components/excel/FullReportButton";
import { PerScreenExportButton } from "@/components/excel/PerScreenExportButton";

export default function HouseholdsPage() {
  const t = useT();
  const [list, setList] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = subscribeHouseholds((rows) => {
      setList(rows);
      setLoading(false);
    });
    return off;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("households.heading")}</h1>
        <div className="flex items-center gap-2">
          <PerScreenExportButton
            buildFilter={() => ({ kind: "households" })}
            buildData={() => ({
              households: list,
              families: [],
              payments: [],
              expenses: [],
              recurringTemplates: [],
            })}
            // TODO: localise this later
            label="Export to Excel"
          />
          <FullReportButton />
          <AddHouseholdDialog />
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("households.empty")}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((h) => {
            const created = h.createdAt?.toDate ? h.createdAt.toDate() : null;
            return (
              <Card key={h.id}>
                <CardHeader>
                  <CardTitle>
                    <a href={`/households/${h.id}`} className="hover:underline">
                      {h.name}
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {created
                      ? t("households.createdOn", {
                          date: format(created, "yyyy-MM-dd"),
                        })
                      : t("common.dash")}
                  </span>
                  <DeleteHouseholdDialog
                    householdId={h.id}
                    householdName={h.name}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
