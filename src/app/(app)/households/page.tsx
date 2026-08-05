"use client";
import { useEffect, useMemo, useState } from "react";
import { subscribeHouseholds } from "@/lib/services/households";
import { AddHouseholdDialog } from "@/components/households/AddHouseholdDialog";
import { DeleteHouseholdDialog } from "@/components/households/DeleteHouseholdDialog";
import { EditHouseholdDialog } from "@/components/households/EditHouseholdDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import { format } from "date-fns";
import type { Household } from "@/lib/types";
import { FullReportButton } from "@/components/excel/FullReportButton";
import { PerScreenExportButton } from "@/components/excel/PerScreenExportButton";
import { fetchHouseholdExportData } from "@/lib/services/excelExportClient";
import { usePermissions } from "@/lib/hooks/usePermissions";

export default function HouseholdsPage() {
  const t = useT();
  const { canExport, canDelete, isFullAdmin } = usePermissions();
  const [list, setList] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameSort, setNameSort] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const off = subscribeHouseholds((rows) => {
      setList(rows);
      setLoading(false);
    });
    return off;
  }, []);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter((h) => h.name.toLowerCase().includes(q))
      : list;
    return filtered.slice().sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
        numeric: true,
      });
      return nameSort === "asc" ? cmp : -cmp;
    });
  }, [list, nameSort, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("households.heading")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            // TODO: localise this later
            placeholder="Search members…"
            className="w-[180px]"
            data-testid="household-search"
            aria-label="Search members"
          />
          <div className="flex items-center gap-2">
            <Label
              htmlFor="household-name-sort"
              className="text-xs text-muted-foreground"
            >
              {t("households.sortByName")}
            </Label>
            <Select
              value={nameSort}
              onValueChange={(value) => setNameSort(value as "asc" | "desc")}
            >
              <SelectTrigger
                id="household-name-sort"
                size="sm"
                className="w-[140px]"
                data-testid="household-name-sort"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">{t("households.sortAsc")}</SelectItem>
                <SelectItem value="desc">{t("households.sortDesc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canExport ? (
            <PerScreenExportButton
              buildFilter={() => ({ kind: "households" })}
              buildData={() => ({
                households: list,
                families: [],
                payments: [],
                expenses: [],
                recurringTemplates: [],
              })}
              fetchDataAsync={() => fetchHouseholdExportData(list)}
              // TODO: localise this later
              label="Export to Excel"
            />
          ) : null}
          {canExport ? <FullReportButton /> : null}
          <AddHouseholdDialog />
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("households.empty")}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {/* TODO: localise this later */}
          No members match the search.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((h) => {
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
                <CardContent className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    {created
                      ? t("households.createdOn", {
                          date: format(created, "yyyy-MM-dd"),
                        })
                      : t("common.dash")}
                  </span>
                  <div className="flex items-center gap-2">
                    {isFullAdmin ? <EditHouseholdDialog household={h} /> : null}
                    {canDelete ? (
                      <DeleteHouseholdDialog
                        householdId={h.id}
                        householdName={h.name}
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
