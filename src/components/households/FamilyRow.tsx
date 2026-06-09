"use client";
import Link from "next/link";
import type { Family, FamilyMonthlySummary } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { Button } from "@/components/ui/button";
import { EditFamilyDialog } from "@/components/households/EditFamilyDialog";
import { SoftDeleteFamilyDialog } from "@/components/households/SoftDeleteFamilyDialog";
import { StatusBadge } from "@/components/payments/StatusBadge";

export function FamilyRow({
  householdId,
  family,
  status,
}: {
  householdId: string;
  family: Family;
  status: FamilyMonthlySummary | null;
}) {
  const { moh } = useMoneyOnHand();
  const cur = moh.currency || "—";
  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2 text-sm">
        <Link
          href={`/households/${householdId}/families/${family.id}/history`}
          className="font-medium hover:underline"
        >
          {family.name}
        </Link>
        {!family.active ? (
          <span className="ml-2 text-xs text-muted-foreground">(removed)</span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">
        {formatCurrency(family.contributionTarget, cur)}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">
        {status ? formatCurrency(status.totalPaid, cur) : "—"}
      </td>
      <td className="px-3 py-2 text-center">
        {status ? <StatusBadge status={status.status} /> : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        {family.active ? (
          <div className="flex justify-end gap-2">
            <EditFamilyDialog householdId={householdId} family={family} />
            <SoftDeleteFamilyDialog
              householdId={householdId}
              familyId={family.id}
              familyName={family.name}
            />
          </div>
        ) : null}
      </td>
    </tr>
  );
}
