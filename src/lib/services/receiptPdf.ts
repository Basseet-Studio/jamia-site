import { jsPDF } from "jspdf";
import type { Contribution, Expense, Payment } from "@/lib/types";
import {
  describeTimestamp,
  isReceiptPdfVerbose,
  logReceiptPdf,
  summarizeReceiptContext,
} from "@/lib/services/receiptPdfDebug";

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

function receiptTitle(ctx: ReceiptContext): string {
  switch (ctx.kind) {
    case "payment":
      return "Payment Receipt";
    case "contribution":
      return "Contribution Receipt";
    case "expense":
      return ctx.expense.withdrawn ? "Expense Payment Receipt" : "Expense Receipt";
  }
}

function receiptId(ctx: ReceiptContext): string {
  switch (ctx.kind) {
    case "payment":
      return ctx.payment.id;
    case "contribution":
      return ctx.contribution.id;
    case "expense":
      return ctx.expense.id;
  }
}

function receiptFileName(ctx: ReceiptContext): string {
  const date = new Date().toISOString().slice(0, 10);
  return `jamia-receipt-${receiptId(ctx).slice(0, 8)}-${date}.pdf`;
}

export function buildReceiptPdfDoc(ctx: ReceiptContext) {
  const verbose = isReceiptPdfVerbose();
  logReceiptPdf("build_start", "info", {
    context: summarizeReceiptContext(ctx),
  });

  const doc = new jsPDF({ unit: "mm", format: "a5" });
  logReceiptPdf("jspdf_init_ok", "ok");

  const margin = 14;
  let y = margin;

  const org = ctx.orgName ?? "Jamia Finance";
  doc.setFontSize(14);
  doc.text(org, margin, y);
  y += 8;
  doc.setFontSize(11);
  doc.text(receiptTitle(ctx), margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Receipt # ${receiptId(ctx)}`, margin, y);
  y += 8;
  doc.setTextColor(0);

  const line = (label: string, value: string) => {
    if (verbose) {
      logReceiptPdf("build_line", "info", { label, value });
    }
    doc.setFontSize(9);
    doc.text(label, margin, y);
    doc.text(value, margin + 42, y);
    y += 6;
  };

  switch (ctx.kind) {
    case "payment": {
      const payments =
        ctx.relatedPayments && ctx.relatedPayments.length > 0
          ? ctx.relatedPayments
          : [ctx.payment];
      if (verbose) {
        logReceiptPdf("build_payment_fields", "info", {
          date: describeTimestamp(ctx.payment.date, "payment.date"),
          paymentsCount: payments.length,
        });
      }
      line("Household", ctx.householdName);
      line("Family", ctx.familyName);
      line("Date", formatDate(ctx.payment.date));
      if (payments.length === 1) {
        line("Month", ctx.payment.month);
        line("Amount", formatMoney(ctx.payment.amount, ctx.currency));
      } else {
        line("Months covered", payments.map((p) => p.month).join(", "));
        line(
          "Total amount",
          formatMoney(
            payments.reduce((s, p) => s + p.amount, 0),
            ctx.currency,
          ),
        );
      }
      if (ctx.payment.note) line("Note", ctx.payment.note);
      break;
    }
    case "contribution": {
      if (verbose) {
        logReceiptPdf("build_contribution_fields", "info", {
          date: describeTimestamp(ctx.contribution.date, "contribution.date"),
        });
      }
      line("Contributor", ctx.contribution.contributorName);
      line("Date", formatDate(ctx.contribution.date));
      line("Amount", formatMoney(ctx.contribution.amount, ctx.currency));
      if (ctx.contribution.note) line("Note", ctx.contribution.note);
      break;
    }
    case "expense": {
      if (verbose) {
        logReceiptPdf("build_expense_fields", "info", {
          date: describeTimestamp(ctx.expense.date, "expense.date"),
        });
      }
      line("Expense", ctx.expense.name);
      line("Date", formatDate(ctx.expense.date));
      line("Month", ctx.expense.month);
      line("Amount", formatMoney(ctx.expense.amount, ctx.currency));
      line("Type", ctx.expense.type);
      if (ctx.householdName) line("Household", ctx.householdName);
      line("Status", ctx.expense.withdrawn ? "Paid / withdrawn" : "Pending");
      if (ctx.expense.note) line("Note", ctx.expense.note);
      break;
    }
  }

  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text("Thank you for your support.", margin, y);

  const fileName = receiptFileName(ctx);
  logReceiptPdf("build_done", "ok", { fileName, finalY: y });

  return { doc, fileName };
}
