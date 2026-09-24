import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { MOSQUE_NAME_ML } from "@/lib/brand";
import {
  buildReceiptModel,
  buildReceiptPdfDoc,
} from "@/lib/services/receiptPdf";

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
    receiptNo: 18,
  },
  currency: "AED",
};

describe("buildReceiptPdfDoc", () => {
  it("builds A5 receipt PDF with serial, total, and Malayalam org name", () => {
    const model = buildReceiptModel(contributionCtx);
    expect(model.orgName).toBe(MOSQUE_NAME_ML);
    expect(model.serial).toBe("C-18");
    expect(model.total).toContain("100.00");
    expect(model.particulars[0]?.amount).toContain("100.00");
    const { doc, fileName, org } = buildReceiptPdfDoc(contributionCtx);
    expect(fileName).toMatch(/^jamia-receipt-C-18-/);
    expect(org).toBe(MOSQUE_NAME_ML);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(148, 0);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(210, 0);
  });

  it("defaults to A5", () => {
    const { doc } = buildReceiptPdfDoc(contributionCtx);
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(148, 0);
  });

  it("lists payment months with amounts and a total", () => {
    const ctx = {
      kind: "payment" as const,
      payment: {
        id: "pay-1",
        householdId: "hh",
        familyId: "fam",
        amount: 200,
        date: ts(new Date("2026-06-17")),
        month: "2026-06",
        note: "zakat",
        recordedAt: ts(new Date("2026-06-17")),
        recordedBy: "u",
        coverageGroupId: "cg",
        receiptNo: 1996,
      },
      householdName: "HH One",
      familyName: "Fam A",
      relatedPayments: [
        {
          id: "pay-1",
          householdId: "hh",
          familyId: "fam",
          amount: 200,
          date: ts(new Date("2026-06-17")),
          month: "2026-06",
          note: "zakat",
          recordedAt: ts(new Date("2026-06-17")),
          recordedBy: "u",
          coverageGroupId: "cg",
          receiptNo: 1996,
        },
        {
          id: "pay-2",
          householdId: "hh",
          familyId: "fam",
          amount: 300,
          date: ts(new Date("2026-06-17")),
          month: "2026-07",
          note: "zakat",
          recordedAt: ts(new Date("2026-06-17")),
          recordedBy: "u",
          coverageGroupId: "cg",
          receiptNo: 1997,
        },
      ],
      currency: "AED",
    };
    const model = buildReceiptModel(ctx);
    expect(model.serial).toBe("P-1996");
    expect(model.particulars.map((p) => p.text)).toContain("2026-06");
    expect(model.particulars.map((p) => p.text)).toContain("2026-07");
    expect(model.total).toContain("500.00");
    expect(model.note).toBe("zakat");
  });
});
