"use client";
import { useMemo } from "react";
import type { Payment, Family } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeletePaymentDialog } from "@/components/payments/DeletePaymentDialog";
import { useT } from "@/lib/i18n";
import { format } from "date-fns";

export function PaymentHistoryTable({
  payments,
  householdId,
  family,
  showFamily = false,
}: {
  payments: Payment[];
  householdId: string;
  family: Family | null;
  showFamily?: boolean;
}) {
  const { moh } = useMoneyOnHand();
  const t = useT();
  const cur = moh.currency || t("common.dash");
  const dash = t("common.dash");

  const sorted = useMemo(
    () =>
      [...payments].sort(
        (a, b) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0),
      ),
    [payments],
  );

  if (sorted.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("payments.noPayments")}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("payments.tableDate")}</TableHead>
          {showFamily ? (
            <TableHead>{t("payments.tableFamily")}</TableHead>
          ) : null}
          <TableHead className="text-right">
            {t("payments.tableAmount")}
          </TableHead>
          <TableHead>{t("payments.tableNote")}</TableHead>
          <TableHead>{t("payments.tableRecordedBy")}</TableHead>
          <TableHead>{t("payments.tableRecordedAt")}</TableHead>
          <TableHead className="text-right">
            {t("payments.tableAction")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((p) => {
          const date = p.date?.toDate ? p.date.toDate() : new Date();
          const recordedAt = p.recordedAt?.toDate
            ? p.recordedAt.toDate()
            : new Date();
          return (
            <TableRow key={p.id}>
              <TableCell className="text-sm tabular-nums">
                {format(date, "yyyy-MM-dd")}
              </TableCell>
              {showFamily ? (
                <TableCell>{family?.name ?? p.familyId}</TableCell>
              ) : null}
              <TableCell className="text-right tabular-nums">
                {formatCurrency(p.amount, cur)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.note || dash}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {p.recordedBy}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground tabular-nums">
                {format(recordedAt, "yyyy-MM-dd HH:mm")}
              </TableCell>
              <TableCell className="text-right">
                <DeletePaymentDialog
                  householdId={householdId}
                  familyId={p.familyId}
                  paymentId={p.id}
                  paymentAmount={p.amount}
                  familyName={family?.name ?? ""}
                  coverageGroupId={p.coverageGroupId}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
