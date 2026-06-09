"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { recordPaymentSchema, type RecordPaymentSchema } from "@/lib/schemas/payment";
import { recordPayment } from "@/lib/services/payments";
import { useAuth } from "@/lib/hooks/useAuth";
import { format } from "date-fns";

export function RecordPaymentDialog({
  householdId,
  familyId,
  familyName,
}: {
  householdId: string;
  familyId: string;
  familyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const form = useForm<RecordPaymentSchema>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      householdId,
      familyId,
      amount: 0,
      date: new Date(),
      note: null,
    },
  });

  async function onSubmit(values: RecordPaymentSchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await recordPayment(user.uid, values);
      form.reset({ householdId, familyId, amount: 0, date: new Date(), note: null });
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
        <Button size="sm">
          {/* TODO(i18n): button label */}
          Record payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {/* TODO(i18n): dialog title */}
            Record payment for {familyName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-amount">Amount</Label>
            <Input
              id="rp-amount"
              type="number"
              min={0}
              step="0.01"
              {...form.register("amount", { valueAsNumber: true })}
            />
            {form.formState.errors.amount ? (
              <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-date">Date</Label>
            <Input
              id="rp-date"
              type="date"
              value={format(form.watch("date"), "yyyy-MM-dd")}
              onChange={(e) => {
                const v = e.target.value;
                if (v) form.setValue("date", new Date(v));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-note">Note (optional)</Label>
            <Textarea
              id="rp-note"
              {...form.register("note")}
              maxLength={280}
              placeholder="Cash, transfer, etc."
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
