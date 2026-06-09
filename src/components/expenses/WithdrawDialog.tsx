"use client";
import { useState } from "react";
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

export function WithdrawDialog({
  expenseId,
  expenseName,
  amount,
}: {
  expenseId: string;
  expenseName: string;
  amount: number;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { moh } = useMoneyOnHand();
  const t = useT();
  const cur = moh.currency || t("common.dash");

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
            {t("expenses.withdrawTitle", {
              name: expenseName,
              amount: formatCurrency(amount, cur),
            })}
          </DialogTitle>
          <DialogDescription>{t("expenses.withdrawBody")}</DialogDescription>
        </DialogHeader>
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
