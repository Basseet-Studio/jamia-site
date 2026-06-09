"use client";
/**
 * MonthNavigator — back/forward arrows for the current viewing month.
 * Defaults to current month; can disable forward step past current month.
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fromMonthKey, stepMonthKey, toMonthKey } from "@/lib/utils/dates";
import { useT } from "@/lib/i18n";

export interface MonthNavigatorProps {
  month: string;
  onChange: (next: string) => void;
  /** When true, the "forward" button is disabled once month == current month. */
  capAtCurrent?: boolean;
  /** Override the "current month" reference (defaults to actual current). */
  currentMonth?: string;
  disabled?: boolean;
}

export function MonthNavigator({
  month,
  onChange,
  capAtCurrent = true,
  currentMonth,
  disabled = false,
}: MonthNavigatorProps) {
  const t = useT();
  const cur = useMemo(
    () => currentMonth ?? toMonthKey(new Date()),
    [currentMonth],
  );
  const canForward = !capAtCurrent || stepMonthKey(month, 1) <= cur;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(stepMonthKey(month, -1))}
        disabled={disabled}
        aria-label={t("months.prev")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-32 text-center text-sm font-medium tabular-nums">
        {formatMonthLabel(month)}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(stepMonthKey(month, 1))}
        disabled={disabled || !canForward}
        aria-label={t("months.next")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function formatMonthLabel(month: string): string {
  // TODO(i18n): locale-aware formatting. v1 uses en-US (e.g. "May 2026").
  const d = fromMonthKey(month);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}
