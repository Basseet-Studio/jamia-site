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
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const cur = moh.currency || t("common.dash");
  const dash = t("common.dash");

  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("householdTable.empty")}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("householdTable.tableName")}</TableHead>
          <TableHead className="text-right">
            {t("householdTable.tableFamilies")}
          </TableHead>
          <TableHead className="text-right">
            {t("householdTable.tablePaidFull")}
          </TableHead>
          <TableHead className="text-right">
            {t("householdTable.tablePartial")}
          </TableHead>
          <TableHead className="text-right">
            {t("householdTable.tableUnpaid")}
          </TableHead>
          <TableHead className="text-right">
            {t("householdTable.tableCollected")}
          </TableHead>
          <TableHead className="text-right">
            {t("householdTable.tableTarget")}
          </TableHead>
          <TableHead className="text-right">
            {t("householdTable.tableRate")}
          </TableHead>
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
              {summary?.totalFamilies ?? dash}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.familiesPaidFull ?? dash}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.familiesPartial ?? dash}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.familiesUnpaid ?? dash}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary ? formatCurrency(summary.totalCollected, cur) : dash}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary ? formatCurrency(summary.totalTarget, cur) : dash}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {summary?.collectionRate != null
                ? `${Math.round(summary.collectionRate * 100)}%`
                : dash}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
