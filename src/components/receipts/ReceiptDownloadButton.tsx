"use client";

import { Button } from "@/components/ui/button";
import { downloadReceiptPdf } from "@/lib/services/receiptPdfClient";
import type { ReceiptContext } from "@/lib/services/receiptPdf";

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
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => downloadReceiptPdf(ctx)}
    >
      {label}
    </Button>
  );
}
