"use client";
import Link from "next/link";
import type { Household, HouseholdMonthlySummary } from "@/lib/types";
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

export interface HouseholdRowData {
  household: Household;
  summary: HouseholdMonthlySummary | null;
}

export function HouseholdTable({
  rows,
  loading,
}: {
  rows: HouseholdRowData[];
  loading: boolean;
}) {
  const { moh } = useMoneyOnHand();
  const cur = moh.currency || "—";

  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {/* TODO(i18n): empty state */}
        No households yet. Use “Add household” to create one.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Families</TableHead>
          <TableHead className="text-right">Paid full</TableHead>
          <TableHead className="text-right">Partial</TableHead>
          <TableHead className="text-right">Unpaid</TableHead>
          <TableHead className="text-right">Collected</TableHead>
          <TableHead className="text-right">Target</TableHead>
          <TableHead className="text-right">Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ household, summary }) => (
          <TableRow key={household.id} className="cursor-pointer">
            <TableCell>
              <Link
                href={`/households/${household.id}`}
                className="font-medium hover:underline"
              >
                {household.name}
              </Link>
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.totalFamilies ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.familiesPaidFull ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.familiesPartial ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.familiesUnpaid ?? "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary ? formatCurrency(summary.totalCollected, cur) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary ? formatCurrency(summary.totalTarget, cur) : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.collectionRate != null
                ? `${Math.round(summary.collectionRate * 100)}%`
                : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
