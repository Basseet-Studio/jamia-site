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
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const delta = nextValue - previousValue;
  // Preserve the existing sign behavior: explicit "+" for positive, none for ≤ 0.
  const deltaStr = `${delta > 0 ? "+" : ""}${formatCurrency(delta, currency)}`;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("settings.warningTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("settings.warningBody", { delta: deltaStr })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
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
            {busy ? t("common.saving") : t("settings.warningAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { Button as SettingsButton };
