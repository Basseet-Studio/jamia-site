"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { printReceiptPdf } from "@/lib/services/receiptPdfClient";
import type { ReceiptContext } from "@/lib/services/receiptPdf";
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

  async function onPrint() {
    logReceiptPdf("click", "info", {
      context: summarizeReceiptContext(ctx),
      format: "a5",
    });
    setBusy(true);
    try {
      await printReceiptPdf(ctx);
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
        onClick={() => void onPrint()}
      >
        Print
      </Button>
    </div>
  );
}
