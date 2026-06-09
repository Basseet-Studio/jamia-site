"use client";
import { useEffect, useState } from "react";
import {
  subscribeAllTimeExpenseSummary,
  subscribeMonthlyExpenseSummary,
  type AllTimeExpenseSummary,
  type MonthlyExpenseSummary,
} from "@/lib/services/derived";
import { formatCurrency } from "@/lib/utils/currency";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MonthSummaryBar({ month }: { month: string }) {
  const { moh } = useMoneyOnHand();
  const [m, setM] = useState<MonthlyExpenseSummary>({
    month,
    totalAdded: 0,
    totalWithdrawn: 0,
    totalPending: 0,
  });
  const [allTime, setAllTime] = useState<AllTimeExpenseSummary>({
    totalAdded: 0,
    totalWithdrawn: 0,
  });

  useEffect(() => {
    const off1 = subscribeMonthlyExpenseSummary(month, setM);
    const off2 = subscribeAllTimeExpenseSummary(setAllTime);
    return () => {
      off1();
      off2();
    };
  }, [month]);

  const cur = moh.currency || "—";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">
          {/* TODO(i18n): card title */}
          This month
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <Stat label="Added" value={formatCurrency(m.totalAdded, cur)} />
          <Stat label="Withdrawn" value={formatCurrency(m.totalWithdrawn, cur)} />
          <Stat label="Pending" value={formatCurrency(m.totalPending, cur)} />
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          {/* TODO(i18n): all-time helper */}
          All-time added: {formatCurrency(allTime.totalAdded, cur)} · withdrawn:{" "}
          {formatCurrency(allTime.totalWithdrawn, cur)}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
