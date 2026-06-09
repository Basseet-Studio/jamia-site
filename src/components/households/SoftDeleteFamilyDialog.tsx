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
import { softDeleteFamily } from "@/lib/services/families";
import { useAuth } from "@/lib/hooks/useAuth";

export function SoftDeleteFamilyDialog({
  householdId,
  familyId,
  familyName,
  onDone,
}: {
  householdId: string;
  familyId: string;
  familyName: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  async function onConfirm() {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await softDeleteFamily(user.uid, householdId, familyId);
      setOpen(false);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          {/* TODO(i18n): button label */}
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {/* TODO(i18n): dialog title */}
            Remove {familyName}?
          </DialogTitle>
          <DialogDescription>
            {/* TODO(i18n): confirmation body */}
            This family will be removed from the active list. Payment history
            will be fully preserved.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "Removing…" : "Remove family"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
