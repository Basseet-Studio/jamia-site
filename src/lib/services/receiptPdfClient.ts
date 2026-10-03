"use client";

import {
  buildReceiptPdfDoc,
  resolveReceiptAddress,
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
/** A5 landscape content width: 210 mm page minus 8 mm margins on each side. */
const RECEIPT_CONTENT_WIDTH_MM = 210 - 16;
const PX_PER_MM = 96 / 25.4;

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

function wrapLine(
  measure: (line: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (measure(trimmed) <= maxWidth) return [trimmed];
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && measure(next) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function rasterizeOrgName(
  titleAr: string,
  titleMl: string,
  address: string,
): Promise<OrgNameImage | undefined> {
  if (typeof document === "undefined") return undefined;
  await ensureHeaderFonts();
  const arSize = 22;
  const mlSize = 20;
  const addressSize = 13;
  const canvas = document.createElement("canvas");
  const probe = canvas.getContext("2d");
  if (!probe) return undefined;
  const padX = 8;
  const canvasWidth = Math.max(
    8,
    Math.round(RECEIPT_CONTENT_WIDTH_MM * PX_PER_MM),
  );
  const maxText = canvasWidth - padX * 2;
  probe.font = `${arSize}px "${AR_FAMILY}"`;
  const arLines = wrapLine((s) => probe.measureText(s).width, titleAr, maxText);
  probe.font = `${mlSize}px "${ML_FAMILY}"`;
  const mlLines = wrapLine((s) => probe.measureText(s).width, titleMl, maxText);
  probe.font = `${addressSize}px "${ML_FAMILY}"`;
  const addressLines = wrapLine(
    (s) => probe.measureText(s).width,
    address,
    maxText,
  );
  const arHeight = Math.ceil(arSize * 1.5);
  const mlHeight = Math.ceil(mlSize * 1.5);
  const addressHeight = Math.ceil(addressSize * 1.5);
  const gap = 6;
  const padY = 4;
  const height =
    padY +
    Math.max(arLines.length, 1) * arHeight +
    gap +
    Math.max(mlLines.length, 1) * mlHeight +
    (addressLines.length ? gap + addressLines.length * addressHeight : 0) +
    padY;
  canvas.width = canvasWidth;
  canvas.height = Math.max(height, 8);
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let y = padY;
  ctx.font = `${arSize}px "${AR_FAMILY}"`;
  ctx.direction = "rtl";
  for (const line of arLines.length ? arLines : [titleAr]) {
    ctx.fillText(line, canvas.width / 2, y);
    y += arHeight;
  }
  y += gap;
  ctx.font = `${mlSize}px "${ML_FAMILY}"`;
  ctx.direction = "ltr";
  for (const line of mlLines.length ? mlLines : [titleMl]) {
    ctx.fillText(line, canvas.width / 2, y);
    y += mlHeight;
  }
  if (addressLines.length) {
    y += gap;
    ctx.font = `${addressSize}px "${ML_FAMILY}"`;
    ctx.direction = "ltr";
    for (const line of addressLines) {
      ctx.fillText(line, canvas.width / 2, y);
      y += addressHeight;
    }
  }
  const pxToMm = 25.4 / 96;
  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: RECEIPT_CONTENT_WIDTH_MM,
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
    const address = resolveReceiptAddress(settings?.receiptAddress);
    const orgNameImage = await rasterizeOrgName(
      titles.titleAr,
      titles.titleMl,
      address,
    );
    const { doc } = buildReceiptPdfDoc(ctx, orgNameImage, { ...titles, address });
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
