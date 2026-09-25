import { jsPDF } from "jspdf";
import { RECEIPT_TITLE_AR, RECEIPT_TITLE_ML } from "@/lib/brand";
import type { Contribution, Expense, Payment } from "@/lib/types";
import {
  describeTimestamp,
  isReceiptPdfVerbose,
  logReceiptPdf,
  summarizeReceiptContext,
} from "@/lib/services/receiptPdfDebug";
import {
  formatReceiptSerial,
  type ReceiptSerialKind,
} from "@/lib/services/receiptSerial";

export type ReceiptKind = "payment" | "contribution" | "expense";

export interface PaymentReceiptContext {
  kind: "payment";
  payment: Payment;
  householdName: string;
  familyName: string;
  relatedPayments?: Payment[];
  currency: string;
  orgName?: string;
}

export interface ContributionReceiptContext {
  kind: "contribution";
  contribution: Contribution;
  currency: string;
  orgName?: string;
}

export interface ExpenseReceiptContext {
  kind: "expense";
  expense: Expense;
  currency: string;
  householdName?: string;
  orgName?: string;
}

export type ReceiptContext =
  | PaymentReceiptContext
  | ContributionReceiptContext
  | ExpenseReceiptContext;

export interface ReceiptParticular {
  text: string;
  amount: string | null;
}

export interface ReceiptTitles {
  titleAr: string;
  titleMl: string;
}

export interface ReceiptModel {
  titleAr: string;
  titleMl: string;
  serial: string;
  date: string;
  particulars: ReceiptParticular[];
  total: string;
  note: string | null;
}

export function resolveReceiptTitles(input?: {
  titleAr?: string | null;
  titleMl?: string | null;
}): ReceiptTitles {
  const titleAr = input?.titleAr?.trim();
  const titleMl = input?.titleMl?.trim();
  return {
    titleAr: titleAr ? titleAr : RECEIPT_TITLE_AR,
    titleMl: titleMl ? titleMl : RECEIPT_TITLE_ML,
  };
}

export interface OrgNameImage {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

function formatMoney(amount: number, currency: string): string {
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) +
    " " +
    currency
  );
}

function formatDate(value: { toDate?: () => Date } | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : value.toDate?.();
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

function serialKind(ctx: ReceiptContext): ReceiptSerialKind {
  return ctx.kind;
}

function receiptNoOf(ctx: ReceiptContext): number | null | undefined {
  switch (ctx.kind) {
    case "payment":
      return ctx.payment.receiptNo;
    case "contribution":
      return ctx.contribution.receiptNo;
    case "expense":
      return ctx.expense.receiptNo;
  }
}

function receiptFileName(model: ReceiptModel): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = model.serial.replace(/[^A-Za-z0-9-]/g, "") || "receipt";
  return `jamia-receipt-${slug}-${date}.pdf`;
}

export function buildReceiptModel(
  ctx: ReceiptContext,
  titles?: { titleAr?: string | null; titleMl?: string | null },
): ReceiptModel {
  const serial = formatReceiptSerial(serialKind(ctx), receiptNoOf(ctx));
  const header = resolveReceiptTitles(titles);
  switch (ctx.kind) {
    case "payment": {
      const payments =
        ctx.relatedPayments && ctx.relatedPayments.length > 0
          ? ctx.relatedPayments
          : [ctx.payment];
      const total = payments.reduce((s, p) => s + p.amount, 0);
      const particulars: ReceiptParticular[] = [
        { text: `${ctx.householdName} / ${ctx.familyName}`, amount: null },
      ];
      for (const p of payments) {
        particulars.push({
          text: p.month,
          amount: formatMoney(p.amount, ctx.currency),
        });
      }
      return {
        titleAr: header.titleAr,
        titleMl: header.titleMl,
        serial,
        date: formatDate(ctx.payment.date),
        particulars,
        total: formatMoney(total, ctx.currency),
        note: ctx.payment.note,
      };
    }
    case "contribution":
      return {
        titleAr: header.titleAr,
        titleMl: header.titleMl,
        serial,
        date: formatDate(ctx.contribution.date),
        particulars: [
          {
            text: ctx.contribution.contributorName,
            amount: formatMoney(ctx.contribution.amount, ctx.currency),
          },
        ],
        total: formatMoney(ctx.contribution.amount, ctx.currency),
        note: ctx.contribution.note,
      };
    case "expense": {
      const status = ctx.expense.withdrawn ? "Paid / withdrawn" : "Pending";
      const who = ctx.householdName ? ` · ${ctx.householdName}` : "";
      return {
        titleAr: header.titleAr,
        titleMl: header.titleMl,
        serial,
        date: formatDate(ctx.expense.date),
        particulars: [
          {
            text: `${ctx.expense.name} (${ctx.expense.type}${who}) · ${ctx.expense.month} · ${status}`,
            amount: formatMoney(ctx.expense.amount, ctx.currency),
          },
        ],
        total: formatMoney(ctx.expense.amount, ctx.currency),
        note: ctx.expense.note,
      };
    }
  }
}

