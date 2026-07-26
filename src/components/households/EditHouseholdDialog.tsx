"use client";
import { useEffect, useState } from "react";
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
import {
  editHouseholdSchema,
  type EditHouseholdSchema,
} from "@/lib/schemas/household";
import { editHousehold } from "@/lib/services/households";
import { useT } from "@/lib/i18n";
import type { Household } from "@/lib/types";

export function EditHouseholdDialog({ household }: { household: Household }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const form = useForm<EditHouseholdSchema>({
    resolver: zodResolver(editHouseholdSchema),
    defaultValues: { name: household.name },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: household.name });
      setError(null);
    }
  }, [open, household.name, form]);

  async function onSubmit(values: EditHouseholdSchema) {
    setBusy(true);
    setError(null);
    try {
      await editHousehold(household.id, values);
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
          {t("households.editButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("households.editTitle")}</DialogTitle>
          <DialogDescription>
            {t("households.editDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="eh-name">{t("common.name")}</Label>
            <Input
              id="eh-name"
              {...form.register("name")}
              placeholder={t("households.namePlaceholder")}
              data-testid="edit-household-name"
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
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
