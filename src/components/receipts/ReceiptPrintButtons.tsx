"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { printReceiptPdf } from "@/lib/services/receiptPdfClient";
import type { ReceiptContext, ReceiptPdfFormat } from "@/lib/services/receiptPdf";
import { logReceiptPdf, summarizeReceiptContext } from "@/lib/services/receiptPdfDebug";

export function ReceiptPrintButtons({
  ctx,
  size = "sm",
  variant = "outline",
}: {
  ctx: ReceiptContext;
  size?: "sm" | "default" | "lg" | "icon" | "icon-sm";
  variant?: "outline" | "ghost" | "default" | "secondary" | "link";
}) {
  const [busy, setBusy] = useState(false);

  function onPrint(format: ReceiptPdfFormat) {
    logReceiptPdf("click", "info", {
      context: summarizeReceiptContext(ctx),
      format,
    });
    setBusy(true);
    try {
      printReceiptPdf(ctx, format);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1">
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={busy}
        onClick={() => onPrint("a4")}
      >
        Print A4
      </Button>
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled={busy}
        onClick={() => onPrint("a5")}
      >
        Print A5
      </Button>
    </div>
  );
}
