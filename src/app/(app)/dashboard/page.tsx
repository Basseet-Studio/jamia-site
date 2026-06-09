"use client";
import { useEffect, useState } from "react";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { subscribeHouseholds, type HouseholdSummary } from "@/lib/services/dashboardData";
import { currentMonthKey } from "@/lib/utils/dates";
import { MoneyOnHandCard } from "@/components/summary/MoneyOnHandCard";
import { MonthSummaryBar } from "@/components/summary/MonthSummaryBar";
import { HouseholdTable } from "@/components/households/HouseholdTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { moh } = useMoneyOnHand();
  const month = currentMonthKey();
  const [rows, setRows] = useState<HouseholdSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const off = subscribeHouseholds(month, (data) => {
      setRows(data);
      setLoading(false);
    });
    return off;
  }, [month]);

  const totalCollected = rows.reduce((s, r) => s + (r.summary?.totalCollected ?? 0), 0);
  const totalTarget = rows.reduce((s, r) => s + (r.summary?.totalTarget ?? 0), 0);
  const totalFamilies = rows.reduce((s, r) => s + (r.summary?.totalFamilies ?? 0), 0);
  const familiesPaidFull = rows.reduce((s, r) => s + (r.summary?.familiesPaidFull ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <MoneyOnHandCard />
        <MonthSummaryBar month={month} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">This month at a glance</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Households" value={rows.length} />
              <Stat
                label="Paid in full"
                value={`${familiesPaidFull}/${totalFamilies}`}
              />
              <Stat label="Collected" value={totalCollected} currency={moh.currency} />
              <Stat label="Target" value={totalTarget} currency={moh.currency} />
            </dl>
          </CardContent>
        </Card>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Households</h2>
        <HouseholdTable rows={rows} loading={loading} />
      </section>
    </div>
  );
}

function Stat({ label, value, currency }: { label: string; value: number | string; currency?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">
        {typeof value === "number" && currency
          ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " " + currency
          : value}
      </dd>
    </div>
  );
}
