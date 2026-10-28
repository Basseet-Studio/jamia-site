import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { fromMonthKey } from "@/lib/utils/dates";
import {
  RECEIPT_ADDRESS,
  RECEIPT_CURRENCY,
  RECEIPT_LABEL_CONTRIBUTION,
  RECEIPT_LABEL_EXPENSE,
  RECEIPT_LABEL_PAYMENT,
  RECEIPT_TITLE_AR,
  RECEIPT_TITLE_ML,
} from "@/lib/brand";
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
  address: string;
  kindLabel: string;
  serial: string;
  date: string;
  particulars: ReceiptParticular[];
  total: string;
  totalInWords: string;
  note: string | null;
}

export function receiptKindLabel(kind: ReceiptKind): string {
  switch (kind) {
    case "payment":
      return RECEIPT_LABEL_PAYMENT;
    case "contribution":
      return RECEIPT_LABEL_CONTRIBUTION;
    case "expense":
      return RECEIPT_LABEL_EXPENSE;
  }
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

export function resolveReceiptAddress(address?: string | null): string {
  const trimmed = address?.trim();
  return trimmed ? trimmed : RECEIPT_ADDRESS;
}

export interface OrgNameImage {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
}

function formatMoney(amount: number): string {
  return (
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) +
    " " +
    RECEIPT_CURRENCY
  );
}

const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function intToWords(n: number): string {
  if (n < 20) return ONES[n] ?? "Zero";
  if (n < 100) {
    const rest = n % 10;
    const ten = TENS[Math.floor(n / 10)] ?? "";
    return rest === 0 ? ten : `${ten}-${ONES[rest]}`;
  }
  if (n < 1000) {
    const rest = n % 100;
    const head = `${ONES[Math.floor(n / 100)]} Hundred`;
    return rest === 0 ? head : `${head} ${intToWords(rest)}`;
  }
  if (n < 1_000_000) {
    const rest = n % 1000;
    const head = `${intToWords(Math.floor(n / 1000))} Thousand`;
    return rest === 0 ? head : `${head} ${intToWords(rest)}`;
  }
  const rest = n % 1_000_000;
  const head = `${intToWords(Math.floor(n / 1_000_000))} Million`;
  return rest === 0 ? head : `${head} ${intToWords(rest)}`;
}

/** English receipt total. AED uses Dirham/Fil, INR uses Rupee/Paisa; other codes are appended as-is. */
export function amountInWords(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase() || "AED";
  const cents = Math.round(Math.abs(amount) * 100);
  const major = Math.floor(cents / 100);
  const minor = cents % 100;
  const units = namedCurrencyUnits(code, major, minor);
  const majorUnit = units.major ?? code;
  const minorUnit = units.minor;

  if (major === 0 && minor === 0) {
    return `Zero ${units.zero ?? code} Only`;
  }
  if (minor === 0) {
    return `${intToWords(major)} ${majorUnit} Only`;
  }
  if (major === 0) {
    return minorUnit
      ? `${intToWords(minor)} ${minorUnit} Only`
      : `${intToWords(minor)} ${code} Only`;
  }
  return minorUnit
    ? `${intToWords(major)} ${majorUnit} and ${intToWords(minor)} ${minorUnit} Only`
    : `${intToWords(major)} and ${intToWords(minor)} ${code} Only`;
}

function namedCurrencyUnits(
  code: string,
  major: number,
  minor: number,
): { major: string | null; minor: string | null; zero: string | null } {
  if (code === "AED") {
    return {
      major: major === 1 ? "Dirham" : "Dirhams",
      minor: minor === 1 ? "Fil" : "Fils",
      zero: "Dirhams",
    };
  }
  if (code === "INR") {
    return {
      major: major === 1 ? "Rupee" : "Rupees",
      minor: minor === 1 ? "Paisa" : "Paise",
      zero: "Rupees",
    };
  }
  return { major: null, minor: null, zero: null };
}

function formatDate(value: { toDate?: () => Date } | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : value.toDate?.();
  if (!d) return "—";
  return format(d, "yyyy-MM-dd");
}

