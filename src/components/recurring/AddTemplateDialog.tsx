"use client";
import { useEffect, useState } from "react";
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
import { subscribeHouseholds } from "@/lib/services/households";
import { subscribeFamilies } from "@/lib/services/families";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import type {
  ExpenseType,
  Family,
  Household,
  MosqueSubCategory,
} from "@/lib/types";

const MOSQUE_SUBS: MosqueSubCategory[] = ["maintenance", "salary", "other"];
const NONE = "__none__";

export function AddTemplateDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const { user } = useAuth();
  const t = useT();

  const form = useForm<CreateRecurringTemplateSchema>({
    resolver: zodResolver(createRecurringTemplateSchema),
    defaultValues: {
      name: "",
      amount: 0,
      description: null,
      type: "mosque",
      householdId: null,
      familyId: null,
      mosqueSubCategory: "maintenance",
    },
  });

  const type = form.watch("type");
  const selectedHouseholdId = form.watch("householdId");

  // TODO: localise this later — Households load
  useEffect(() => {
    if (!open) return;
    return subscribeHouseholds(setHouseholds);
  }, [open]);

  useEffect(() => {
    if (!open || type !== "household" || !selectedHouseholdId) {
      setFamilies([]);
      return;
    }
    return subscribeFamilies(selectedHouseholdId, setFamilies);
  }, [open, type, selectedHouseholdId]);

  useEffect(() => {
    if (type === "household") {
      form.setValue("mosqueSubCategory", null);
    } else {
      form.setValue("householdId", null);
      form.setValue("familyId", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

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
        householdId: null,
        familyId: null,
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
        <Button>{t("recurring.addButton")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recurring.addTitle")}</DialogTitle>
          <DialogDescription>{t("recurring.addDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rt-type">{t("recurring.fieldType")}</Label>
            <Select
              value={type}
              onValueChange={(v) =>
                form.setValue("type", v as ExpenseType, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="rt-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mosque">
                  {t("expenseType.mosque")}
                </SelectItem>
                <SelectItem value="household">
                  {t("expenseType.household")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "household" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="rt-household">
                  {t("recurring.fieldHousehold")}
                </Label>
                <Select
                  value={form.watch("householdId") ?? NONE}
                  onValueChange={(v) =>
                    form.setValue("householdId", v === NONE ? "" : v, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="rt-household">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {households.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.householdId ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.householdId.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rt-family">
                  {t("recurring.fieldFamilyOptional")}
                </Label>
                <Select
                  value={form.watch("familyId") ?? NONE}
                  onValueChange={(v) =>
                    form.setValue("familyId", v === NONE ? null : v, {
                      shouldValidate: true,
                    })
                  }
                  disabled={!selectedHouseholdId}
                >
                  <SelectTrigger id="rt-family">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>—</SelectItem>
                    {families
                      .filter((f) => f.active)
                      .map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="rt-sub">{t("recurring.fieldSubCategory")}</Label>
              <Select
                value={form.watch("mosqueSubCategory") ?? "maintenance"}
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
          )}

          <div className="space-y-2">
            <Label htmlFor="rt-name">{t("common.name")}</Label>
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
            <Label htmlFor="rt-amount">{t("common.amount")}</Label>
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
            <Label htmlFor="rt-desc">{t("common.descriptionOptional")}</Label>
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
              {busy ? t("common.saving") : t("recurring.saveTemplate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
