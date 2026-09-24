"use client";

import {
  buildReceiptPdfDoc,
  type OrgNameImage,
  type ReceiptContext,
} from "@/lib/services/receiptPdf";
import { MOSQUE_NAME_ML } from "@/lib/brand";
import {
  logReceiptPdf,
  summarizeReceiptContext,
} from "@/lib/services/receiptPdfDebug";

const FONT_URL = "/fonts/NotoSansMalayalam-Regular.ttf";
const FONT_FAMILY = "Noto Sans Malayalam";

let fontReady: Promise<void> | null = null;

function ensureMalayalamFont(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!fontReady) {
    fontReady = (async () => {
      try {
        const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`);
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch {
        // Print still works with an unshaped fallback header.
      }
    })();
  }
  return fontReady;
}

export async function rasterizeOrgName(): Promise<OrgNameImage | undefined> {
  if (typeof document === "undefined") return undefined;
  await ensureMalayalamFont();
  const fontSizePx = 28;
  const canvas = document.createElement("canvas");
  const probe = canvas.getContext("2d");
  if (!probe) return undefined;
  probe.font = `${fontSizePx}px "${FONT_FAMILY}"`;
  const width = Math.ceil(probe.measureText(MOSQUE_NAME_ML).width) + 12;
  const height = Math.ceil(fontSizePx * 1.45);
  canvas.width = Math.max(width, 8);
  canvas.height = Math.max(height, 8);
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.font = `${fontSizePx}px "${FONT_FAMILY}"`;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "top";
  ctx.fillText(MOSQUE_NAME_ML, 6, 4);
  const pxToMm = 25.4 / 96;
  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: canvas.width * pxToMm,
    heightMm: canvas.height * pxToMm,
  };
}

export async function printReceiptPdf(ctx: ReceiptContext): Promise<void> {
  logReceiptPdf("print_start", "info", {
    context: summarizeReceiptContext(ctx),
    format: "a5",
  });
  try {
    const orgNameImage = await rasterizeOrgName();
    const { doc } = buildReceiptPdfDoc(ctx, orgNameImage);
    logReceiptPdf("build_ok", "ok", { format: "a5" });
    const url = doc.output("bloburl").toString();
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      logReceiptPdf("print_dialog", "ok", { format: "a5" });
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
      format: "a5",
    });
  }
}
