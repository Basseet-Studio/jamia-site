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
  createFamilySchema,
  type CreateFamilySchema,
} from "@/lib/schemas/family";
import { createFamily } from "@/lib/services/families";
import { subscribeSettings } from "@/lib/services/settings";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";

export function AddFamilyDialog({ householdId }: { householdId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const t = useT();
  const [defaultTarget, setDefaultTarget] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const off = subscribeSettings((s) =>
      setDefaultTarget(s?.defaultContributionTarget ?? null),
    );
    return off;
  }, [open]);

  const form = useForm<CreateFamilySchema>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: { householdId, name: "", contributionTarget: 0 },
  });

  // When settings load, prefill the target unless the user already typed.
  useEffect(() => {
    if (defaultTarget !== null && !form.getValues("contributionTarget")) {
      form.setValue("contributionTarget", defaultTarget);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTarget, open]);

  async function onSubmit(values: CreateFamilySchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await createFamily(user.uid, values);
      form.reset({
        householdId,
        name: "",
        contributionTarget: defaultTarget ?? 0,
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
        <Button>{t("families.addButton")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("families.addTitle")}</DialogTitle>
          <DialogDescription>{t("families.addDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fam-name">{t("common.name")}</Label>
            <Input id="fam-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fam-target">{t("families.monthlyTarget")}</Label>
            <Input
              id="fam-target"
              type="number"
              min={0}
              {...form.register("contributionTarget", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              {t("families.targetHelper")}
            </p>
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
