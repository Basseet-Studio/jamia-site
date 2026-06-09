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
import { useAuth } from "@/lib/hooks/useAuth";

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

  const matches = confirmText.trim() === householdName;

  async function onConfirm() {
    if (!user || !matches) return;
    setBusy(true);
    setError(null);
    try {
      await deleteHousehold(user.uid, householdId);
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
        <Button variant="outline" size="sm" className="text-destructive">
          {/* TODO(i18n): button label */}
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {/* TODO(i18n): dialog title */}
            Delete {householdName}?
          </DialogTitle>
          <DialogDescription>
            {/* TODO(i18n): warning body */}
            This permanently deletes the household, all families, and all
            payments. This cannot be undone. Type the household name to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dh-name">
            {/* TODO(i18n): label */}
            Type the household name
          </Label>
          <Input
            id="dh-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={householdName}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!matches || busy}>
            {busy ? "Deleting…" : "Delete household"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
