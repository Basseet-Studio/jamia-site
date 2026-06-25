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
  createExpenseSchema,
  type CreateExpenseSchema,
} from "@/lib/schemas/expense";
import { createExpense } from "@/lib/services/expenses";
import { subscribeHouseholds } from "@/lib/services/households";
import { subscribeFamilies } from "@/lib/services/families";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import { format } from "date-fns";
import type {
  ExpenseType,
  Family,
  Household,
  MosqueSubCategory,
} from "@/lib/types";

const MOSQUE_SUBS: MosqueSubCategory[] = ["maintenance", "salary", "other"];
const NONE = "__none__";

function defaultExpenseValues(
  fixedHouseholdId: string | null,
): CreateExpenseSchema {
  if (fixedHouseholdId) {
    return {
      name: "",
      amount: 0,
      date: new Date(),
      note: null,
      isRecurring: false,
      recurringId: null,
      type: "household",
      householdId: fixedHouseholdId,
      familyId: null,
      mosqueSubCategory: null,
    };
  }
  return {
    name: "",
    amount: 0,
    date: new Date(),
    note: null,
    isRecurring: false,
    recurringId: null,
    type: "mosque",
    householdId: null,
    familyId: null,
    mosqueSubCategory: "maintenance",
  };
}

export function AddExpenseDialog({
  fixedHouseholdId = null,
}: {
  fixedHouseholdId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const { user } = useAuth();
  const t = useT();

  const form = useForm<CreateExpenseSchema>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: defaultExpenseValues(fixedHouseholdId),
  });

  const type = form.watch("type");
  const selectedHouseholdId = form.watch("householdId");

  // TODO: localise this later — Households list load
  useEffect(() => {
    if (!open) return;
    return subscribeHouseholds(setHouseholds);
  }, [open]);

  // TODO: localise this later — Families list load (household-scoped)
  useEffect(() => {
    if (!open || type !== "household" || !selectedHouseholdId) {
      setFamilies([]);
      return;
    }
    return subscribeFamilies(selectedHouseholdId, setFamilies);
  }, [open, type, selectedHouseholdId]);

  // When the type changes, clear the other branch's fields (XOR enforced by the union).
  useEffect(() => {
    if (fixedHouseholdId) {
      form.setValue("type", "household");
      form.setValue("householdId", fixedHouseholdId);
      form.setValue("mosqueSubCategory", null);
      return;
    }
    if (type === "household") {
      form.setValue("mosqueSubCategory", null);
      // Don't clobber an already-picked householdId.
    } else {
      form.setValue("householdId", null);
      form.setValue("familyId", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, fixedHouseholdId]);

  async function onSubmit(values: CreateExpenseSchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      await createExpense(user.uid, values);
      form.reset(defaultExpenseValues(fixedHouseholdId));
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
          {fixedHouseholdId
            ? // TODO: localise this later
              "Add Household Expense"
            : t("expenses.addButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("expenses.addTitle")}</DialogTitle>
          <DialogDescription>{t("expenses.addDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!fixedHouseholdId ? (
          <div className="space-y-2">
            <Label htmlFor="ax-type">{t("expenses.fieldType")}</Label>
            <Select
              value={type}
              onValueChange={(v) =>
                form.setValue("type", v as ExpenseType, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="ax-type">
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
          ) : null}

          {fixedHouseholdId ? null : type === "household" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="ax-household">
                  {t("expenses.fieldHousehold")}
                </Label>
                <Select
                  value={form.watch("householdId") ?? NONE}
                  onValueChange={(v) =>
                    form.setValue("householdId", v === NONE ? "" : v, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="ax-household">
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
                <Label htmlFor="ax-family">
                  {t("expenses.fieldFamilyOptional")}
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
                  <SelectTrigger id="ax-family">
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
              <Label htmlFor="ax-sub">{t("expenses.fieldSubCategory")}</Label>
              <Select
                value={form.watch("mosqueSubCategory") ?? "maintenance"}
                onValueChange={(v) =>
                  form.setValue("mosqueSubCategory", v as MosqueSubCategory, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="ax-sub">
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
            <Label htmlFor="ax-name">{t("common.name")}</Label>
            <Input
              id="ax-name"
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
            <Label htmlFor="ax-amount">{t("common.amount")}</Label>
            <Input
              id="ax-amount"
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
            <Label htmlFor="ax-date">{t("common.date")}</Label>
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
            <Label htmlFor="ax-note">{t("common.noteOptional")}</Label>
            <Textarea id="ax-note" {...form.register("note")} maxLength={280} />
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
              {busy ? t("common.saving") : t("expenses.saveExpense")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
