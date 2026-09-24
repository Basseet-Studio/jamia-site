import { describe, expect, it } from "vitest";
import {
  assignMissingReceiptNumbers,
  formatReceiptSerial,
  lastReceiptSeq,
  nextReceiptNumbers,
} from "@/lib/services/receiptSerial";

describe("receiptSerial", () => {
  it("formats P/C/E prefixes", () => {
    expect(formatReceiptSerial("payment", 1996)).toBe("P-1996");
    expect(formatReceiptSerial("contribution", 18)).toBe("C-18");
    expect(formatReceiptSerial("expense", 7)).toBe("E-7");
  });

  it("backfills old dumps from 1 by date then id", () => {
    const assigned = assignMissingReceiptNumbers([
      { id: "pay-cg-1", date: "2026-06-17T00:00:00.000Z" },
      { id: "pay-cg-2", date: "2026-06-17T00:00:00.000Z" },
      { id: "pay-legacy-1", date: "2026-05-10T00:00:00.000Z" },
    ]);
    expect(assigned.get("pay-legacy-1")).toBe(1);
    expect(assigned.get("pay-cg-1")).toBe(2);
    expect(assigned.get("pay-cg-2")).toBe(3);
  });

  it("keeps existing numbers and fills the rest from max+1", () => {
    const assigned = assignMissingReceiptNumbers([
      { id: "a", date: "2026-01-01", receiptNo: 5 },
      { id: "b", date: "2026-01-02" },
    ]);
    expect(assigned.get("a")).toBe(5);
    expect(assigned.get("b")).toBe(6);
  });

  it("allocates sequential numbers from settings seq", () => {
    expect(lastReceiptSeq({}, "payment")).toBe(0);
    const first = nextReceiptNumbers({}, "payment", 2);
    expect(first.numbers).toEqual([1, 2]);
    expect(first.nextSeq).toBe(2);
    const next = nextReceiptNumbers(
      { paymentReceiptSeq: 2 },
      "payment",
      1,
    );
    expect(next.numbers).toEqual([3]);
    expect(next.nextSeq).toBe(3);
  });
});
