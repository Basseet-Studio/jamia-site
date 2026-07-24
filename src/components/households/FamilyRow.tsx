"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Family, FamilyMonthlySummary, Payment } from "@/lib/types";
import { formatCurrency } from "@/lib/utils/currency";
import { useMoneyOnHand } from "@/lib/hooks/useMoneyOnHand";
import { subscribePayments } from "@/lib/services/payments";
import { deriveFamilySummary } from "@/lib/services/derived";
import { Button } from "@/components/ui/button";
import { EditFamilyDialog } from "@/components/households/EditFamilyDialog";
import { FamilyMembersDialog } from "@/components/households/FamilyMembersDialog";
import { SoftDeleteFamilyDialog } from "@/components/households/SoftDeleteFamilyDialog";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { StatusBadge } from "@/components/payments/StatusBadge";
import { useT } from "@/lib/i18n";

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
  const t = useT();
  const cur = moh.currency || t("common.dash");
  const [payments, setPayments] = useState<Payment[]>([]);
  useEffect(
    () => subscribePayments(householdId, family.id, setPayments),
    [householdId, family.id],
  );
  const summary = useMemo(
    () => deriveFamilySummary(family, payments, new Date()),
    [family, payments],
  );
  const shortfall = Math.max(0, summary.totalExpected - summary.totalPaid);
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
          <span className="ml-2 text-xs text-muted-foreground">
            {t("families.removed")}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">
        {formatCurrency(family.contributionTarget, cur)}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">
        {status ? formatCurrency(status.totalPaid, cur) : t("common.dash")}
        <div className="mt-1 text-xs text-muted-foreground">
          {/* TODO: localise this later */}
          {`Total ${formatCurrency(summary.totalPaid, cur)} / expected ${formatCurrency(summary.totalExpected, cur)}`}
        </div>
        <div className="text-xs text-muted-foreground">
          {/* TODO: localise this later */}
          {shortfall === 0
            ? "Current or ahead"
            : `Behind by ${formatCurrency(shortfall, cur)}`}
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        {status ? (
          <StatusBadge status={status.status} />
        ) : (
          <span className="text-muted-foreground">{t("common.dash")}</span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-sm tabular-nums">
        {family.memberCount > 0
          ? t("householdMembers.count", { count: family.memberCount })
          : t("families.membersNone")}
      </td>
      <td className="px-3 py-2 text-right">
        {family.active ? (
          <div className="flex flex-nowrap justify-end gap-2">
            <RecordPaymentDialog
              householdId={householdId}
              familyId={family.id}
              familyName={family.name}
            />
            <FamilyMembersDialog householdId={householdId} family={family} />
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
