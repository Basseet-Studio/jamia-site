"use client";
import { useEffect, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
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

function valueKind(value: unknown): string {
  if (value === "") return '""';
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : "Date";
  }
  return typeof value;
}

function collectExpenseFieldErrors(
  errors: FieldErrors<CreateExpenseSchema>,
): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.message === "string" && record.message) {
      out.push({ path: path || "(root)", message: record.message });
    }
    for (const [key, child] of Object.entries(record)) {
      if (key === "message" || key === "type" || key === "ref" || key === "types") {
        continue;
      }
      if (child && typeof child === "object") {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(errors, "");
  return out;
}

function expenseSubmitSnapshot(
  fixedHouseholdId: string | null,
  values: {
    type?: unknown;
    householdId?: unknown;
    familyId?: unknown;
    mosqueSubCategory?: unknown;
    amount?: unknown;
    date?: unknown;
    note?: unknown;
  },
) {
  return {
    fixedHouseholdId,
    type: values.type,
    householdId: values.householdId,
    familyId: values.familyId,
    mosqueSubCategory: values.mosqueSubCategory,
    amountType: valueKind(values.amount),
    dateType: valueKind(values.date),
    noteType: valueKind(values.note),
  };
}

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

  function onInvalid(errors: FieldErrors<CreateExpenseSchema>) {
    console.warn("[jamia:expense] submit rejected", {
      errors: collectExpenseFieldErrors(errors),
      ...expenseSubmitSnapshot(fixedHouseholdId, form.getValues()),
    });
  }

  async function onSubmit(values: CreateExpenseSchema) {
    console.info(
      "[jamia:expense] submit accepted",
      expenseSubmitSnapshot(fixedHouseholdId, values),
    );
    if (!user) {
      console.warn("[jamia:expense] submit skipped: no signed-in user");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createExpense(user.uid, values);
      console.info("[jamia:expense] created", { id });
      form.reset(defaultExpenseValues(fixedHouseholdId));
      setOpen(false);
    } catch (e) {
      console.error("[jamia:expense] create failed", (e as Error).message);
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
            ? t("expenses.addHouseholdButton")
            : t("expenses.addButton")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("expenses.addTitle")}</DialogTitle>
          <DialogDescription>{t("expenses.addDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          className="space-y-4"
        >
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
