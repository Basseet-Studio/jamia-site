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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { editFamilySchema, type EditFamilySchema } from "@/lib/schemas/family";
import { editFamily } from "@/lib/services/families";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
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
  const t = useT();

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
          {t("families.editButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("families.editTitle")}</DialogTitle>
          <DialogDescription>{t("families.editDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ef-name">{t("common.name")}</Label>
            <Input id="ef-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ef-target">{t("families.monthlyTarget")}</Label>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
