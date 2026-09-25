import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { RECEIPT_TITLE_AR, RECEIPT_TITLE_ML } from "@/lib/brand";
import {
  buildReceiptModel,
  buildReceiptPdfDoc,
  type ReceiptContext,
} from "@/lib/services/receiptPdf";

function ts(d: Date): Timestamp {
  return Timestamp.fromDate(d);
}

function expectSlipTitles(ctx: ReceiptContext) {
  const model = buildReceiptModel(ctx);
  expect(model.titleAr).toBe(RECEIPT_TITLE_AR);
  expect(model.titleMl).toBe(RECEIPT_TITLE_ML);
  const { doc, org } = buildReceiptPdfDoc(ctx);
  expect(org).toBe(`${RECEIPT_TITLE_AR}\n${RECEIPT_TITLE_ML}`);
  expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
  expect(doc.internal.pageSize.getHeight()).toBeCloseTo(148, 0);
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
  it("builds an A5 landscape contribution receipt with both titles", () => {
    const model = buildReceiptModel(contributionCtx);
    expect(model.serial).toBe("C-18");
    expect(model.total).toContain("100.00");
    expect(model.particulars[0]?.amount).toContain("100.00");
    const { fileName } = buildReceiptPdfDoc(contributionCtx);
    expect(fileName).toMatch(/^jamia-receipt-C-18-/);
    expectSlipTitles(contributionCtx);
  });

  it("prints payment and expense on the same A5 landscape page with the same titles", () => {
    expectSlipTitles({
      kind: "payment",
      payment: {
        id: "pay-1",
        householdId: "hh",
        familyId: "fam",
        amount: 200,
        date: ts(new Date("2026-06-17")),
        month: "2026-06",
        note: null,
        recordedAt: ts(new Date("2026-06-17")),
        recordedBy: "u",
        coverageGroupId: null,
        receiptNo: 1996,
      },
      householdName: "HH One",
      familyName: "Fam A",
      currency: "AED",
    });
    expectSlipTitles({
      kind: "expense",
      expense: {
        id: "exp-1",
        name: "Water",
        amount: 80,
        date: ts(new Date("2026-06-01")),
        month: "2026-06",
        note: null,
        isRecurring: false,
        recurringId: null,
        withdrawn: true,
        withdrawnAt: ts(new Date("2026-06-02")),
        withdrawnBy: "u",
        addedAt: ts(new Date("2026-06-01")),
        addedBy: "u",
        type: "mosque",
        householdId: null,
        familyId: null,
        mosqueSubCategory: "other",
        receiptNo: 7,
      },
      currency: "AED",
    });
  });

  it("lists payment months with amounts and a total", () => {
    const model = buildReceiptModel({
      kind: "payment",
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
    });
    expect(model.titleAr).toBe(RECEIPT_TITLE_AR);
    expect(model.titleMl).toBe(RECEIPT_TITLE_ML);
    expect(model.serial).toBe("P-1996");
    expect(model.particulars.map((p) => p.text)).toContain("2026-06");
    expect(model.particulars.map((p) => p.text)).toContain("2026-07");
    expect(model.total).toContain("500.00");
    expect(model.note).toBe("zakat");
  });
});
