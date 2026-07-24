"use client";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { useContributions } from "@/lib/hooks/useContributions";
import {
  contributionSchema,
  type ContributionSchema,
} from "@/lib/schemas/contribution";
import {
  addContribution,
  deleteContribution,
} from "@/lib/services/contributions";
import { formatCurrency } from "@/lib/utils/currency";
import { FullReportButton } from "@/components/excel/FullReportButton";
import { AttachmentUploadField } from "@/components/receipts/AttachmentUploadField";
import { ReceiptPrintButtons } from "@/components/receipts/ReceiptPrintButtons";
import { buildContributionReceiptContext } from "@/lib/services/receiptPdfContext";
import { AttachmentLink } from "@/components/receipts/AttachmentLink";
import { useT } from "@/lib/i18n";

export default function ContributionsPage() {
  const t = useT();
  const { user } = useAuth();
  const { moh } = useMoneyOnHand();
  const { contributions, loading, error } = useContributions();
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const cur = moh.currency || "AED";
  const total = useMemo(
    () => contributions.reduce((sum, item) => sum + item.amount, 0),
    [contributions],
  );
  const form = useForm<ContributionSchema>({
    resolver: zodResolver(contributionSchema),
    defaultValues: {
      contributorName: "",
      amount: 0,
      date: new Date(),
      note: null,
    },
  });

  async function onSubmit(values: ContributionSchema) {
    if (!user) return;
    setBusy(true);
    try {
      await addContribution(user.uid, values, attachmentFile);
      form.reset({
        contributorName: "",
        amount: 0,
        date: new Date(),
        note: null,
      });
      setAttachmentFile(null);
      setShowForm(false);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm(t("contributions.confirmDelete"))) return;
    await deleteContribution(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("contributions.heading")}</h1>
        <div className="flex items-center gap-2">
          <FullReportButton />
          <Button onClick={() => setShowForm((value) => !value)}>
            {t("contributions.addButton")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("contributions.totalContributed")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {formatCurrency(total, cur)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("contributions.records")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            {contributions.length}
          </CardContent>
        </Card>
      </div>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("contributions.addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contributorName">
                    {t("contributions.contributorName")}
                  </Label>
                  <Input
                    id="contributorName"
                    {...form.register("contributorName")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">{t("contributions.amount")}</Label>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step="0.01"
                    {...form.register("amount", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">{t("contributions.date")}</Label>
                  <Input
                    id="date"
                    type="date"
                    value={format(form.watch("date"), "yyyy-MM-dd")}
                    onChange={(event) => {
                      if (event.target.value) {
                        form.setValue("date", new Date(event.target.value));
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">{t("contributions.note")}</Label>
                  <Textarea
                    id="note"
                    {...form.register("note")}
                    maxLength={280}
                  />
                </div>
              </div>
              <AttachmentUploadField
                id="contribution-attachment"
                file={attachmentFile}
                onFileChange={setAttachmentFile}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? t("contributions.saving") : t("contributions.save")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : contributions.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("contributions.empty")}
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {contributions.map((item) => {
            const date = item.date?.toDate ? item.date.toDate() : new Date();
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 p-3"
              >
                <div>
                  <div className="font-medium">{item.contributorName}</div>
                  <div className="text-sm text-muted-foreground">
                    {format(date, "yyyy-MM-dd")}
                    {item.note ? ` · ${item.note}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ReceiptPrintButtons
                    ctx={buildContributionReceiptContext(item, {
                      currency: cur,
                    })}
                  />
                  <AttachmentLink
                    path={item.attachmentPath}
                    fileName={item.attachmentFileName}
                  />
                  <div className="font-medium tabular-nums">
                    {formatCurrency(item.amount, cur)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    {t("contributions.delete")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
