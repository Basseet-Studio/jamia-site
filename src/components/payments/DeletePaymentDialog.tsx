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
import { deletePayment } from "@/lib/services/payments";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { formatCurrency } from "@/lib/utils/currency";
import { useT } from "@/lib/i18n";

export function DeletePaymentDialog({
  householdId,
  familyId,
  paymentId,
  paymentAmount,
  familyName,
}: {
  householdId: string;
  familyId: string;
  paymentId: string;
  paymentAmount: number;
  familyName: string;
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
      await deletePayment(user.uid, householdId, familyId, paymentId);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const forFamily = familyName ? ` ${t("common.for")} ${familyName}` : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          {t("common.delete")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("payments.deleteTitle", {
              amount: formatCurrency(paymentAmount, cur),
              forFamily,
            })}
          </DialogTitle>
          <DialogDescription>{t("payments.deleteBody")}</DialogDescription>
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
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? t("payments.deleting") : t("payments.deleteAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
