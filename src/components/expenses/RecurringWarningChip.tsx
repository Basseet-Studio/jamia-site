"use client";
/**
 * RecurringWarningChip — shown next to the MonthNavigator on the Expenses
 * page when the selected month is in the future and the recurring expenses
 * scheduled for that month exceed the expected family contributions for
 * the month.
 *
 * Pure presentational component: the parent computes `recurringTotal` and
 * `expectedPayments` and decides whether to render the chip at all.
 */
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/currency";

export interface RecurringWarningChipProps {
  /** Total of active recurring expenses scheduled for the month. */
  recurringTotal: number;
  /** settings.defaultContributionTarget × active families count. */
  expectedPayments: number;
  /** Currency code (e.g. "INR"). */
  currency: string;
}

export function RecurringWarningChip({
  recurringTotal,
  expectedPayments,
  currency,
}: RecurringWarningChipProps) {
  const t = useT();

  if (recurringTotal <= expectedPayments) return null;

  return (
    <Badge
      variant="destructive"
      className="gap-1.5 px-2.5 py-1 text-xs font-medium"
      data-testid="recurring-warning-chip"
    >
      <AlertTriangle className="size-3.5" aria-hidden="true" />
      <span>
        {t("expenses.recurring.warningOverBudget", {
          total: formatCurrency(recurringTotal, currency),
          expected: formatCurrency(expectedPayments, currency),
        })}
      </span>
    </Badge>
  );
}