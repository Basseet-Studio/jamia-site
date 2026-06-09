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
import { WithdrawDialog } from "@/components/expenses/WithdrawDialog";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "@/lib/services/expenses";
import { useAuth } from "@/lib/hooks/useAuth";

export function ExpenseTable({ expenses }: { expenses: Expense[] }) {
  const { moh } = useMoneyOnHand();
  const cur = moh.currency || "—";
  const { user } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No expenses recorded yet.
      </div>
    );
  }

  async function onDelete(id: string) {
    if (!user) return;
    if (!confirm("Delete this expense? This cannot be undone.")) return;
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
          <TableHead>Date</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Note</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((e) => {
          const date = e.date?.toDate ? e.date.toDate() : new Date();
          return (
            <TableRow
              key={e.id}
              className={e.withdrawn ? "text-muted-foreground line-through" : undefined}
            >
              <TableCell className="text-sm tabular-nums">{format(date, "yyyy-MM-dd")}</TableCell>
              <TableCell>{e.name}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(e.amount, cur)}</TableCell>
              <TableCell>
                {e.withdrawn ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">Withdrawn</span>
                ) : (
                  <span className="text-xs text-amber-700 dark:text-amber-300">Pending</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.note || "—"}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {!e.withdrawn ? <WithdrawDialog expenseId={e.id} expenseName={e.name} amount={e.amount} /> : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={busyId === e.id}
                    onClick={() => onDelete(e.id)}
                  >
                    {busyId === e.id ? "Deleting…" : "Delete"}
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
