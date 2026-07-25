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
import { subscribeHousehold } from "@/lib/services/households";
import {
  planCoverage,
  resolveCoverageAllocation,
} from "@/lib/services/coverage";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { useT } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/currency";
import { format } from "date-fns";
import type { Family, Household, Payment } from "@/lib/types";
import { AttachmentUploadField } from "@/components/receipts/AttachmentUploadField";
import { ReceiptPrintButtons } from "@/components/receipts/ReceiptPrintButtons";
import { buildPaymentReceiptContext } from "@/lib/services/receiptPdfContext";
import type { Timestamp } from "firebase/firestore";

type SavedPaymentResult = {
  ids: string[];
  coverageGroupId: string | null;
  slots: { id: string; month: string; amount: number; primary: boolean }[];
  date: Date;
  note: string | null;
};

export function RecordPaymentDialog({
  householdId,
  familyId,
  familyName,
  hideTrigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  householdId: string;
  familyId: string;
  familyName: string;
  /**
   * When true, the built-in "Record payment" button is omitted and the dialog
   * is controlled by the parent via `open` + `onOpenChange`. The dashboard's
   * "Log payment" card uses this so a single external button drives the
   * dialog after the family is picked.
   */
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = hideTrigger === true;
  const open = isControlled ? (openProp ?? false) : internalOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChangeProp?.(next);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<Record<string, boolean>>(
    {},
  );
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saved, setSaved] = useState<SavedPaymentResult | null>(null);
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

  useEffect(() => {
    const offFamily = subscribeFamily(householdId, familyId, setFamily);
    const offPayments = subscribePayments(householdId, familyId, setPayments);
    const offHousehold = subscribeHousehold(householdId, setHousehold);
    return () => {
      offFamily();
      offPayments();
      offHousehold();
    };
  }, [householdId, familyId]);

  // Reset success panel when dialog closes.
  useEffect(() => {
    if (!open) setSaved(null);
  }, [open]);

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
        alreadyPaidCurrent: 0,
        remainingCapacityCurrent: 0,
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
      applyToFutureMonths: true,
    });
  }, [family, payments, amount, date]);

  const selectableSlots = useMemo(
    () => [...plan.backMonths, ...plan.futureMonths],
    [plan.backMonths, plan.futureMonths],
  );

  const selectedCoverageMonths = useMemo(
    () =>
      selectableSlots
        .filter((slot) => selectedMonths[slot.month])
        .map((slot) => slot.month),
    [selectableSlots, selectedMonths],
  );

  const allocation = useMemo(() => {
    if (!family) {
      return {
        writes: [],
        totalAmount: 0,
        overLimitRemainder: 0,
        autoMonths: [],
      };
    }
    return resolveCoverageAllocation({
      amount: Number(amount) || 0,
      date,
      family: {
        contributionTarget: family.contributionTarget,
        createdAt: family.createdAt?.toDate?.() ?? null,
      },
      payments,
      selectedCoverageMonths,
    });
  }, [family, payments, amount, date, selectedCoverageMonths]);

  const target = family?.contributionTarget ?? 0;
  const entered = Number(amount) || 0;
  const currentSlotAmount = plan.currentMonth?.amount ?? 0;
  const overLimit = Math.max(0, entered - (plan.remainingCapacityCurrent || 0));
  // Show spillover UI when money exceeds what current month can still take.
  const showOverLimit = entered > 0 && overLimit > 0 && target > 0;
  const showPreview =
    !!plan.currentMonth && (showOverLimit || allocation.autoMonths.length > 0);
  const previewTotal = allocation.totalAmount;

  useEffect(() => {
    setSelectedMonths((previous) => {
      const next: Record<string, boolean> = {};
      for (const slot of selectableSlots) {
        next[slot.month] = previous[slot.month] ?? slot.defaultSelected;
      }
      return next;
    });
  }, [selectableSlots]);

  function closeAndReset() {
    form.reset({
      householdId,
      familyId,
      amount: 0,
      date: new Date(),
      note: null,
    });
    setSelectedMonths({});
    setAttachmentFile(null);
    setSaved(null);
    setError(null);
    setOpen(false);
  }

  async function onSubmit(values: RecordPaymentSchema) {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const needsGroup =
        selectedCoverageMonths.length > 0 ||
        allocation.autoMonths.length > 0 ||
        allocation.writes.length > 1;
      const result = await recordPaymentWithCoverage(
        user.uid,
        {
          householdId,
          familyId,
          ...(needsGroup
            ? {
                coverageGroupId:
                  plan.coverageGroupId || cryptoRandomUUIDFallback(),
              }
            : {}),
          selectedCoverageMonths,
          amount: values.amount,
          date: values.date,
          note: values.note,
        },
        attachmentFile,
      );
      setAttachmentFile(null);
      setSaved(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const receiptCtx = useMemo(() => {
    if (!saved || !family) return null;
    const primary =
      saved.slots.find((s) => s.primary) ?? saved.slots[0] ?? null;
    if (!primary) return null;
    const asTimestamp = (d: Date): Timestamp =>
      ({ toDate: () => d }) as Timestamp;
    const relatedPayments: Payment[] = saved.slots.map((slot) => ({
      id: slot.id,
      householdId,
      familyId,
      amount: slot.amount,
      date: asTimestamp(saved.date),
      month: slot.month,
      note: saved.note,
      recordedAt: asTimestamp(saved.date),
      recordedBy: user?.uid ?? "",
      coverageGroupId: saved.coverageGroupId,
    }));
    const payment = relatedPayments.find((p) => p.id === primary.id)!;
    return buildPaymentReceiptContext(payment, {
      householdName: household?.name ?? householdId,
      householdId,
      family,
      currency: cur,
      relatedPayments:
        relatedPayments.length > 1 ? relatedPayments : undefined,
    });
  }, [saved, family, household, householdId, familyId, user?.uid, cur]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAndReset();
        else setOpen(true);
      }}
    >
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button size="sm">{t("payments.recordButton")}</Button>
        </DialogTrigger>
      )}
      <DialogContent scrollable className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {saved
              ? /* TODO: localise this later */ "Payment recorded"
              : t("payments.recordTitle", { name: familyName })}
          </DialogTitle>
          <DialogDescription>
            {saved
              ? /* TODO: localise this later */ "Print a receipt or close when done."
              : t("payments.recordDescription", { name: familyName })}
          </DialogDescription>
        </DialogHeader>

        {saved && receiptCtx ? (
          <div className="space-y-4" data-testid="rp-success">
            <ul className="space-y-1 text-sm">
              {saved.slots.map((slot) => (
                <li key={slot.id} className="flex justify-between gap-3">
                  <span>{slot.month}</span>
                  <span className="tabular-nums">
                    {formatCurrency(slot.amount, cur)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t pt-2 text-sm font-medium">
              {/* TODO: localise this later */}
              <span>Total</span>
              <span className="tabular-nums">
                {formatCurrency(
                  saved.slots.reduce((s, x) => s + x.amount, 0),
                  cur,
                )}
              </span>
            </div>
            <ReceiptPrintButtons ctx={receiptCtx} />
            <DialogFooter>
              <Button type="button" onClick={closeAndReset} data-testid="rp-done">
                {/* TODO: localise this later */}
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-col gap-4 overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {target > 0 ? (
                <p
                  className="rounded-md border bg-muted/40 px-3 py-2 text-xs"
                  data-testid="rp-already-paid"
                >
                  {/* TODO: localise this later */}
                  {`Already paid this month: ${formatCurrency(plan.alreadyPaidCurrent, cur)} / ${formatCurrency(target, cur)} (remaining ${formatCurrency(plan.remainingCapacityCurrent, cur)})`}
                </p>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  {/* TODO: localise this later */}
                  {`This family has no monthly target. Record non-target money on the Contributions tab.`}
                </p>
              )}

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

              {showOverLimit ? (
                <p
                  className="text-xs text-amber-600 dark:text-amber-500"
                  data-testid="rp-over-limit"
                >
                  {/* TODO: localise this later */}
                  {`Beyond this month's remaining ${formatCurrency(plan.remainingCapacityCurrent, cur)} by ${formatCurrency(overLimit, cur)}`}
                </p>
              ) : null}

              {currentSlotAmount > 0 &&
              plan.alreadyPaidCurrent > 0 &&
              entered > 0 ? (
                <p className="text-xs text-muted-foreground" data-testid="rp-top-up">
                  {/* TODO: localise this later */}
                  {`This payment will top up ${formatCurrency(currentSlotAmount, cur)} toward this month.`}
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

              <div className="space-y-2">
                <Label htmlFor="rp-note">{t("common.noteOptional")}</Label>
                <Textarea
                  id="rp-note"
                  {...form.register("note")}
                  maxLength={280}
                  placeholder={t("payments.notePlaceholder")}
                />
              </div>

              <AttachmentUploadField
                id="rp-attachment"
                file={attachmentFile}
                onFileChange={setAttachmentFile}
              />

              {showPreview ? (
                <div
                  className="rounded-md border bg-muted/40 p-3 text-xs space-y-1"
                  data-testid="rp-preview"
                >
                  <p className="font-medium">
                    {/* TODO: localise this later */}
                    {`Coverage preview`}
                  </p>
                  <ul className="max-h-60 space-y-0.5 overflow-y-auto">
                    {plan.currentMonth && plan.currentMonth.amount > 0 ? (
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
                        className="flex items-center justify-between gap-3"
                      >
                        <label className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            data-testid={`rp-slot-${s.month}`}
                            checked={!!selectedMonths[s.month]}
                            onChange={(e) =>
                              setSelectedMonths((current) => ({
                                ...current,
                                [s.month]: e.target.checked,
                              }))
                            }
                          />
                          <span>{s.month}</span>
                        </label>
                        <span className="tabular-nums">
                          {formatCurrency(s.amount, cur)}
                        </span>
                      </li>
                    ))}
                    {plan.futureMonths.map((s) => (
                      <li
                        key={`f-${s.month}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <label className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            data-testid={`rp-slot-${s.month}`}
                            checked={!!selectedMonths[s.month]}
                            onChange={(e) =>
                              setSelectedMonths((current) => ({
                                ...current,
                                [s.month]: e.target.checked,
                              }))
                            }
                          />
                          {/* TODO: localise this later */}
                          <span>{`${s.month} (future)`}</span>
                        </label>
                        <span className="tabular-nums">
                          {formatCurrency(s.amount, cur)}
                        </span>
                      </li>
                    ))}
                    {allocation.autoMonths.map((s) => (
                      <li
                        key={`a-${s.month}`}
                        className="flex justify-between gap-3 text-muted-foreground"
                        data-testid={`rp-auto-${s.month}`}
                      >
                        {/* TODO: localise this later */}
                        <span>{`${s.month} (auto)`}</span>
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
                      {formatCurrency(previewTotal, cur)}
                    </span>
                  </div>
                  {allocation.overLimitRemainder === 0 && entered > 0 ? (
                    <p
                      className="text-muted-foreground"
                      data-testid="rp-fully-allocated"
                    >
                      {/* TODO: localise this later */}
                      Fully allocated toward monthly targets
                    </p>
                  ) : null}
                </div>
              ) : null}

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter className="shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={closeAndReset}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? t("common.saving") : t("payments.savePayment")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Fallback UUID generator used only if `plan.coverageGroupId` is empty. */
function cryptoRandomUUIDFallback(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}