export function buildReceiptPdfDoc(
  ctx: ReceiptContext,
  orgNameImage?: OrgNameImage,
  titles?: { titleAr?: string | null; titleMl?: string | null },
) {
  const verbose = isReceiptPdfVerbose();
  const model = buildReceiptModel(ctx, titles);
  logReceiptPdf("build_start", "info", {
    context: summarizeReceiptContext(ctx),
    format: "a5-landscape",
    serial: model.serial,
  });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
  logReceiptPdf("jspdf_init_ok", "ok");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const innerW = pageW - margin * 2;
  const amountColW = 38;
  const particularsW = innerW - amountColW;
  const left = margin;
  const right = pageW - margin;
  const top = margin;
  const bottom = pageH - margin;

  doc.setDrawColor(0);
  doc.setTextColor(0);
  doc.setLineWidth(0.35);
  doc.rect(left, top, innerW, bottom - top);

  let y = top + 4;
  if (orgNameImage) {
    const maxW = innerW - 8;
    const scale = orgNameImage.widthMm > maxW ? maxW / orgNameImage.widthMm : 1;
    const w = orgNameImage.widthMm * scale;
    const h = orgNameImage.heightMm * scale;
    doc.addImage(
      orgNameImage.dataUrl,
      "PNG",
      left + (innerW - w) / 2,
      y,
      w,
      h,
    );
    y += h + 3;
  } else {
    y += 12;
  }

  doc.setLineWidth(0.2);
  doc.line(left, y, right, y);
  y += 5;

  doc.setFontSize(10);
  doc.text(`No. ${model.serial}`, left + 4, y);
  doc.text(`Date ${model.date}`, right - 4, y, { align: "right" });
  y += 5;
  doc.line(left, y, right, y);

  const headerY = y;
  const colX = left + particularsW;
  y += 6;
  doc.setFontSize(9);
  doc.text("Particulars", left + 4, y);
  doc.text("Amount", right - 4, y, { align: "right" });
  y += 3;
  doc.line(left, y, right, y);
  doc.line(colX, headerY, colX, y);

  const bodyTop = y;
  for (const row of model.particulars) {
    y += 6;
    if (verbose) {
      logReceiptPdf("build_line", "info", {
        label: row.text,
        value: row.amount ?? "",
      });
    }
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(row.text, particularsW - 8) as string[];
    doc.text(wrapped, left + 4, y);
    if (row.amount) {
      doc.text(row.amount, right - 4, y, { align: "right" });
    }
    y += Math.max(0, (wrapped.length - 1) * 4);
  }
  if (model.note) {
    y += 6;
    const wrapped = doc.splitTextToSize(`Note: ${model.note}`, particularsW - 8) as string[];
    doc.text(wrapped, left + 4, y);
    y += Math.max(0, (wrapped.length - 1) * 4);
  }

  y += 4;
  doc.line(left, y, right, y);
  y += 5;
  doc.setFontSize(10);
  doc.text("Total", left + 4, y);
  doc.text(model.total, right - 4, y, { align: "right" });
  y += 4;
  const totalBottom = y;
  doc.line(left, totalBottom, right, totalBottom);
  doc.line(colX, bodyTop, colX, totalBottom);

  y += 8;
  doc.setFontSize(9);
  doc.text("Signature", left + 4, y);
  y += 8;
  doc.line(left + 4, y, left + 70, y);

  const fileName = receiptFileName(model);
  logReceiptPdf("build_done", "ok", { fileName, finalY: y, serial: model.serial });

  return {
    doc,
    fileName,
    org: `${model.titleAr}\n${model.titleMl}`,
    model,
  };
}
