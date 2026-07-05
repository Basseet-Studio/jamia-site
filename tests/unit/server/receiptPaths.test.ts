import { describe, expect, it } from "vitest";
import {
  buildReceiptStoragePath,
  isValidReceiptStoragePath,
  parseReceiptEntityType,
} from "@/lib/attachments/receiptPaths";

describe("isValidReceiptStoragePath", () => {
  it("accepts valid receipt paths", () => {
    expect(
      isValidReceiptStoragePath("receipts/payments/pay-1/scan.pdf"),
    ).toBe(true);
    expect(
      isValidReceiptStoragePath("receipts/contributions/c-1/receipt.png"),
    ).toBe(true);
    expect(
      isValidReceiptStoragePath("receipts/expenses/exp-1/signed.pdf"),
    ).toBe(true);
  });

  it("rejects traversal and absolute paths", () => {
    expect(
      isValidReceiptStoragePath("receipts/payments/../etc/passwd"),
    ).toBe(false);
    expect(
      isValidReceiptStoragePath("receipts/payments/pay-1/..%2fsecret"),
    ).toBe(false);
    expect(
      isValidReceiptStoragePath("/receipts/payments/pay-1/scan.pdf"),
    ).toBe(false);
    expect(
      isValidReceiptStoragePath("receipts\\payments\\pay-1\\scan.pdf"),
    ).toBe(false);
  });

  it("rejects wrong prefix or entity type", () => {
    expect(isValidReceiptStoragePath("uploads/payments/pay-1/scan.pdf")).toBe(
      false,
    );
    expect(
      isValidReceiptStoragePath("receipts/invoices/pay-1/scan.pdf"),
    ).toBe(false);
    expect(isValidReceiptStoragePath("receipts/payments/scan.pdf")).toBe(false);
  });
});

describe("parseReceiptEntityType", () => {
  it("parses known entity types", () => {
    expect(parseReceiptEntityType("payments")).toBe("payments");
    expect(parseReceiptEntityType("contributions")).toBe("contributions");
    expect(parseReceiptEntityType("expenses")).toBe("expenses");
  });

  it("rejects invalid values", () => {
    expect(parseReceiptEntityType("invoices")).toBeNull();
    expect(parseReceiptEntityType(null)).toBeNull();
    expect(parseReceiptEntityType(42)).toBeNull();
  });
});

describe("buildReceiptStoragePath", () => {
  it("sanitizes unsafe file names", () => {
    expect(
      buildReceiptStoragePath("expenses", "exp-1", 'bad:name?.pdf'),
    ).toBe("receipts/expenses/exp-1/bad-name-.pdf");
  });
});
