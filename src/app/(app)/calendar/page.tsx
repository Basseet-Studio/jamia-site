"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { useToast } from "@/components/ui/use-toast";
import { useCalendarMonth } from "@/lib/hooks/useCalendarMonth";
import { subscribeCalendarView } from "@/lib/services/calendarView";
import { CalendarView } from "@/components/calendar/CalendarView";
import type {
  CalendarView as CalendarViewType,
  ShortfallSeverity,
} from "@/lib/types";

export default function CalendarPage() {
  const t = useT();
  const { toast } = useToast();
  const { month, setMonth } = useCalendarMonth();
  const [view, setView] = useState<CalendarViewType | null>(null);
  const lastSeverity = useRef<ShortfallSeverity | null>(null);

  useEffect(() => {
    const off = subscribeCalendarView(month, (v) => setView(v));
    return off;
  }, [month]);

  // 002: fire a one-time toast when the severity worsens to watch or risk.
  useEffect(() => {
    const s = view?.shortfall;
    if (!s) return;
    const prev = lastSeverity.current;
    if (
      prev !== null &&
      prev !== s.severity &&
      (s.severity === "watch" || s.severity === "risk") &&
      // Worsen-only: "ok → watch" and "ok → risk" and "watch → risk".
      (prev === "ok" || (prev === "watch" && s.severity === "risk"))
    ) {
      toast({
        title: t("calendar.toast.shortfallWorsened"),
        description: s.severity,
        variant: s.severity === "risk" ? "destructive" : "default",
      });
    }
    lastSeverity.current = s.severity;
  }, [view, t, toast]);

  return (
    <CalendarView view={view} month={month} onChange={setMonth} />
  );
}
