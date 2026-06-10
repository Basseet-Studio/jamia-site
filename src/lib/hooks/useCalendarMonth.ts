"use client";
/**
 * useCalendarMonth — state for a "currently viewed month" in the Calendar view.
 * Wraps useState + the month-key helpers from `@/lib/utils/dates`.
 */
import { useState } from "react";
import { currentMonthKey, stepMonthKey } from "@/lib/utils/dates";

export interface UseCalendarMonthResult {
  month: string;
  setMonth: (next: string) => void;
  step: (n: number) => void;
}

export function useCalendarMonth(
  initialMonth?: string,
): UseCalendarMonthResult {
  const [month, setMonth] = useState<string>(initialMonth ?? currentMonthKey());
  const step = (n: number) => setMonth((m) => stepMonthKey(m, n));
  return { month, setMonth, step };
}
