/**
 * Pure-function tests for `planCoverage()` + `resolveCoverageAllocation()`.
 */
import { describe, expect, it } from "vitest";
import {
  planCoverage,
  resolveCoverageAllocation,
} from "@/lib/services/coverage";
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
    id: `p-${month}-${amount}`,
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
  it("full back cascade: 1500 on a fresh family offers current + Jan + Feb", () => {
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
      amount: 500,
      selectable: false,
      defaultSelected: true,
    });
    expect(plan.backMonths.map((s) => s.month)).toEqual(["2026-01", "2026-02"]);
    expect(plan.futureMonths).toEqual([]);
    // Default selection is none of the back months → auto fills after current.
    expect(plan.totalAmount).toBe(1500);
    expect(plan.overLimitRemainder).toBe(0);
  });

  it("partial remainder is auto-allocated (no loose money)", () => {
    const plan = planCoverage({
      amount: 1700,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.currentMonth?.amount).toBe(500);
    expect(plan.backMonths.length).toBeGreaterThan(0);
    expect(plan.totalAmount).toBe(1700);
    expect(plan.overLimitRemainder).toBe(0);
  });

  it("skips Met back months but continues past them", () => {
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [pay("2026-01")],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.backMonths.map((s) => s.month)).toEqual(["2026-02", "2026-03"]);
  });

  it("offers Partial top-up on a back month that is under target", () => {
    const plan = planCoverage({
      amount: 1500,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [pay("2026-01", 200)],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    const jan = plan.backMonths.find((s) => s.month === "2026-01");
    expect(jan?.amount).toBe(300);
  });
});

describe("planCoverage — future cascade", () => {
  it("future cascade fills forward when back is empty", () => {
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
    expect(plan.totalAmount).toBe(1500);
    expect(plan.overLimitRemainder).toBe(0);
  });

  it("without future candidates still auto-allocates leftover after current", () => {
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
    expect(plan.overLimitRemainder).toBe(0);
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
    expect(plan.backMonths.map((s) => s.month)).toEqual(["2026-03", "2026-04"]);
  });

  it("tops up current month when already Partial", () => {
    const plan = planCoverage({
      amount: 300,
      date: new Date("2026-06-17"),
      family: { contributionTarget: 400, createdAt: new Date("2026-01-15") },
      payments: [pay("2026-06", 300)],
      applyToFutureMonths: true,
      randomUUID: deterministicUuid(),
    });
    expect(plan.alreadyPaidCurrent).toBe(300);
    expect(plan.remainingCapacityCurrent).toBe(100);
    expect(plan.currentMonth?.amount).toBe(100);
    expect(plan.totalAmount).toBe(300);
    expect(plan.overLimitRemainder).toBe(0);
  });

  it("under-limit (amount=300): currentMonth still written, fully allocated", () => {
    const plan = planCoverage({
      amount: 300,
      date: new Date("2026-06-17"),
      family: FAMILY,
      payments: [],
      applyToFutureMonths: false,
      randomUUID: deterministicUuid(),
    });
    expect(plan.currentMonth?.amount).toBe(300);
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

describe("resolveCoverageAllocation", () => {
  it("auto-applies leftover after selected spillover months", () => {
    const resolved = resolveCoverageAllocation({
      amount: 1000,
      date: new Date("2026-06-17"),
      family: { contributionTarget: 80, createdAt: new Date("2026-01-01") },
      payments: [],
      // Select 11 future spillover months after current (80*11=880) → leftover 40
      selectedCoverageMonths: [
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
        "2026-12",
        "2027-01",
        "2027-02",
        "2027-03",
        "2027-04",
        "2027-05",
      ],
    });
    expect(resolved.totalAmount).toBe(1000);
    expect(resolved.overLimitRemainder).toBe(0);
    const auto = resolved.autoMonths;
    expect(auto).toHaveLength(1);
    expect(auto[0]).toMatchObject({ month: "2027-06", amount: 40, auto: true });
  });

  it("tops up Partial current then spills remainder to next month", () => {
    const resolved = resolveCoverageAllocation({
      amount: 300,
      date: new Date("2026-06-17"),
      family: { contributionTarget: 400, createdAt: new Date("2026-01-01") },
      payments: [pay("2026-06", 300)],
      selectedCoverageMonths: [],
    });
    expect(resolved.writes).toEqual([
      expect.objectContaining({
        month: "2026-06",
        amount: 100,
        primary: true,
        auto: false,
      }),
      expect.objectContaining({
        month: "2026-07",
        amount: 200,
        auto: true,
      }),
    ]);
    expect(resolved.totalAmount).toBe(300);
  });
});
