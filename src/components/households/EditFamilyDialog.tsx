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
import { editFamilySchema, type EditFamilySchema } from "@/lib/schemas/family";
import { editFamily } from "@/lib/services/families";
import { useAuth } from "@/lib/hooks/useAuth";
import type { Family } from "@/lib/types";

export function EditFamilyDialog({
  householdId,
  family,
}: {
  householdId: string;
  family: Family;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const form = useForm<EditFamilySchema>({
    resolver: zodResolver(editFamilySchema),
    defaultValues: {
      householdId,
      familyId: family.id,
      name: family.name,
      contributionTarget: family.contributionTarget,
    },
  });

  async function onSubmit(values: EditFamilySchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await editFamily(user.uid, householdId, family.id, {
        name: values.name,
        contributionTarget: values.contributionTarget,
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
        <Button variant="outline" size="sm">
          {/* TODO(i18n): button label */}
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {/* TODO(i18n): dialog title */}
            Edit family
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ef-name">Name</Label>
            <Input id="ef-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ef-target">Monthly contribution target</Label>
            <Input
              id="ef-target"
              type="number"
              min={0}
              {...form.register("contributionTarget", { valueAsNumber: true })}
            />
            {form.formState.errors.contributionTarget ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.contributionTarget.message}
              </p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
