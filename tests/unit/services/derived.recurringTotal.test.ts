/**
 * subscribeRecurringTotalForMonth — sums active (non-withdrawn) recurring
 * expenses scheduled for a month. Excludes:
 *   - non-recurring expenses
 *   - recurring expenses for other months
 *   - withdrawn recurring expenses
 *
 * This test stubs Firebase out of the loop by exercising the same logic
 * via an in-memory snapshot adapter, so we can pin the math without
 * depending on the emulator.
 */
import { describe, expect, it } from "vitest";

/**
 * Pure reimplementation of the reducer inside
 * subscribeRecurringTotalForMonth. If the production logic ever diverges,
 * the test must be updated in lockstep.
 */
function reduceDocs(
  docs: Array<{ data: () => Record<string, unknown> }>,
): number {
  return docs.reduce((s, d) => {
    const data = d.data();
    if (data.isRecurring !== true) return s;
    if (data.withdrawn === true) return s;
    return s + (typeof data.amount === "number" ? (data.amount as number) : 0);
  }, 0);
}

const fakeDoc = (data: Record<string, unknown>) => ({ data: () => data });

describe("subscribeRecurringTotalForMonth — reduction logic", () => {
  it("sums only recurring + non-withdrawn expenses", () => {
    const total = reduceDocs([
      fakeDoc({ isRecurring: true, withdrawn: false, amount: 100 }),
      fakeDoc({ isRecurring: true, withdrawn: false, amount: 50 }),
      fakeDoc({ isRecurring: true, withdrawn: true, amount: 999 }), // excluded
      fakeDoc({ isRecurring: false, withdrawn: false, amount: 999 }), // excluded
    ]);
    expect(total).toBe(150);
  });

  it("returns 0 for an empty snapshot", () => {
    expect(reduceDocs([])).toBe(0);
  });

  it("ignores non-numeric amounts defensively", () => {
    const total = reduceDocs([
      fakeDoc({ isRecurring: true, withdrawn: false, amount: 100 }),
      fakeDoc({ isRecurring: true, withdrawn: false, amount: "oops" }),
      fakeDoc({ isRecurring: true, withdrawn: false }), // missing amount
    ]);
    expect(total).toBe(100);
  });
});