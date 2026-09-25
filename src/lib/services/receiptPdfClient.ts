"use client";

import {
  buildReceiptPdfDoc,
  resolveReceiptTitles,
  type OrgNameImage,
  type ReceiptContext,
} from "@/lib/services/receiptPdf";
import { getSettings } from "@/lib/services/settings";
import {
  logReceiptPdf,
  summarizeReceiptContext,
} from "@/lib/services/receiptPdfDebug";

const ML_FONT_URL = "/fonts/NotoSansMalayalam-Regular.ttf";
const AR_FONT_URL = "/fonts/NotoNaskhArabic-Regular.ttf";
const ML_FAMILY = "Noto Sans Malayalam";
const AR_FAMILY = "Noto Naskh Arabic";

let fontReady: Promise<void> | null = null;

function ensureHeaderFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!fontReady) {
    fontReady = (async () => {
      try {
        const faces = await Promise.all([
          new FontFace(ML_FAMILY, `url(${ML_FONT_URL})`).load(),
          new FontFace(AR_FAMILY, `url(${AR_FONT_URL})`).load(),
        ]);
        for (const face of faces) document.fonts.add(face);
      } catch {
        // Print still places the header image when the fonts load.
      }
    })();
  }
  return fontReady;
}

export async function rasterizeOrgName(
  titleAr: string,
  titleMl: string,
): Promise<OrgNameImage | undefined> {
  if (typeof document === "undefined") return undefined;
  await ensureHeaderFonts();
  const arSize = 22;
  const mlSize = 20;
  const canvas = document.createElement("canvas");
  const probe = canvas.getContext("2d");
  if (!probe) return undefined;
  probe.font = `${arSize}px "${AR_FAMILY}"`;
  const arWidth = probe.measureText(titleAr).width;
  probe.font = `${mlSize}px "${ML_FAMILY}"`;
  const mlWidth = probe.measureText(titleMl).width;
  const width = Math.ceil(Math.max(arWidth, mlWidth)) + 16;
  const arHeight = Math.ceil(arSize * 1.5);
  const mlHeight = Math.ceil(mlSize * 1.5);
  const gap = 6;
  const height = arHeight + gap + mlHeight + 8;
  canvas.width = Math.max(width, 8);
  canvas.height = Math.max(height, 8);
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `${arSize}px "${AR_FAMILY}"`;
  ctx.direction = "rtl";
  ctx.fillText(titleAr, canvas.width / 2, 4);
  ctx.font = `${mlSize}px "${ML_FAMILY}"`;
  ctx.direction = "ltr";
  ctx.fillText(titleMl, canvas.width / 2, 4 + arHeight + gap);
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
    format: "a5-landscape",
  });
  try {
    const settings = await getSettings().catch(() => null);
    const titles = resolveReceiptTitles(
      settings
        ? { titleAr: settings.receiptTitleAr, titleMl: settings.receiptTitleMl }
        : undefined,
    );
    const orgNameImage = await rasterizeOrgName(titles.titleAr, titles.titleMl);
    const { doc } = buildReceiptPdfDoc(ctx, orgNameImage, titles);
    logReceiptPdf("build_ok", "ok", { format: "a5-landscape" });
    const url = doc.output("bloburl").toString();
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      logReceiptPdf("print_dialog", "ok", { format: "a5-landscape" });
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
      format: "a5-landscape",
    });
  }
}
