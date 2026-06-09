"use client";
/** MoneyOnHandCard — live money on hand. */
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { formatCurrency } from "@/lib/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

export function MoneyOnHandCard() {
  const { moh, loading } = useMoneyOnHand();
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">
          {t("summary.moneyOnHand")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums">
          {loading
            ? "…"
            : formatCurrency(moh.value, moh.currency || t("common.dash"))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("summary.moneyOnHandHelper")}
        </p>
      </CardContent>
    </Card>
  );
}
