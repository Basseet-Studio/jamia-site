"use client";
/**
 * Mosque-only recurring template dialog. The household branch was removed
 * from `createRecurringTemplateSchema`; this dialog exposes only the
 * fields still allowed (name, amount, description, mosqueSubCategory).
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  createRecurringTemplateSchema,
  type CreateRecurringTemplateSchema,
} from "@/lib/schemas/recurringTemplate";
import { createRecurringTemplate } from "@/lib/services/recurring";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import type { MosqueSubCategory } from "@/lib/types";

const MOSQUE_SUBS: MosqueSubCategory[] = ["maintenance", "salary", "other"];

export function AddMosqueTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const t = useT();

  const form = useForm<CreateRecurringTemplateSchema>({
    resolver: zodResolver(createRecurringTemplateSchema),
    defaultValues: {
      name: "",
      amount: 0,
      description: null,
      type: "mosque",
      mosqueSubCategory: "maintenance",
    },
  });

  async function onSubmit(values: CreateRecurringTemplateSchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await createRecurringTemplate(user.uid, values);
      form.reset({
        name: "",
        amount: 0,
        description: null,
        type: "mosque",
        mosqueSubCategory: "maintenance",
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
        <Button>{t("expenses.recurring.addButton")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("expenses.recurring.addTitle")}</DialogTitle>
          <DialogDescription>
            {t("expenses.recurring.addDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rt-sub">
              {t("expenses.recurring.fieldSubCategory")}
            </Label>
            <Select
              value={form.watch("mosqueSubCategory")}
              onValueChange={(v) =>
                form.setValue("mosqueSubCategory", v as MosqueSubCategory, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="rt-sub">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOSQUE_SUBS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`mosqueSubCategory.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rt-name">{t("expenses.recurring.fieldName")}</Label>
            <Input
              id="rt-name"
              {...form.register("name")}
              placeholder={t("expenses.namePlaceholder")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rt-amount">
              {t("expenses.recurring.fieldAmount")}
            </Label>
            <Input
              id="rt-amount"
              type="number"
              min={0}
              step="0.01"
              {...form.register("amount", { valueAsNumber: true })}
            />
            {form.formState.errors.amount ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.amount.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="rt-desc">
              {t("expenses.recurring.fieldDescription")}
            </Label>
            <Textarea
              id="rt-desc"
              {...form.register("description")}
              maxLength={280}
            />
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
              {busy ? t("common.saving") : t("expenses.recurring.saveTemplate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}