function formatMonth(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  return format(fromMonthKey(monthKey), "MMM yyyy");
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function serialKind(ctx: ReceiptContext): ReceiptSerialKind {
  return ctx.kind;
}

function receiptNoOf(ctx: ReceiptContext): number | null | undefined {
  switch (ctx.kind) {
    case "payment": {
      const numbers = [ctx.payment, ...(ctx.relatedPayments ?? [])]
        .map((p) => p.receiptNo)
        .filter((n): n is number => typeof n === "number" && n > 0);
      return numbers.length > 0 ? Math.min(...numbers) : null;
    }
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
  titles?: {
    titleAr?: string | null;
    titleMl?: string | null;
    address?: string | null;
  },
): ReceiptModel {
  const serial = formatReceiptSerial(serialKind(ctx), receiptNoOf(ctx));
  const header = resolveReceiptTitles(titles);
  const address = resolveReceiptAddress(titles?.address);
  const kindLabel = receiptKindLabel(ctx.kind);
  switch (ctx.kind) {
    case "payment": {
      const payments = (
        ctx.relatedPayments && ctx.relatedPayments.length > 0
          ? [...ctx.relatedPayments]
          : [ctx.payment]
      ).sort((a, b) => a.month.localeCompare(b.month));
      const total = roundMoney(payments.reduce((s, p) => s + p.amount, 0));
      const particulars: ReceiptParticular[] = [
        { text: `${ctx.householdName} / ${ctx.familyName}`, amount: null },
      ];
      for (const p of payments) {
        particulars.push({
          text: formatMonth(p.month),
          amount: formatMoney(p.amount),
        });
      }
      return {
        titleAr: header.titleAr,
        titleMl: header.titleMl,
        address,
        kindLabel,
        serial,
        date: formatDate(ctx.payment.date),
        particulars,
        total: formatMoney(total),
        totalInWords: amountInWords(total, RECEIPT_CURRENCY),
        note: ctx.payment.note,
      };
    }
    case "contribution":
      return {
        titleAr: header.titleAr,
        titleMl: header.titleMl,
        address,
        kindLabel,
        serial,
        date: formatDate(ctx.contribution.date),
        particulars: [
          {
            text: ctx.contribution.contributorName,
            amount: formatMoney(ctx.contribution.amount),
          },
        ],
        total: formatMoney(ctx.contribution.amount),
        totalInWords: amountInWords(ctx.contribution.amount, RECEIPT_CURRENCY),
        note: ctx.contribution.note,
      };
    case "expense": {
      const status = ctx.expense.withdrawn ? "Paid / withdrawn" : "Pending";
      const who = ctx.householdName ? ` · ${ctx.householdName}` : "";
      return {
        titleAr: header.titleAr,
        titleMl: header.titleMl,
        address,
        kindLabel,
        serial,
        date: formatDate(ctx.expense.date),
        particulars: [
          {
            text: `${ctx.expense.name} (${ctx.expense.type}${who}) · ${formatMonth(ctx.expense.month)} · ${status}`,
            amount: formatMoney(ctx.expense.amount),
          },
        ],
        total: formatMoney(ctx.expense.amount),
        totalInWords: amountInWords(ctx.expense.amount, RECEIPT_CURRENCY),
        note: ctx.expense.note,
      };
    }
  }
}

export function buildReceiptPdfDoc(
  ctx: ReceiptContext,
  orgNameImage?: OrgNameImage,
  titles?: {
    titleAr?: string | null;
    titleMl?: string | null;
    address?: string | null;
  },
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

  const colX = left + particularsW;
  const rowStep = 5;
  const lineStep = 4;
  doc.setFontSize(9);
  const words = doc.splitTextToSize(model.totalInWords, innerW - 8) as string[];
  // Total row, amount in words and signature must fit below the last row.
  const footerH = 36 + (words.length - 1) * lineStep;

  const drawTableHeader = (continued: boolean) => {
    doc.setFontSize(10);
    doc.text(
      `No. ${model.serial}${continued ? " (continued)" : ""}`,
      left + 4,
      y,
    );
    doc.text(`Date ${model.date}`, right - 4, y, { align: "right" });
    y += 5;
    doc.line(left, y, right, y);
    const headerY = y;
    y += 6;
    doc.setFontSize(9);
    doc.text("Particulars", left + 4, y);
    doc.text("Amount", right - 4, y, { align: "right" });
    y += 3;
    doc.line(left, y, right, y);
    doc.line(colX, headerY, colX, y);
  };

  drawTableHeader(false);
  let bodyTop = y;

  const rows: ReceiptParticular[] = model.note
    ? [...model.particulars, { text: `Note: ${model.note}`, amount: null }]
    : model.particulars;
  for (const row of rows) {
    if (verbose) {
      logReceiptPdf("build_line", "info", {
        label: row.text,
        value: row.amount ?? "",
      });
    }
    doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(row.text, particularsW - 8) as string[];
    const rowH = rowStep + (wrapped.length - 1) * lineStep;
    if (y + rowH + 4 > bottom - footerH) {
      doc.line(colX, bodyTop, colX, bottom);
      doc.addPage("a5", "landscape");
      doc.setLineWidth(0.35);
      doc.rect(left, top, innerW, bottom - top);
      doc.setLineWidth(0.2);
      y = top + 6;
      drawTableHeader(true);
      bodyTop = y;
    }
    y += rowStep;
    doc.setFontSize(9);
    doc.text(wrapped, left + 4, y);
    if (row.amount) {
      doc.text(row.amount, right - 4, y, { align: "right" });
    }
    y += (wrapped.length - 1) * lineStep;
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

  y += 6;
  doc.setFontSize(9);
  doc.text(words, left + innerW / 2, y, { align: "center" });
  y += 4 + Math.max(0, (words.length - 1) * 4);

  y += 4;
  doc.setFontSize(9);
  doc.text("Signature", left + 4, y);
  y += 8;
  doc.line(left + 4, y, left + 70, y);

  const fileName = receiptFileName(model);
  logReceiptPdf("build_done", "ok", { fileName, finalY: y, serial: model.serial });

  return {
    doc,
    fileName,
    org: `${model.titleAr}\n${model.titleMl}\n${model.address}\n${model.kindLabel}`,
    model,
  };
}
