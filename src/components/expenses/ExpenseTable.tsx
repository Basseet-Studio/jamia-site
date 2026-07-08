"use client";
import { useState } from "react";
import type { Expense } from "@/lib/types";
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
import { Badge } from "@/components/ui/badge";
import { WithdrawDialog } from "@/components/expenses/WithdrawDialog";
import { AttachSignedReceiptDialog } from "@/components/expenses/AttachSignedReceiptDialog";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "@/lib/services/expenses";
import { useAuth } from "@/lib/hooks/useAuth";
import { useT } from "@/lib/i18n";
import { ReceiptDownloadButton } from "@/components/receipts/ReceiptDownloadButton";
import { buildExpenseReceiptContext } from "@/lib/services/receiptPdfContext";
import { AttachmentLink } from "@/components/receipts/AttachmentLink";

export function ExpenseTable({ expenses }: { expenses: Expense[] }) {
  const { moh } = useMoneyOnHand();
  const t = useT();
  const cur = moh.currency || t("common.dash");
  const dash = t("common.dash");
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("expenses.empty")}
      </div>
    );
  }

  async function onDelete(id: string) {
    if (!user) return;
    if (!confirm(t("expenses.confirmDelete"))) return;
    setBusyId(id);
    try {
      await deleteExpense(user.uid, id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("expenses.tableDate")}</TableHead>
          <TableHead>{t("expenses.tableName")}</TableHead>
          <TableHead className="text-right">
            {t("expenses.tableAmount")}
          </TableHead>
          <TableHead>{t("expenses.tableType")}</TableHead>
          <TableHead>{t("expenses.tableStatus")}</TableHead>
          <TableHead>{t("expenses.tableNote")}</TableHead>
          <TableHead className="text-right">
            {t("expenses.tableActions")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((e) => {
          const date = e.date?.toDate ? e.date.toDate() : new Date();
          // TODO: localise this later — type label
          const typeLabel =
            e.type === "mosque"
              ? `${t("expenseType.mosque")}${
                  e.mosqueSubCategory
                    ? ` · ${t(`mosqueSubCategory.${e.mosqueSubCategory}`)}`
                    : ""
                }`
              : t("expenseType.household");
          return (
            <TableRow
              key={e.id}
              className={
                e.withdrawn ? "text-muted-foreground line-through" : undefined
              }
            >
              <TableCell className="text-sm tabular-nums">
                {format(date, "yyyy-MM-dd")}
              </TableCell>
              <TableCell>{e.name}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(e.amount, cur)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{typeLabel}</Badge>
              </TableCell>
              <TableCell>
                {e.withdrawn ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">
                    {t("expenses.statusWithdrawn")}
                  </span>
                ) : (
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    {t("expenses.statusPending")}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {e.note || dash}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {e.withdrawn ? (
                    <ReceiptDownloadButton
                      ctx={buildExpenseReceiptContext(e, { currency: cur })}
                      label="PDF"
                    />
                  ) : null}
                  <AttachmentLink
                    path={e.attachmentPath}
                    fileName={e.attachmentFileName}
                  />
                  {e.withdrawn && !e.attachmentPath ? (
                    <AttachSignedReceiptDialog
                      expenseId={e.id}
                      expenseName={e.name}
                    />
                  ) : null}
                  {!e.withdrawn ? (
                    <WithdrawDialog
                      expenseId={e.id}
                      expenseName={e.name}
                      amount={e.amount}
                      month={e.month}
                      isRecurring={e.isRecurring}
                    />
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busyId === e.id}
                    onClick={() => onDelete(e.id)}
                  >
                    {busyId === e.id
                      ? t("common.deleting")
                      : t("common.delete")}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
