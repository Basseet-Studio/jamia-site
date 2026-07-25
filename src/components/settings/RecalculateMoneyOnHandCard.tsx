"use client";
/**
 * Admin control: rebuild money on hand from opening + all Varisankya −
 * withdrawn Chelavakal. Shows a confirm dialog and a post-run breakdown.
 */
import { useEffect, useState } from "react";
import {
  recalculateMoneyOnHand,
  type RecalculateMoneyOnHandResult,
} from "@/lib/services/recalculateMoneyOnHand";
import { subscribeSettings } from "@/lib/services/settings";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { useT } from "@/lib/i18n";

export function RecalculateMoneyOnHandCard() {
  const { user } = useAuth();
  const t = useT();
  const [currency, setCurrency] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecalculateMoneyOnHandResult | null>(
    null,
  );

  useEffect(() => {
    const off = subscribeSettings((s) => {
      setCurrency(s?.currency ?? "");
    });
    return off;
  }, []);

  async function run() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const r = await recalculateMoneyOnHand(user.uid);
      setResult(r);
      setConfirmOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cur = currency || t("common.dash");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.recalculateTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("settings.recalculateHelper")}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={!user || busy}
          >
            {t("settings.recalculateButton")}
          </Button>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          {result ? (
            <dl className="space-y-1 text-sm">
              <BreakdownRow
                label={t("settings.recalculatePrevious")}
                value={formatCurrency(result.previous, cur)}
              />
              <BreakdownRow
                label={t("settings.recalculateNext")}
                value={formatCurrency(result.next, cur)}
              />
              <BreakdownRow
                label={t("settings.recalculateOpening")}
                value={formatCurrency(result.openingBalance, cur)}
              />
              <BreakdownRow
                label={t("settings.recalculatePayments")}
                value={formatCurrency(result.paymentsSum, cur)}
              />
              <BreakdownRow
                label={t("settings.recalculateWithdrawn")}
                value={formatCurrency(result.withdrawnSum, cur)}
              />
            </dl>
          ) : null}
        </CardContent>
      </Card>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.recalculateConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.recalculateConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await run();
              }}
              disabled={busy}
            >
              {busy
                ? t("settings.recalculateWorking")
                : t("settings.recalculateConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
