import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import {
  RECEIPT_ADDRESS,
  RECEIPT_LABEL_CONTRIBUTION,
  RECEIPT_LABEL_EXPENSE,
  RECEIPT_LABEL_PAYMENT,
  RECEIPT_TITLE_AR,
  RECEIPT_TITLE_ML,
} from "@/lib/brand";
import {
  amountInWords,
  buildReceiptModel,
  buildReceiptPdfDoc,
  receiptKindLabel,
  type ReceiptContext,
} from "@/lib/services/receiptPdf";
import { paymentReceiptGroup } from "@/lib/services/receiptPdfContext";
import type { Payment } from "@/lib/types";

function ts(d: Date): Timestamp {
  return Timestamp.fromDate(d);
}

function expectSlipTitles(ctx: ReceiptContext) {
  const model = buildReceiptModel(ctx);
  expect(model.titleAr).toBe(RECEIPT_TITLE_AR);
  expect(model.titleMl).toBe(RECEIPT_TITLE_ML);
  expect(model.address).toBe(RECEIPT_ADDRESS);
  expect(model.kindLabel).toBe(receiptKindLabel(ctx.kind));
  const { doc, org } = buildReceiptPdfDoc(ctx);
  expect(org).toBe(
    `${RECEIPT_TITLE_AR}\n${RECEIPT_TITLE_ML}\n${RECEIPT_ADDRESS}\n${receiptKindLabel(ctx.kind)}`,
  );
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
    expect(model.serial).toBe("C-0018");
    expect(model.address).toBe(RECEIPT_ADDRESS);
    expect(model.kindLabel).toBe(RECEIPT_LABEL_CONTRIBUTION);
    expect(model.total).toContain("100.00");
    expect(model.total).toContain("INR");
    expect(model.totalInWords).toBe("One Hundred Rupees Only");
    expect(model.particulars[0]?.amount).toContain("100.00");
    const { fileName } = buildReceiptPdfDoc(contributionCtx);
    expect(fileName).toMatch(/^jamia-receipt-C-0018-/);
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
    const expense = buildReceiptModel({
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
    expect(expense.serial).toBe("E-0007");
    expect(expense.kindLabel).toBe(RECEIPT_LABEL_EXPENSE);
    expect(expense.total).toContain("INR");
    expect(expense.totalInWords).toBe("Eighty Rupees Only");
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
    expect(model.address).toBe(RECEIPT_ADDRESS);
    expect(model.particulars.map((p) => p.text)).toContain("Jun 2026");
    expect(model.particulars.map((p) => p.text)).toContain("Jul 2026");
    expect(model.kindLabel).toBe(RECEIPT_LABEL_PAYMENT);
    expect(model.total).toContain("500.00");
    expect(model.total).toContain("INR");
    expect(model.totalInWords).toBe("Five Hundred Rupees Only");
    expect(model.note).toBe("zakat");
  });
});

function payment(over: Partial<Payment>): Payment {
  return {
    id: "pay",
    householdId: "hh",
    familyId: "fam",
    amount: 100,
    date: ts(new Date(2026, 5, 17, 1, 0)),
    month: "2026-06",
    note: null,
    recordedAt: ts(new Date(2026, 5, 17, 1, 0)),
    recordedBy: "u",
    coverageGroupId: "cg",
    receiptNo: null,
    ...over,
  };
}

function paymentCtx(primary: Payment, related: Payment[]): ReceiptContext {
  return {
    kind: "payment",
    payment: primary,
    householdName: "HH",
    familyName: "Fam",
    relatedPayments: related,
    currency: "INR",
  };
}

describe("payment receipts covering several months", () => {
  it("uses the lowest receipt number in the group and sorts months", () => {
    const a = payment({ id: "a", month: "2026-07", receiptNo: 12 });
    const b = payment({ id: "b", month: "2026-06", receiptNo: 11 });
    const model = buildReceiptModel(paymentCtx(a, [a, b]));
    expect(model.serial).toBe("P-0011");
    expect(model.particulars.slice(1).map((p) => p.text)).toEqual([
      "Jun 2026",
      "Jul 2026",
    ]);
  });

  it("prints the local calendar date, not the UTC one", () => {
    const p = payment({ date: ts(new Date(2026, 5, 17, 1, 0)) });
    expect(buildReceiptModel(paymentCtx(p, [p])).date).toBe("2026-06-17");
  });

  it("rounds float totals to two decimals", () => {
    const a = payment({ id: "a", amount: 0.1, month: "2026-06" });
    const b = payment({ id: "b", amount: 0.2, month: "2026-07" });
    const model = buildReceiptModel(paymentCtx(a, [a, b]));
    expect(model.total).toBe("0.30 INR");
    expect(model.totalInWords).toBe("Thirty Paise Only");
  });

  it("continues on a new page and keeps the total for 12 months", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      payment({
        id: `m${i}`,
        month: `2026-${String(i + 1).padStart(2, "0")}`,
        amount: 500,
        receiptNo: 40,
      }),
    );
    const ctx = paymentCtx(months[0]!, months);
    const model = buildReceiptModel(ctx);
    expect(model.particulars).toHaveLength(13);
    expect(model.total).toBe("6,000.00 INR");
    expect(model.totalInWords).toBe("Six Thousand Rupees Only");
    const { doc } = buildReceiptPdfDoc(ctx, {
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      widthMm: 194,
      heightMm: 40,
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});

describe("paymentReceiptGroup", () => {
  it("collects siblings of the same group and family, sorted by month", () => {
    const a = payment({ id: "a", month: "2026-08" });
    const b = payment({ id: "b", month: "2026-06" });
    const other = payment({ id: "c", coverageGroupId: "other" });
    const otherFamily = payment({ id: "d", familyId: "fam2" });
    expect(
      paymentReceiptGroup(a, [a, b, other, otherFamily]).map((p) => p.id),
    ).toEqual(["b", "a"]);
  });

  it("returns just the payment when it has no group", () => {
    const p = payment({ coverageGroupId: null });
    expect(paymentReceiptGroup(p, [p, payment({ id: "x" })])).toEqual([p]);
  });

  it("includes the payment even if it is missing from the list", () => {
    const a = payment({ id: "a", month: "2026-07" });
    const b = payment({ id: "b", month: "2026-06" });
    expect(paymentReceiptGroup(a, [b]).map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("amountInWords", () => {
  it("writes whole dirhams and fils, and keeps other currencies as a code", () => {
    expect(amountInWords(100, "AED")).toBe("One Hundred Dirhams Only");
    expect(amountInWords(100.5, "aed")).toBe(
      "One Hundred Dirhams and Fifty Fils Only",
    );
    expect(amountInWords(1, "AED")).toBe("One Dirham Only");
    expect(amountInWords(100, "INR")).toBe("One Hundred Rupees Only");
    expect(amountInWords(100.5, "inr")).toBe(
      "One Hundred Rupees and Fifty Paise Only",
    );
    expect(amountInWords(1, "INR")).toBe("One Rupee Only");
    expect(amountInWords(0.01, "INR")).toBe("One Paisa Only");
    expect(amountInWords(100.5, "USD")).toBe("One Hundred and Fifty USD Only");
  });
});
