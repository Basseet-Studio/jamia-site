"use client";
import { use, useEffect, useMemo, useState } from "react";
import {
  subscribePayments,
  subscribeFamilyPaymentsByMonth,
} from "@/lib/services/payments";
import { subscribeFamily } from "@/lib/services/families";
import { PaymentHistoryTable } from "@/components/payments/PaymentHistoryTable";
import { MonthNavigator } from "@/components/nav/MonthNavigator";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { currentMonthKey, toMonthKey } from "@/lib/utils/dates";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { formatCurrency } from "@/lib/utils/currency";
import { useT } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Family, Payment } from "@/lib/types";

type Filter = "all" | { month: string };

export default function FamilyHistoryPage({
  params,
}: {
  params: Promise<{ householdId: string; familyId: string }>;
}) {
  const { householdId, familyId } = use(params);
  const t = useT();
  const [family, setFamily] = useState<Family | null>(null);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [monthPayments, setMonthPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<Filter>({ month: currentMonthKey() });
  const [monthNav, setMonthNav] = useState<string>(currentMonthKey());
  const [loading, setLoading] = useState(true);
  const { moh } = useMoneyOnHand();

  useEffect(() => {
    const off = subscribeFamily(householdId, familyId, (f) => {
      setFamily(f);
      setLoading(false);
    });
    return off;
  }, [householdId, familyId]);

  useEffect(() => {
    const off = subscribePayments(householdId, familyId, setAllPayments);
    return off;
  }, [householdId, familyId]);

  useEffect(() => {
    if (filter === "all") return;
    const off = subscribeFamilyPaymentsByMonth(
      householdId,
      familyId,
      filter.month,
      setMonthPayments,
    );
    return off;
  }, [householdId, familyId, filter]);

  const displayed = useMemo(() => {
    if (filter === "all") return allPayments;
    return monthPayments;
  }, [filter, allPayments, monthPayments]);

  const totalPaid = displayed.reduce((s, p) => s + (p.amount ?? 0), 0);
  const target = family?.contributionTarget ?? 0;
  const cur = moh.currency || t("common.dash");
  const period =
    filter === "all"
      ? t("payments.allTime")
      : toMonthKey(new Date(filter.month + "-01"));
  const allTimePeriod = t("payments.allTime");

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    );
  }
  if (!family) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("payments.familyNotFound")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {t("payments.historyHeading", { name: family.name })}
        </h1>
        <RecordPaymentDialog
          householdId={householdId}
          familyId={familyId}
          familyName={family.name}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("payments.summary")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("payments.totalPaid", { period })}
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(totalPaid, cur)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("payments.familyTarget")}
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatCurrency(target, cur)}
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              {t("payments.allTime")}
            </Button>
            <div className="flex items-center gap-2">
              <MonthNavigator
                month={monthNav}
                onChange={(m) => {
                  setMonthNav(m);
                  setFilter({ month: m });
                }}
                capAtCurrent={false}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {t("payments.showing", {
                period: filter === "all" ? allTimePeriod : period,
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <PaymentHistoryTable
        payments={displayed}
        householdId={householdId}
        family={family}
      />
    </div>
  );
}
