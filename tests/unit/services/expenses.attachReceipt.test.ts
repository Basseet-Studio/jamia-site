/**
 * attachExpenseReceipt guards: receipt scan only after withdrawal.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const { getDoc, updateDoc, uploadReceiptAttachment } = vi.hoisted(() => ({
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  uploadReceiptAttachment: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(() => ({ id: "exp-1" })),
  getDoc,
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  updateDoc,
  where: vi.fn(),
}));

vi.mock("@/lib/firebase/client", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("@/lib/services/moneyOnHand", () => ({
  shiftMoneyOnHandInTx: vi.fn(),
}));

vi.mock("@/lib/services/attachments", () => ({
  uploadReceiptAttachment,
  deleteReceiptAttachment: vi.fn(),
  attachmentFieldsFromInput: (attachment: {
    path: string;
    fileName: string;
    mimeType: string;
  }) => ({
    attachmentPath: attachment.path,
    attachmentFileName: attachment.fileName,
    attachmentMimeType: attachment.mimeType,
  }),
  parseAttachmentFields: (data: Record<string, unknown>) => ({
    attachmentPath:
      typeof data.attachmentPath === "string" ? data.attachmentPath : null,
    attachmentFileName:
      typeof data.attachmentFileName === "string"
        ? data.attachmentFileName
        : null,
    attachmentMimeType:
      typeof data.attachmentMimeType === "string"
        ? data.attachmentMimeType
        : null,
  }),
}));

import { attachExpenseReceipt } from "@/lib/services/expenses";

function mockExpenseDoc(data: Record<string, unknown>) {
  getDoc.mockResolvedValueOnce({
    exists: () => true,
    data: () => data,
  });
}

describe("attachExpenseReceipt", () => {
  const file = new File(["pdf"], "signed.pdf", { type: "application/pdf" });

  beforeEach(() => {
    vi.clearAllMocks();
    uploadReceiptAttachment.mockResolvedValue({
      path: "receipts/expenses/exp-1/signed.pdf",
      fileName: "signed.pdf",
      mimeType: "application/pdf",
    });
    updateDoc.mockResolvedValue(undefined);
  });

  it("rejects when expense is not found", async () => {
    getDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(
      attachExpenseReceipt("uid", "exp-1", file),
    ).rejects.toThrow(/not found/);
  });

  it("rejects when expense is not withdrawn", async () => {
    mockExpenseDoc({ withdrawn: false, attachmentPath: null });
    await expect(
      attachExpenseReceipt("uid", "exp-1", file),
    ).rejects.toThrow(/must be withdrawn/);
  });

  it("rejects when expense already has an attachment", async () => {
    mockExpenseDoc({
      withdrawn: true,
      attachmentPath: "receipts/expenses/exp-1/old.pdf",
    });
    await expect(
      attachExpenseReceipt("uid", "exp-1", file),
    ).rejects.toThrow(/already has an attached receipt/);
  });

  it("uploads and updates attachment on withdrawn expense", async () => {
    mockExpenseDoc({ withdrawn: true, attachmentPath: null });
    await attachExpenseReceipt("uid", "exp-1", file);
    expect(uploadReceiptAttachment).toHaveBeenCalledWith(
      "expenses",
      "exp-1",
      file,
    );
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        attachmentPath: "receipts/expenses/exp-1/signed.pdf",
        attachmentFileName: "signed.pdf",
        attachmentMimeType: "application/pdf",
      }),
    );
  });
});
