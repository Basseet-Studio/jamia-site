import type { ReceiptContext } from "@/lib/services/receiptPdf";

const LOG_PREFIX = "[jamia/receipt-pdf]";
const VERBOSE_KEY = "jamiaPdfDebug";

export type ReceiptPdfLogLevel = "info" | "ok" | "err";

export interface TimestampDiagnostics {
  label: string;
  typeof: string;
  isDate: boolean;
  hasToDate: boolean;
  hasSeconds: boolean;
  parsedIso: string | null;
}

export function isReceiptPdfVerbose(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname === "/debug") return true;
  try {
    return localStorage.getItem(VERBOSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setReceiptPdfVerbose(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) {
      localStorage.setItem(VERBOSE_KEY, "1");
    } else {
      localStorage.removeItem(VERBOSE_KEY);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function describeTimestamp(
  field: unknown,
  label: string,
): TimestampDiagnostics {
  const isDate = field instanceof Date;
  const hasToDate =
    typeof field === "object" &&
    field !== null &&
    typeof (field as { toDate?: unknown }).toDate === "function";
  const hasSeconds =
    typeof field === "object" &&
    field !== null &&
    "seconds" in field &&
    typeof (field as { seconds?: unknown }).seconds === "number";

  let parsedIso: string | null = null;
  if (isDate) {
    parsedIso = field.toISOString().slice(0, 10);
  } else if (hasToDate) {
    try {
      const d = (field as { toDate: () => Date }).toDate();
      parsedIso = d?.toISOString?.().slice(0, 10) ?? null;
    } catch {
      parsedIso = null;
    }
  } else if (hasSeconds) {
    try {
      const seconds = (field as { seconds: number }).seconds;
      parsedIso = new Date(seconds * 1000).toISOString().slice(0, 10);
    } catch {
      parsedIso = null;
    }
  }

  return {
    label,
    typeof: field === null ? "null" : typeof field,
    isDate,
    hasToDate,
    hasSeconds,
    parsedIso,
  };
}

export function summarizeReceiptContext(ctx: ReceiptContext) {
  switch (ctx.kind) {
    case "payment":
      return {
        kind: ctx.kind,
        id: ctx.payment.id,
        amount: ctx.payment.amount,
        currency: ctx.currency,
        month: ctx.payment.month,
        householdName: ctx.householdName,
        familyName: ctx.familyName,
        relatedPaymentsCount: ctx.relatedPayments?.length ?? 0,
        date: describeTimestamp(ctx.payment.date, "payment.date"),
      };
    case "contribution":
      return {
        kind: ctx.kind,
        id: ctx.contribution.id,
        amount: ctx.contribution.amount,
        currency: ctx.currency,
        contributorName: ctx.contribution.contributorName,
        date: describeTimestamp(ctx.contribution.date, "contribution.date"),
      };
    case "expense":
      return {
        kind: ctx.kind,
        id: ctx.expense.id,
        amount: ctx.expense.amount,
        currency: ctx.currency,
        name: ctx.expense.name,
        withdrawn: ctx.expense.withdrawn,
        date: describeTimestamp(ctx.expense.date, "expense.date"),
      };
  }
}

export function logReceiptPdf(
  stage: string,
  level: ReceiptPdfLogLevel,
  details?: Record<string, unknown>,
): void {
  const payload = {
    stage,
    level,
    ts: new Date().toISOString(),
    userAgent:
      typeof navigator !== "undefined"
        ? navigator.userAgent.slice(0, 120)
        : "server",
    ...details,
  };

  const msg = `${LOG_PREFIX} ${stage}`;
  if (level === "err") {
    console.error(msg, payload);
  } else if (level === "ok") {
    console.log(msg, payload);
  } else {
    console.info(msg, payload);
  }
}
