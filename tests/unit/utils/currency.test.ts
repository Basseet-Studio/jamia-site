import { describe, expect, it } from "vitest";
import { formatCurrency, formatCurrencyDelta } from "@/lib/utils/currency";

describe("formatCurrency", () => {
  it("formats with currency prefix and 2 decimal places", () => {
    expect(formatCurrency(1234.5, "AED")).toBe("AED 1,234.50");
  });
  it("handles zero", () => {
    expect(formatCurrency(0, "AED")).toBe("AED 0.00");
  });
  it("handles negative values (money on hand may be negative)", () => {
    expect(formatCurrency(-50, "AED")).toBe("AED -50.00");
  });
  it("falls back to 0 for non-finite", () => {
    expect(formatCurrency(Number.NaN, "AED")).toBe("AED 0.00");
  });
});

describe("formatCurrencyDelta", () => {
  it("adds + for positive deltas", () => {
    expect(formatCurrencyDelta(50, "AED")).toBe("+AED 50.00");
  });
  it("uses - prefix for negative deltas (the minus is in the number)", () => {
    expect(formatCurrencyDelta(-50, "AED")).toBe("-AED 50.00");
  });
  it("returns formatted zero when delta is zero", () => {
    expect(formatCurrencyDelta(0, "AED")).toBe("AED 0.00");
  });
});
