/**
 * Shortfall service — pure function unit tests (FR-032, SC-006).
 *
 * Required cases:
 *   1. Zero active templates → severity "ok", shortfall 0.
 *   2. Exact match (available == recurringTotal) → severity "ok".
 *   3. 5% gap → severity "watch".
 *   4. 10% gap (boundary inclusive) → severity "watch".
 *   5. 50% gap → severity "risk".
 *   6. Negative available → service does not throw; shortfall may exceed
 *      recurringTotal.
 */
import { describe, expect, it } from "vitest";
import { computeShortfall } from "@/lib/services/shortfall";
import * as svc from "@/lib/services/shortfall";
import * as sub from "@/lib/services/shortfallSubscription";
import { Timestamp } from "firebase/firestore";

const baseInput = {
  month: "2026-06",
  moneyOnHandAtStartOfMonth: 1000,
  paymentsThisMonth: 0,
  withdrawnExpensesThisMonth: 0,
  // `computeShortfall` expects a real `Timestamp` (it pass-throughs it onto
  // the result). At runtime the shortfall subscription either reads a stored
  // `updatedAt` Timestamp or falls back to `serverTimestamp()` cast as one.
  // For pure-function tests we use a fixed `Timestamp.now()` so the assertion
  // is deterministic.
  asOf: Timestamp.now(),
} as const;

describe("computeShortfall — FR-032 cases", () => {
  it("case 1: zero active templates → severity 'ok', shortfall 0", () => {
    const r = computeShortfall({ ...baseInput, recurringTotal: 0 });
    expect(r.severity).toBe("ok");
    expect(r.shortfall).toBe(0);
    expect(r.recurringTotal).toBe(0);
  });

  it("case 2: exact match → severity 'ok', shortfall 0", () => {
    // available = 1000, recurringTotal = 1000, gap = 0
    const r = computeShortfall({ ...baseInput, recurringTotal: 1000 });
    expect(r.severity).toBe("ok");
    expect(r.shortfall).toBe(0);
  });

  it("case 3: 5% gap → severity 'watch'", () => {
    // available = 1000, recurringTotal = 1050, gap = 50 (~4.76%)
    const r = computeShortfall({ ...baseInput, recurringTotal: 1050 });
    expect(r.severity).toBe("watch");
    expect(r.shortfall).toBe(50);
  });

  it("case 4: 10% gap (boundary inclusive) → severity 'watch'", () => {
    // available = 1000, recurringTotal = 1100, gap = 100 (10% exactly)
    const r = computeShortfall({ ...baseInput, recurringTotal: 1100 });
    expect(r.severity).toBe("watch");
    expect(r.shortfall).toBe(100);
  });

  it("case 5: 50% gap → severity 'risk'", () => {
    // available = 1000, recurringTotal = 1500, gap = 500 (50%)
    const r = computeShortfall({ ...baseInput, recurringTotal: 1500 });
    expect(r.severity).toBe("risk");
    expect(r.shortfall).toBe(500);
  });

  it("case 6: negative available → no throw; shortfall exceeds recurringTotal", () => {
    // available = -200, recurringTotal = 500, raw = 700 (clamped to >=0 already)
    const r = computeShortfall({
      ...baseInput,
      moneyOnHandAtStartOfMonth: -200,
      recurringTotal: 500,
    });
    expect(r.severity).toBe("risk");
    expect(r.shortfall).toBe(700);
    expect(r.available).toBe(-200);
  });

  it("case FR-030: recurringTotal=0 keeps the banner hidden (severity 'ok', shortfall 0)", () => {
    const r = computeShortfall({ ...baseInput, recurringTotal: 0 });
    expect(r.severity).toBe("ok");
    expect(r.shortfall).toBe(0);
  });

  it("uses payments/withdrawals to derive available", () => {
    // available = 1000 + 200 - 100 = 1100, recurringTotal = 1200 → gap 100 → watch
    const r = computeShortfall({
      ...baseInput,
      paymentsThisMonth: 200,
      withdrawnExpensesThisMonth: 100,
      recurringTotal: 1200,
    });
    expect(r.available).toBe(1100);
    expect(r.shortfall).toBe(100);
    expect(r.severity).toBe("watch");
  });
});

describe("shortfall — module exports (T038 smoke test)", () => {
  it("exposes computeShortfall + subscribeMonthlyShortfall", () => {
    expect(typeof svc.computeShortfall).toBe("function");
    expect(typeof sub.subscribeMonthlyShortfall).toBe("function");
  });

  it("does NOT expose updateShortfall or deleteShortfall (derived, never stored)", () => {
    expect(
      (svc as Record<string, unknown>).updateShortfall,
    ).toBeUndefined();
    expect(
      (svc as Record<string, unknown>).deleteShortfall,
    ).toBeUndefined();
    expect(
      (sub as Record<string, unknown>).updateShortfall,
    ).toBeUndefined();
  });
});
