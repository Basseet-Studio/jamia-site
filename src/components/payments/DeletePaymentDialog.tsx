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
import {
  deletePayment,
  listPaymentsByCoverageGroup,
} from "@/lib/services/payments";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { formatCurrency } from "@/lib/utils/currency";
import { useT } from "@/lib/i18n";
import type { Payment } from "@/lib/types";

export function DeletePaymentDialog({
  householdId,
  familyId,
  paymentId,
  paymentAmount,
  familyName,
  coverageGroupId,
}: {
  householdId: string;
  familyId: string;
  paymentId: string;
  paymentAmount: number;
  familyName: string;
  /** 003 — when present, the dialog detects a coverage group and prompts the
   * admin with the sibling list before confirming. */
  coverageGroupId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<Payment[]>([]);
  const { user } = useAuth();
  const { moh } = useMoneyOnHand();
  const t = useT();
  const cur = moh.currency || t("common.dash");

  // 003 — when the dialog is opened on a payment that has a coverageGroupId,
  // fetch the sibling list so the confirmation message can name them.
  useEffect(() => {
    if (!open || !coverageGroupId) {
      setSiblings([]);
      return;
    }
    let cancelled = false;
    void listPaymentsByCoverageGroup(
      householdId,
      familyId,
      coverageGroupId,
    ).then((rows) => {
      if (!cancelled) setSiblings(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, coverageGroupId, householdId, familyId]);

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
  const isGroup = !!coverageGroupId && siblings.length > 1;
  const siblingCount = Math.max(0, siblings.length - 1);
  // Sibling months excluding the one being deleted — these are the ones the
  // group prompt must list. Sorted oldest-first to match the commit order.
  const siblingMonths = siblings
    .filter((p) => p.id !== paymentId)
    .map((p) => p.month)
    .sort();

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
          {isGroup ? (
            <DialogDescription>
              {/* TODO: localise this later */}
              {`This will also remove ${siblingCount} cascaded payment${siblingCount === 1 ? "" : "s"} in this coverage group: ${siblingMonths.join(", ")}. Continue?`}
            </DialogDescription>
          ) : (
            <DialogDescription>{t("payments.deleteBody")}</DialogDescription>
          )}
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
