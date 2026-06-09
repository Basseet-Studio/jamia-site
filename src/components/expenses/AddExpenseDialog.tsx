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
import { createExpenseSchema, type CreateExpenseSchema } from "@/lib/schemas/expense";
import { createExpense } from "@/lib/services/expenses";
import { useAuth } from "@/lib/hooks/useAuth";
import { format } from "date-fns";

export function AddExpenseDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const form = useForm<CreateExpenseSchema>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      name: "",
      amount: 0,
      date: new Date(),
      note: null,
      isRecurring: false,
      recurringId: null,
    },
  });

  async function onSubmit(values: CreateExpenseSchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await createExpense(user.uid, values);
      form.reset({
        name: "",
        amount: 0,
        date: new Date(),
        note: null,
        isRecurring: false,
        recurringId: null,
      });
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
        <Button>Add expense</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ax-name">Name</Label>
            <Input id="ax-name" {...form.register("name")} placeholder="Water bill" />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ax-amount">Amount</Label>
            <Input
              id="ax-amount"
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
            <Label htmlFor="ax-date">Date</Label>
            <Input
              id="ax-date"
              type="date"
              value={format(form.watch("date"), "yyyy-MM-dd")}
              onChange={(e) => {
                const v = e.target.value;
                if (v) form.setValue("date", new Date(v));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ax-note">Note (optional)</Label>
            <Textarea id="ax-note" {...form.register("note")} maxLength={280} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
