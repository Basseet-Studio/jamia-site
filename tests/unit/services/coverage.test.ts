/**
 * 003 — Pure-function tests for `planCoverage()`.
 *
 * The algorithm lives in src/lib/services/coverage.ts. It is the single source
 * of truth for cascade math, used by both the dialog preview and the submit
 * txn. These tests exercise the algorithm in isolation — no Firestore, no
 * React — and must be exhaustive enough that every FR-005..FR-013 is covered.
 */
import { describe, expect, it } from "vitest";
import { planCoverage } from "@/lib/services/coverage";
import type { Payment } from "@/lib/types";

let uuidCounter = 0;
function deterministicUuid(): () => string {
  return () => {
    uuidCounter += 1;
    return `00000000-0000-4000-8000-${uuidCounter
      .toString(16)
      .padStart(12, "0")}`;
  };
}

/** Tiny helper: build a Payment with sensible defaults so test bodies stay focused. */
function pay(month: string, amount = 500): Payment {
  return {
    id: `p-${month}`,
    householdId: "hh",
    familyId: "fam",
    amount,
    date: { toDate: () => new Date(`${month}-15`) } as never,
    month,
    note: null,
    recordedAt: { toDate: () => new Date() } as never,
    recordedBy: "uid",
    coverageGroupId: null,
  };
}

const FAMILY = {
  contributionTarget: 500,
  createdAt: new Date("2026-01-15"),
};

describe("planCoverage — back cascade", () => {
  it("full back cascade: 1500 on a fresh family fills 3 months (Jun + Jan + Feb)", () => {
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.currentMonth).toMatchObject({
      month: "2026-06",
      amount: 1500,
      selectable: false,
      defaultSelected: true,
    });
    expect(plan.backMonths).toEqual([
      {
        month: "2026-01",
        amount: 500,
        selectable: true,
        defaultSelected: false,
      },
      {
        month: "2026-02",
        amount: 500,
        selectable: true,
        defaultSelected: false,
      },
    ]);
    expect(plan.futureMonths).toEqual([]);
    expect(plan.totalAmount).toBe(1500);
    expect(plan.overLimitRemainder).toBe(1000);
  });

  it("partial back cascade: 1700 fills Jun + Jan + Feb (whole-month rule), remainder 200", () => {
    const plan = planCoverage({
      amount: 1700,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.currentMonth?.amount).toBe(1700);
    expect(plan.backMonths).toHaveLength(2);
    expect(plan.totalAmount).toBe(1700);
    expect(plan.overLimitRemainder).toBe(1200);
    expect(plan.backMonths.every((s) => !s.defaultSelected)).toBe(true);
  });

  it("no back cascade when all back months already paid", () => {
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [
        pay("2026-01"),
        pay("2026-02"),
        pay("2026-03"),
        pay("2026-04"),
        pay("2026-05"),
      ],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.backMonths).toEqual([]);
    expect(plan.currentMonth?.amount).toBe(1500);
    expect(plan.overLimitRemainder).toBe(1000);
  });

  it("skips individual paid back months but continues past them", () => {
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: FAMILY,
      // Jan paid, Feb unpaid → cascade fills Feb + Mar
      payments: [pay("2026-01")],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.backMonths.map((s) => s.month)).toEqual(["2026-02", "2026-03"]);
  });
});

describe("planCoverage — future cascade", () => {
  it("future cascade fills forward when checkbox is ticked AND back is empty", () => {
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [
        pay("2026-01"),
        pay("2026-02"),
        pay("2026-03"),
        pay("2026-04"),
        pay("2026-05"),
      ],
      applyToFutureMonths: true,
      randomUUID: deterministicUuid(),
    });
    expect(plan.backMonths).toEqual([]);
    expect(plan.futureMonths.map((s) => s.month)).toEqual([
      "2026-07",
      "2026-08",
    ]);
    expect(plan.futureMonths[0]?.defaultSelected).toBe(true);
    expect(plan.futureMonths[1]?.defaultSelected).toBe(false);
    expect(plan.totalAmount).toBe(2000);
    expect(plan.overLimitRemainder).toBe(500);
  });

  it("future cascade WITHOUT tick leaves the over-limit as remainder, no future docs", () => {
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [
        pay("2026-01"),
        pay("2026-02"),
        pay("2026-03"),
        pay("2026-04"),
        pay("2026-05"),
      ],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.futureMonths).toEqual([]);
    expect(plan.totalAmount).toBe(1500);
    expect(plan.overLimitRemainder).toBe(1000);
  });
});

describe("planCoverage — edge cases", () => {
  it("target=0 disables spillover entirely; remainder = full amount", () => {
    const plan = planCoverage({
      amount: 1000,
      date: new Date("2026-06-17"),
      family: { contributionTarget: 0, createdAt: new Date("2026-01-15") },
      payments: [],
      applyToFutureMonths: true,
      randomUUID: deterministicUuid(),
    });
    expect(plan.currentMonth).toBeNull();
    expect(plan.backMonths).toEqual([]);
    expect(plan.futureMonths).toEqual([]);
    expect(plan.totalAmount).toBe(0);
    expect(plan.overLimitRemainder).toBe(1000);
  });

  it("legacy family (no createdAt) starts the back window at the oldest payment", () => {
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: { contributionTarget: 500, createdAt: null },
      payments: [pay("2026-02")],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    // First payment is Feb → Feb already paid; Mar is the oldest unpaid.
    expect(plan.backMonths.map((s) => s.month)).toEqual(["2026-03", "2026-04"]);
  });

  it("race scenario: input payments include a month the algorithm would otherwise fill — that month is skipped", () => {
    // Caller passes the current snapshot; if a parallel write paid Mar
    // already, planCoverage must not re-fill it. This is the same
    // `paidSet` filter that the txn re-reads (FR-023, SC-007).
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [pay("2026-02")], // Feb already paid
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.backMonths.map((s) => s.month)).not.toContain("2026-02");
    expect(plan.backMonths.map((s) => s.month)).toEqual(["2026-03", "2026-04"]);
  });

  it("over-limit indicator: amount=600 with target=500 reports overLimitRemainder=100", () => {
    const plan = planCoverage({
      amount: 600,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.overLimitRemainder).toBe(100);
    expect(plan.backMonths).toEqual([]);
    expect(plan.totalAmount).toBe(600);
  });

  it("under-limit (amount=300): currentMonth still written, no overLimit signal", () => {
    const plan = planCoverage({
      amount: 300,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.overLimitRemainder).toBe(0);
    expect(plan.backMonths).toEqual([]);
    expect(plan.totalAmount).toBe(300);
  });

  it("returns a fresh coverageGroupId per call", () => {
    const a = planCoverage({
      amount: 1000,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    const b = planCoverage({
      amount: 1000,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(a.coverageGroupId).not.toBe(b.coverageGroupId);
  });
});
