"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadReceiptPdf } from "@/lib/services/receiptPdfClient";
import type { ReceiptContext } from "@/lib/services/receiptPdf";
import { logReceiptPdf, summarizeReceiptContext } from "@/lib/services/receiptPdfDebug";

export function ReceiptDownloadButton({
  ctx,
  label = "Download receipt",
  size = "sm",
  variant = "outline",
}: {
  ctx: ReceiptContext;
  label?: string;
  size?: "sm" | "default" | "lg" | "icon" | "icon-sm";
  variant?: "outline" | "ghost" | "default" | "secondary" | "link";
}) {
  const [busy, setBusy] = useState(false);

  function onClick() {
    logReceiptPdf("click", "info", { context: summarizeReceiptContext(ctx) });
    setBusy(true);
    try {
      downloadReceiptPdf(ctx);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={busy}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
