import { describe, expect, it } from "vitest";
import {
  currentMonthKey,
  fromMonthKey,
  stepMonthKey,
  toMonthKey,
  isSameMonth,
} from "@/lib/utils/dates";

describe("toMonthKey", () => {
  it("formats YYYY-MM", () => {
    expect(toMonthKey(new Date(2025, 5, 15))).toBe("2025-06");
  });
  it("zero-pads single-digit months", () => {
    expect(toMonthKey(new Date(2025, 0, 1))).toBe("2025-01");
  });
});

describe("fromMonthKey", () => {
  it("parses a YYYY-MM back to a Date", () => {
    const d = fromMonthKey("2025-06");
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(5);
  });
});

describe("currentMonthKey", () => {
  it("matches toMonthKey(today)", () => {
    const now = new Date(2025, 5, 15);
    expect(currentMonthKey(now)).toBe(toMonthKey(now));
  });
});

describe("stepMonthKey", () => {
  it("steps forward", () => {
    expect(stepMonthKey("2025-06", 1)).toBe("2025-07");
  });
  it("steps backward and crosses year boundary", () => {
    expect(stepMonthKey("2025-01", -1)).toBe("2024-12");
  });
  it("steps forward across year boundary", () => {
    expect(stepMonthKey("2025-12", 1)).toBe("2026-01");
  });
});

describe("isSameMonth", () => {
  it("returns true for same month", () => {
    expect(isSameMonth(new Date(2025, 5, 1), new Date(2025, 5, 30))).toBe(true);
  });
  it("returns false for different months", () => {
    expect(isSameMonth(new Date(2025, 5, 30), new Date(2025, 6, 1))).toBe(false);
  });
});
