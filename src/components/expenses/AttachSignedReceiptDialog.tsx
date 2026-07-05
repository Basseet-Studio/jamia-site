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
import { attachExpenseReceipt } from "@/lib/services/expenses";
import { AttachmentUploadField } from "@/components/receipts/AttachmentUploadField";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";

export interface AttachSignedReceiptDialogProps {
  expenseId: string;
  expenseName: string;
}

export function AttachSignedReceiptDialog({
  expenseId,
  expenseName,
}: AttachSignedReceiptDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const { user } = useAuth();
  const t = useT();

  async function onConfirm() {
    if (!user || !attachmentFile) return;
    setBusy(true);
    setError(null);
    try {
      await attachExpenseReceipt(user.uid, expenseId, attachmentFile);
      setAttachmentFile(null);
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
          Attach scan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach signed receipt</DialogTitle>
          <DialogDescription>
            Upload the signed receipt scan for {expenseName}.
          </DialogDescription>
        </DialogHeader>
        <AttachmentUploadField
          id={`attach-receipt-${expenseId}`}
          label="Signed receipt scan"
          file={attachmentFile}
          onFileChange={setAttachmentFile}
          optional={false}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={onConfirm} disabled={busy || !attachmentFile}>
            {busy ? t("common.saving") : "Attach"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
