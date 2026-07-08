"use client";

import { buildReceiptPdfDoc, type ReceiptContext } from "@/lib/services/receiptPdf";
import {
  logReceiptPdf,
  summarizeReceiptContext,
} from "@/lib/services/receiptPdfDebug";

export function downloadReceiptPdf(ctx: ReceiptContext): void {
  logReceiptPdf("start", "info", { context: summarizeReceiptContext(ctx) });
  try {
    const { doc, fileName } = buildReceiptPdfDoc(ctx);
    logReceiptPdf("build_ok", "ok", { fileName });
    doc.save(fileName);
    logReceiptPdf("save_ok", "ok", { fileName });
  } catch (e) {
    const err = e as Error;
    logReceiptPdf("error", "err", {
      message: err.message,
      stack: err.stack,
      context: summarizeReceiptContext(ctx),
    });
  }
}
