"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { withdrawExpense } from "@/lib/services/expenses";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { formatCurrency } from "@/lib/utils/currency";
import { useT } from "@/lib/i18n";
import type { MonthlyExpenseTotals } from "@/lib/types";

export interface WithdrawDialogProps {
  expenseId: string;
  expenseName: string;
  amount: number;
  month: string;
  isRecurring: boolean;
}

const TOTALS_TIMEOUT_MS = 3000;

export function WithdrawDialog({
  expenseId,
  expenseName,
  amount,
  month,
  isRecurring,
}: WithdrawDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { moh } = useMoneyOnHand();
  const t = useT();
  const cur = moh.currency || t("common.dash");
  const [totals, setTotals] = useState<MonthlyExpenseTotals | null>(null);
  const [totalsError, setTotalsError] = useState(false);

  // 002: best-effort fetch of monthly totals for the recurring-expense flow
  // (FR-031). 3s timeout; on failure the dialog shows a fallback message.
  useEffect(() => {
    if (!open || !isRecurring) {
      setTotals(null);
      setTotalsError(false);
      return;
    }
    let cancelled = false;
    setTotalsError(false);
    const timeout = window.setTimeout(() => {
      if (cancelled) return;
      setTotalsError(true);
    }, TOTALS_TIMEOUT_MS);
    import("@/lib/services/calendarView")
      .then((m) => m.getMonthlyTotals(month))
      .then((res) => {
        if (cancelled) return;
        setTotals(res);
        window.clearTimeout(timeout);
      })
      .catch(() => {
        if (cancelled) return;
        setTotalsError(true);
        window.clearTimeout(timeout);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, isRecurring, month]);

  async function onConfirm() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await withdrawExpense(user.uid, expenseId);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const amountFmt = formatCurrency(amount, cur);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t("expenses.withdrawButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRecurring
              ? t("recurring.withdrawConfirmTitle")
              : t("expenses.withdrawTitle", {
                  name: expenseName,
                  amount: amountFmt,
                })}
          </DialogTitle>
          <DialogDescription>
            {isRecurring
              ? t("recurring.withdrawConfirmBody", {
                  name: expenseName,
                  amount: amountFmt,
                })
              : t("expenses.withdrawBody")}
          </DialogDescription>
        </DialogHeader>
        {isRecurring ? (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-medium">{expenseName}</div>
            <div className="text-muted-foreground">{amountFmt}</div>
            {totals ? (
              <div className="mt-2 space-y-1">
                <div>
                  {t("summary.added")}: {formatCurrency(totals.totalAdded, cur)}
                </div>
                <div>
                  {t("summary.withdrawn")}:{" "}
                  {formatCurrency(totals.totalWithdrawn, cur)}
                </div>
                <div>
                  {t("summary.pending")}:{" "}
                  {formatCurrency(totals.totalPending, cur)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("calendar.shortfall.onTrack")}:{" "}
                  {formatCurrency(totals.shortfall.recurringTotal, cur)} ·{" "}
                  {t("calendar.shortfall.watch").split(":")[0]}:{" "}
                  {formatCurrency(totals.shortfall.shortfall, cur)}
                </div>
              </div>
            ) : totalsError ? (
              <div className="mt-2 text-xs text-muted-foreground">
                {/* TODO: localise this later — fallback */}
                Could not compute budget impact
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                {t("common.loading")}
              </div>
            )}
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? t("expenses.withdrawing") : t("expenses.withdrawAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
