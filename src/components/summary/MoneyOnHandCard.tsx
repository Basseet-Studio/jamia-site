"use client";
/** MoneyOnHandCard — live money on hand. */
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { formatCurrency } from "@/lib/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MoneyOnHandCard() {
  const { moh, loading } = useMoneyOnHand();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">
          {/* TODO(i18n): card title */}
          Money on hand
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums">
          {loading ? "…" : formatCurrency(moh.value, moh.currency || "—")}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {/* TODO(i18n): helper text */}
          Opening balance + all payments − all withdrawn expenses (all time).
        </p>
      </CardContent>
    </Card>
  );
}
