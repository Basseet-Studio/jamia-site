"use client";
import { use, useEffect, useMemo, useState } from "react";
import { subscribeFamilies } from "@/lib/services/families";
import { subscribeFamilyMonthlyStatuses } from "@/lib/services/derived";
import { subscribeHousehold } from "@/lib/services/households";
import { subscribeHouseholdPendingExpenses } from "@/lib/services/expenses";
import { AddFamilyDialog } from "@/components/households/AddFamilyDialog";
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { FamilyRow } from "@/components/households/FamilyRow";
import { MonthNavigator } from "@/components/nav/MonthNavigator";
import { currentMonthKey, toMonthKey } from "@/lib/utils/dates";
import { useT } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  Expense,
  Family,
  FamilyMonthlyStatus,
  FamilyMonthlySummary,
  Household,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { useHouseholdFinancialSummary } from "@/lib/hooks/useHouseholdFinancialSummary";
import { FullReportButton } from "@/components/excel/FullReportButton";
import { PerScreenExportButton } from "@/components/excel/PerScreenExportButton";

const STATUS_OPTIONS: FamilyMonthlyStatus[] = [
  "Unpaid",
  "Partial",
  "Met",
  "Over",
];

export default function HouseholdDetailPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = use(params);
  const t = useT();
  const { moh } = useMoneyOnHand();
  const cur = moh.currency || t("common.dash");
  const [household, setHousehold] = useState<Household | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [statuses, setStatuses] = useState<FamilyMonthlySummary[]>([]);
  const [householdExpenses, setHouseholdExpenses] = useState<Expense[]>([]);
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [showSoftDeleted, setShowSoftDeleted] = useState<boolean>(false);
  const [nameSort, setNameSort] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState<"all" | FamilyMonthlyStatus>(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const financialSummary = useHouseholdFinancialSummary(householdId);

  useEffect(() => {
    const off = subscribeHousehold(householdId, (h) => {
      setHousehold(h);
      setLoading(false);
    });
    return off;
  }, [householdId]);

  useEffect(() => {
    const off = subscribeFamilies(householdId, setFamilies);
    return off;
  }, [householdId]);

  useEffect(() => {
    const off = subscribeFamilyMonthlyStatuses(householdId, month, setStatuses);
    return off;
  }, [householdId, month]);

  useEffect(() => {
    const off = subscribeHouseholdPendingExpenses(
      householdId,
      setHouseholdExpenses,
    );
    return off;
  }, [householdId]);

  const statusById = useMemo(() => {
    const m = new Map<string, FamilyMonthlySummary>();
    statuses.forEach((s) => m.set(s.familyId, s));
    return m;
  }, [statuses]);

  const visibleFamilies = useMemo(() => {
    const filtered = families.filter((f) => {
      if (!showSoftDeleted && !f.active) return false;
      if (statusFilter === "all") return true;
      const status = statusById.get(f.id)?.status ?? "Unpaid";
      return status === statusFilter;
    });
    return filtered.sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
      });
      return nameSort === "asc" ? cmp : -cmp;
    });
  }, [families, showSoftDeleted, statusFilter, statusById, nameSort]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    );
  }
  if (!household || !household.active) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("householdDetail.notFound")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{household.name}</h1>
        <div className="flex items-center gap-3">
          <MonthNavigator month={month} onChange={setMonth} />
          <AddFamilyDialog householdId={householdId} />
          <FullReportButton />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("householdDetail.totalContributions")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatCurrency(financialSummary.totalContributions, cur)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("householdDetail.totalExpenses")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatCurrency(financialSummary.totalExpenses, cur)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("householdDetail.net")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatCurrency(financialSummary.net, cur)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>{t("householdDetail.families")}</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="family-name-sort"
                className="text-xs text-muted-foreground"
              >
                {t("householdDetail.sortByName")}
              </Label>
              <Select
                value={nameSort}
                onValueChange={(value) =>
                  setNameSort(value as "asc" | "desc")
                }
              >
                <SelectTrigger
                  id="family-name-sort"
                  size="sm"
                  className="w-[140px]"
                  data-testid="family-name-sort"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">
                    {t("householdDetail.sortAsc")}
                  </SelectItem>
                  <SelectItem value="desc">
                    {t("householdDetail.sortDesc")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label
                htmlFor="family-status-filter"
                className="text-xs text-muted-foreground"
              >
                {t("householdDetail.filterByStatus")}
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as "all" | FamilyMonthlyStatus)
                }
              >
                <SelectTrigger
                  id="family-status-filter"
                  size="sm"
                  className="w-[130px]"
                  data-testid="family-status-filter"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("householdDetail.statusAll")}
                  </SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(`paymentStatus.${status}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showSoftDeleted}
                onChange={(e) => setShowSoftDeleted(e.target.checked)}
                className="size-3.5 rounded border-border"
                data-testid="show-soft-deleted-toggle"
              />
              {/* TODO: localise this later */}
              Show soft-deleted
            </label>
            <PerScreenExportButton
              buildFilter={() => ({
                kind: "families",
                householdId,
                showSoftDeleted,
                month,
              })}
              buildData={() => ({
                households: household ? [household] : [],
                families,
                payments: [],
                expenses: [],
                recurringTemplates: [],
              })}
              // TODO: localise this later
              label="Export families"
            />
          </div>
        </CardHeader>
        <CardContent>
          {families.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("householdDetail.noFamilies")}
            </p>
          ) : visibleFamilies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("householdDetail.noMatchingFamilies")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("householdDetail.tableName")}</TableHead>
                  <TableHead className="text-right">
                    {t("householdDetail.tableTarget")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("householdDetail.tablePaid", {
                      month: toMonthKey(new Date(month + "-01")),
                    })}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("householdDetail.tableStatus")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("families.tableMembers")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("householdDetail.tableActions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFamilies.map((f) => (
                  <FamilyRow
                    key={f.id}
                    householdId={householdId}
                    family={f}
                    status={statusById.get(f.id) ?? null}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{t("householdDetail.householdExpensesHeading")}</CardTitle>
          <AddExpenseDialog fixedHouseholdId={householdId} />
        </CardHeader>
        <CardContent>
          {householdExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("householdDetail.noPendingHouseholdExpenses")}
            </p>
          ) : (
            <ExpenseTable
              expenses={householdExpenses.slice().sort((a, b) => {
                const ad = a.date?.toDate ? a.date.toDate().getTime() : 0;
                const bd = b.date?.toDate ? b.date.toDate().getTime() : 0;
                return bd - ad;
              })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
