import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { buildReceiptPdfDoc } from "@/lib/services/receiptPdf";

function ts(d: Date): Timestamp {
  return Timestamp.fromDate(d);
}

const contributionCtx = {
  kind: "contribution" as const,
  contribution: {
    id: "contrib-test-1",
    contributorName: "Test Contributor",
    amount: 100,
    date: ts(new Date("2026-06-15")),
    note: null,
    addedAt: ts(new Date("2026-06-15")),
    addedBy: "tester",
  },
  currency: "AED",
};

describe("buildReceiptPdfDoc", () => {
  it("builds A5 receipt PDF", () => {
    const { doc, fileName } = buildReceiptPdfDoc(contributionCtx, "a5");
    expect(fileName).toMatch(/^jamia-receipt-contrib-/);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(148, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(210, 0);
  });

  it("builds A4 receipt PDF", () => {
    const { doc, fileName } = buildReceiptPdfDoc(contributionCtx, "a4");
    expect(fileName).toMatch(/^jamia-receipt-contrib-/);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 0);
  });

  it("defaults to A5 when format omitted", () => {
    const { doc } = buildReceiptPdfDoc(contributionCtx);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(148, 0);
  });
});
