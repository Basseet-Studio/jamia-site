"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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

export function OpeningBalanceWarning({
  open,
  onOpenChange,
  previousValue,
  nextValue,
  currency,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previousValue: number;
  nextValue: number;
  currency: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const delta = nextValue - previousValue;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change opening balance?</AlertDialogTitle>
          <AlertDialogDescription>
            Money on hand will shift by {delta > 0 ? "+" : ""}
            {formatCurrency(delta, currency)}. This is a one-time seed
            adjustment; future changes here also shift money on hand.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
          >
            {busy ? "Saving…" : "Confirm change"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { Button as SettingsButton };
