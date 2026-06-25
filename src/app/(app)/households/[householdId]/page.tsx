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
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
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
import type {
  Expense,
  Family,
  FamilyMonthlySummary,
  Household,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { useHouseholdFinancialSummary } from "@/lib/hooks/useHouseholdFinancialSummary";

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
    const off = subscribeHouseholdPendingExpenses(householdId, setHouseholdExpenses);
    return off;
  }, [householdId]);

  const statusById = useMemo(() => {
    const m = new Map<string, FamilyMonthlySummary>();
    statuses.forEach((s) => m.set(s.familyId, s));
    return m;
  }, [statuses]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    );
  }
  if (!household) {
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
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader>
            {/* TODO: localise this later */}
            <CardTitle>Total Contributions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatCurrency(financialSummary.totalContributions, cur)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            {/* TODO: localise this later */}
            <CardTitle>Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatCurrency(financialSummary.totalExpenses, cur)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            {/* TODO: localise this later */}
            <CardTitle>Net</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatCurrency(financialSummary.net, cur)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("householdDetail.families")}</CardTitle>
        </CardHeader>
        <CardContent>
          {families.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("householdDetail.noFamilies")}
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
                {families.map((f) => (
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
          {/* TODO: localise this later */}
          <CardTitle>Household Expenses</CardTitle>
          <AddExpenseDialog fixedHouseholdId={householdId} />
        </CardHeader>
        <CardContent>
          {householdExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {/* TODO: localise this later */}
              No pending household expenses.
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

      <Card>
        <CardHeader>
          <CardTitle>{t("householdDetail.quickActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {families
              .filter((f) => f.active)
              .map((f) => (
                <RecordPaymentDialog
                  key={f.id}
                  householdId={householdId}
                  familyId={f.id}
                  familyName={f.name}
                />
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
