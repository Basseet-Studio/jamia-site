"use client";

import {
  buildReceiptPdfDoc,
  type ReceiptContext,
  type ReceiptPdfFormat,
} from "@/lib/services/receiptPdf";
import {
  logReceiptPdf,
  summarizeReceiptContext,
} from "@/lib/services/receiptPdfDebug";

export function printReceiptPdf(
  ctx: ReceiptContext,
  format: ReceiptPdfFormat,
): void {
  logReceiptPdf("print_start", "info", {
    context: summarizeReceiptContext(ctx),
    format,
  });
  try {
    const { doc } = buildReceiptPdfDoc(ctx, format);
    logReceiptPdf("build_ok", "ok", { format });
    const url = doc.output("bloburl").toString();
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      logReceiptPdf("print_dialog", "ok", { format });
      const cleanup = () => {
        iframe.remove();
        URL.revokeObjectURL(url);
      };
      iframe.contentWindow?.addEventListener("afterprint", cleanup, {
        once: true,
      });
      setTimeout(cleanup, 60_000);
    };
  } catch (e) {
    const err = e as Error;
    logReceiptPdf("error", "err", {
      message: err.message,
      stack: err.stack,
      context: summarizeReceiptContext(ctx),
      format,
    });
  }
}
