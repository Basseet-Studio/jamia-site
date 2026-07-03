"use client";

import { buildReceiptPdfDoc, type ReceiptContext } from "@/lib/services/receiptPdf";

export function downloadReceiptPdf(ctx: ReceiptContext): void {
  const { doc, fileName } = buildReceiptPdfDoc(ctx);
  doc.save(fileName);
}
