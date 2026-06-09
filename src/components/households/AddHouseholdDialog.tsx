"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createHouseholdSchema, type CreateHouseholdSchema } from "@/lib/schemas/household";
import { createHousehold } from "@/lib/services/households";
import { useAuth } from "@/lib/hooks/useAuth";

export function AddHouseholdDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const form = useForm<CreateHouseholdSchema>({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: CreateHouseholdSchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await createHousehold(user.uid, values);
      form.reset();
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
        <Button>
          {/* TODO(i18n): button label */}
          Add household
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {/* TODO(i18n): dialog title */}
            Add household
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hh-name">
              {/* TODO(i18n): label */}
              Name
            </Label>
            <Input
              id="hh-name"
              {...form.register("name")}
              placeholder="Veeramangalam North"
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {/* TODO(i18n): cancel */}
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
              {/* TODO(i18n): save label */}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
