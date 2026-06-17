"use client";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  recordPaymentSchema,
  type RecordPaymentSchema,
} from "@/lib/schemas/payment";
import {
  recordPaymentWithCoverage,
  subscribePayments,
} from "@/lib/services/payments";
import { subscribeFamily } from "@/lib/services/families";
import { planCoverage } from "@/lib/services/coverage";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { useT } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/currency";
import { format } from "date-fns";
import type { Family, Payment } from "@/lib/types";

export function RecordPaymentDialog({
  householdId,
  familyId,
  familyName,
}: {
  householdId: string;
  familyId: string;
  familyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  // US4 — opt-in checkbox for future-month cascade. Only relevant when back
  // cascade had nothing to fill. Default off.
  const [applyToFutureMonths, setApplyToFutureMonths] = useState(false);
  const { user } = useAuth();
  const { moh } = useMoneyOnHand();
  const t = useT();
  const cur = moh.currency || t("common.dash");

  const form = useForm<RecordPaymentSchema>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      householdId,
      familyId,
      amount: 0,
      date: new Date(),
      note: null,
    },
  });

  // 003 — subscribe to family + payments so the dialog can show a live
  // over-limit indicator and preview. Both subscriptions are scoped to this
  // family only; they are cheap (one family doc + one small sub-collection).
  useEffect(() => {
    const offFamily = subscribeFamily(householdId, familyId, setFamily);
    const offPayments = subscribePayments(householdId, familyId, setPayments);
    return () => {
      offFamily();
      offPayments();
    };
  }, [householdId, familyId]);

  // 003 — derive the cascade plan live on every amount/date/checkbox change.
  // We read the watched amount + date OUTSIDE the memo so the dependency list
  // captures them; `form.watch` inside a memo's body does not subscribe the
  // memo to changes.
  const amount = form.watch("amount");
  const date = form.watch("date");
  const plan = useMemo(() => {
    if (!family) {
      return {
        coverageGroupId: "",
        currentMonth: null,
        backMonths: [],
        futureMonths: [],
        totalAmount: 0,
        overLimitRemainder: 0,
      };
    }
    return planCoverage({
      amount: Number(amount) || 0,
      date,
      family: {
        contributionTarget: family.contributionTarget,
        createdAt: family.createdAt?.toDate?.() ?? null,
      },
      payments,
      applyToFutureMonths,
    });
  }, [family, payments, applyToFutureMonths, amount, date]);

  const showOverLimit = plan.overLimitRemainder > 0;
  const showPreview =
    !!plan.currentMonth &&
    (plan.backMonths.length > 0 || plan.futureMonths.length > 0);
  const showFutureCheckbox =
    !!plan.currentMonth &&
    plan.backMonths.length === 0 &&
    plan.overLimitRemainder > 0;

  async function onSubmit(values: RecordPaymentSchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      // 003 — use the cascade-aware path so a single submit can write N
      // sibling docs sharing a coverageGroupId (when over-limit). The
      // service internally re-reads the family + payments inside its txn
      // (race-safe) and uses planCoverage() to derive the slot list.
      // The UUID we pass here is the one previewed live on every keystroke.
      await recordPaymentWithCoverage(user.uid, {
        householdId,
        familyId,
        coverageGroupId: plan.coverageGroupId || cryptoRandomUUIDFallback(),
        applyToFutureMonths,
        amount: values.amount,
        date: values.date,
        note: values.note,
      });
      form.reset({
        householdId,
        familyId,
        amount: 0,
        date: new Date(),
        note: null,
      });
      setApplyToFutureMonths(false);
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
        <Button size="sm">{t("payments.recordButton")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("payments.recordTitle", { name: familyName })}
          </DialogTitle>
          <DialogDescription>
            {t("payments.recordDescription", { name: familyName })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-amount">{t("common.amount")}</Label>
            <Input
              id="rp-amount"
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

          {/* 003 — US1: live over-limit indicator. Hidden when under limit. */}
          {showOverLimit ? (
            <p
              className="text-xs text-amber-600 dark:text-amber-500"
              data-testid="rp-over-limit"
            >
              {/* TODO: localise this later */}
              {`Over limit by ${formatCurrency(plan.overLimitRemainder, cur)}`}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="rp-date">{t("common.date")}</Label>
            <Input
              id="rp-date"
              type="date"
              value={format(form.watch("date"), "yyyy-MM-dd")}
              onChange={(e) => {
                const v = e.target.value;
                if (v) form.setValue("date", new Date(v));
              }}
            />
          </div>

          {/* 003 — US4: opt-in future-month cascade checkbox. Only visible when
              the back cascade has nothing to fill (so we know back is paid)
              AND the entered amount is over the target. */}
          {showFutureCheckbox ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="rp-future-toggle"
                checked={applyToFutureMonths}
                onChange={(e) => setApplyToFutureMonths(e.target.checked)}
              />
              {/* TODO: localise this later */}
              <span>Apply excess to future months</span>
            </label>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="rp-note">{t("common.noteOptional")}</Label>
            <Textarea
              id="rp-note"
              {...form.register("note")}
              maxLength={280}
              placeholder={t("payments.notePlaceholder")}
            />
          </div>

          {/* 003 — US3: coverage preview block. Lists every slot the cascade
              will write, in commit order (current first, back oldest-first,
              future oldest-first), plus total + remainder. */}
          {showPreview ? (
            <div
              className="rounded-md border bg-muted/40 p-3 text-xs space-y-1"
              data-testid="rp-preview"
            >
              <p className="font-medium">
                {/* TODO: localise this later */}
                {`Coverage preview`}
              </p>
              <ul className="space-y-0.5">
                {plan.currentMonth ? (
                  <li className="flex justify-between gap-3">
                    {/* TODO: localise this later */}
                    <span>{`${plan.currentMonth.month} (current)`}</span>
                    <span className="tabular-nums">
                      {formatCurrency(plan.currentMonth.amount, cur)}
                    </span>
                  </li>
                ) : null}
                {plan.backMonths.map((s) => (
                  <li
                    key={`b-${s.month}`}
                    className="flex justify-between gap-3"
                  >
                    <span>{s.month}</span>
                    <span className="tabular-nums">
                      {formatCurrency(s.amount, cur)}
                    </span>
                  </li>
                ))}
                {plan.futureMonths.map((s) => (
                  <li
                    key={`f-${s.month}`}
                    className="flex justify-between gap-3"
                  >
                    {/* TODO: localise this later */}
                    <span>{`${s.month} (future)`}</span>
                    <span className="tabular-nums">
                      {formatCurrency(s.amount, cur)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between gap-3 border-t pt-1 mt-1">
                {/* TODO: localise this later */}
                <span>Total</span>
                <span className="tabular-nums font-medium">
                  {formatCurrency(plan.totalAmount, cur)}
                </span>
              </div>
              {plan.overLimitRemainder > 0 && plan.currentMonth ? (
                <p
                  className="text-amber-600 dark:text-amber-500"
                  data-testid="rp-remainder"
                >
                  {/* TODO: localise this later */}
                  {`Remaining over-limit on ${plan.currentMonth.month}: ${formatCurrency(plan.overLimitRemainder, cur)}`}
                </p>
              ) : null}
            </div>
          ) : null}

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
              {busy ? t("common.saving") : t("payments.savePayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Fallback UUID generator used only if `plan.coverageGroupId` is empty
 * (e.g. before the family subscription has fired). Matches the same UUID
 * v4 format the Firestore rule validates. */
function cryptoRandomUUIDFallback(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}
