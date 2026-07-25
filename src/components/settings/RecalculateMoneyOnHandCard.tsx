"use client";
/**
 * Admin control: rebuild money on hand from opening + all Varisankya −
 * withdrawn Chelavakal, or wipe all financial rows and zero the books
 * while keeping members.
 */
import { useEffect, useState } from "react";
import {
  recalculateMoneyOnHand,
  type RecalculateMoneyOnHandResult,
} from "@/lib/services/recalculateMoneyOnHand";
import {
  resetFinancialBooksToZero,
  type ResetFinancialBooksResult,
} from "@/lib/services/resetFinancialBooks";
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
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecalculateMoneyOnHandResult | null>(
    null,
  );
  const [resetResult, setResetResult] =
    useState<ResetFinancialBooksResult | null>(null);

  useEffect(() => {
    const off = subscribeSettings((s) => {
      setCurrency(s?.currency ?? "");
    });
    return off;
  }, []);

  async function runRecalculate() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const r = await recalculateMoneyOnHand(user.uid);
      setResult(r);
      setResetResult(null);
      setConfirmOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runReset() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const r = await resetFinancialBooksToZero(user.uid);
      setResetResult(r);
      setResult(null);
      setResetOpen(false);
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={!user || busy}
            >
              {t("settings.recalculateButton")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setResetOpen(true)}
              disabled={!user || busy}
            >
              {t("settings.resetBooksButton")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("settings.resetBooksHelper")}
          </p>
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
          {resetResult ? (
            <dl className="space-y-1 text-sm">
              <BreakdownRow
                label={t("settings.resetBooksPreviousMoh")}
                value={formatCurrency(resetResult.previousMoneyOnHand, cur)}
              />
              <BreakdownRow
                label={t("settings.resetBooksDeletedPayments")}
                value={String(resetResult.deletedPayments)}
              />
              <BreakdownRow
                label={t("settings.resetBooksDeletedExpenses")}
                value={String(resetResult.deletedExpenses)}
              />
              <BreakdownRow
                label={t("settings.resetBooksNewTotal")}
                value={formatCurrency(0, cur)}
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
                await runRecalculate();
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
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.resetBooksConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.resetBooksConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                await runReset();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy
                ? t("settings.resetBooksWorking")
                : t("settings.resetBooksConfirmAction")}
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
