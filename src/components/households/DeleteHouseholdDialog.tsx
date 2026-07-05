"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteHousehold } from "@/lib/services/households";
import { hhError, hhLog } from "@/lib/debug/householdLog";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";

export function DeleteHouseholdDialog({
  householdId,
  householdName,
}: {
  householdId: string;
  householdName: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const { user } = useAuth();
  const t = useT();

  const matches = confirmText.trim() === householdName;

  async function onConfirm() {
    if (!user || !matches) {
      hhLog("deleteDialog:confirm-blocked", {
        hasUser: !!user,
        matches,
        householdId,
        householdName,
      });
      return;
    }
    setBusy(true);
    setError(null);
    hhLog("deleteDialog:confirm-click", {
      uid: user.uid,
      householdId,
      householdName,
      confirmText: confirmText.trim(),
    });
    try {
      await deleteHousehold(user.uid, householdId);
      hhLog("deleteDialog:success", { householdId, householdName });
      setOpen(false);
      setConfirmText("");
    } catch (e) {
      const err = e as Error & { code?: string };
      hhError("deleteDialog:error", {
        householdId,
        householdName,
        code: err.code,
        message: err.message,
      });
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          hhLog("deleteDialog:open", { householdId, householdName });
        } else {
          hhLog("deleteDialog:close", { householdId, householdName });
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          {t("households.deleteButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("households.deleteTitle", { name: householdName })}
          </DialogTitle>
          <DialogDescription>{t("households.deleteBody")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dh-name">{t("households.deleteConfirmLabel")}</Label>
          <Input
            id="dh-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={householdName}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!matches || busy}
          >
            {busy
              ? t("households.deleting")
              : t("households.deleteConfirmAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
