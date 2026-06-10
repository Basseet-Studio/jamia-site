"use client";
import type { HouseholdMemberHistory } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { format } from "date-fns";

export function MemberHistoryTable({
  history,
  loading,
}: {
  history: HouseholdMemberHistory[];
  loading: boolean;
}) {
  const t = useT();

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    );
  }
  if (history.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("householdMembers.historyEmpty")}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-3 py-2 text-left font-medium">
              {t("householdMembers.historyWhen")}
            </th>
            <th className="px-3 py-2 text-left font-medium">
              {t("householdMembers.historyBy")}
            </th>
            <th className="px-3 py-2 text-left font-medium">
              {t("householdMembers.historyPrevious")}
            </th>
            <th className="px-3 py-2 text-left font-medium">
              {t("householdMembers.historyNew")}
            </th>
          </tr>
        </thead>
        <tbody>
          {history.map((row) => {
            const ts = row.changedAt?.toDate ? row.changedAt.toDate() : null;
            return (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 tabular-nums">
                  {ts ? format(ts, "yyyy-MM-dd HH:mm") : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.changedBy}</td>
                <td className="px-3 py-2">
                  {row.previousCount} · {row.previousNames.join(", ") || "—"}
                </td>
                <td className="px-3 py-2">
                  {row.newCount} · {row.newNames.join(", ") || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
