/**
 * Calendar view — module export smoke test.
 *
 * The full happy-path lives in the e2e suite (calendar.spec.ts). The
 * per-template status derivation (NotAdded / PendingWithdrawal / Withdrawn)
 * is exercised end-to-end with the Firestore emulator.
 */
import { describe, expect, it } from "vitest";
import * as svc from "@/lib/services/calendarView";

describe("calendarView — module exports", () => {
  it("exposes subscribeCalendarView + getMonthlyTotals", () => {
    expect(typeof svc.subscribeCalendarView).toBe("function");
    expect(typeof svc.getMonthlyTotals).toBe("function");
  });
});
