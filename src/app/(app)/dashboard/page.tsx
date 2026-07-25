"use client";
import { useEffect, useState } from "react";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import {
  subscribeHouseholds,
  type HouseholdSummary,
} from "@/lib/services/dashboardData";
import { currentMonthKey } from "@/lib/utils/dates";
import { MoneyOnHandCard } from "@/components/summary/MoneyOnHandCard";
import { MonthSummaryBar } from "@/components/summary/MonthSummaryBar";
import { HouseholdTable } from "@/components/households/HouseholdTable";
import { LogPaymentCard } from "@/components/payments/LogPaymentCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { FullReportButton } from "@/components/excel/FullReportButton";
import { usePermissions } from "@/lib/hooks/usePermissions";

export default function DashboardPage() {
  const t = useT();
  const { canExport, canFinancial } = usePermissions();
  const month = currentMonthKey();
  const [refreshKey, setRefreshKey] = useState(0);
  const [rows, setRows] = useState<HouseholdSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const off = subscribeHouseholds(month, (data) => {
      setRows(data);
      setLoading(false);
    });
    return off;
  }, [month, refreshKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("dashboard.heading")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            {t("dashboard.refresh")}
          </Button>
          {canExport ? <FullReportButton /> : null}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <MoneyOnHandCard key={`moh-${refreshKey}`} />
        <MonthSummaryBar key={`month-${refreshKey}`} month={month} />
        <AtAGlanceCard
          key={`glance-${refreshKey}`}
          rows={rows}
          loading={loading}
        />
      </div>
      <section>
        <h2 className="mb-2 text-lg font-semibold">
          {t("dashboard.householdsSection")}
        </h2>
        <HouseholdTable rows={rows} loading={loading} />
      </section>
      <section>
        {canFinancial ? <LogPaymentCard /> : null}
      </section>
    </div>
  );
}

function AtAGlanceCard({
  rows,
  loading,
}: {
  rows: HouseholdSummary[];
  loading: boolean;
}) {
  const { moh } = useMoneyOnHand();
  const t = useT();

  const totalCollected = rows.reduce(
    (s, r) => s + (r.summary?.totalCollected ?? 0),
    0,
  );
  const totalTarget = rows.reduce(
    (s, r) => s + (r.summary?.totalTarget ?? 0),
    0,
  );
  const totalFamilies = rows.reduce(
    (s, r) => s + (r.summary?.totalFamilies ?? 0),
    0,
  );
  const familiesPaidFull = rows.reduce(
    (s, r) => s + (r.summary?.familiesPaidFull ?? 0),
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">
          {t("dashboard.atAGlance")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Stat label={t("dashboard.householdsCount")} value={rows.length} />
            <Stat
              label={t("dashboard.paidInFull")}
              value={`${familiesPaidFull}/${totalFamilies}`}
            />
            <Stat
              label={t("dashboard.collected")}
              value={totalCollected}
              currency={moh.currency}
            />
            <Stat
              label={t("dashboard.target")}
              value={totalTarget}
              currency={moh.currency}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  currency,
}: {
  label: string;
  value: number | string;
  currency?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">
        {typeof value === "number" && currency
          ? new Intl.NumberFormat("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(value) +
            ` ${currency}`
          : value}
      </dd>
    </div>
  );
}
