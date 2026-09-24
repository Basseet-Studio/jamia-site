export type ReceiptSerialKind = "payment" | "contribution" | "expense";

export const RECEIPT_SERIAL_PREFIX: Record<ReceiptSerialKind, string> = {
  payment: "P",
  contribution: "C",
  expense: "E",
};

export const RECEIPT_SEQ_FIELD: Record<ReceiptSerialKind, string> = {
  payment: "paymentReceiptSeq",
  contribution: "contributionReceiptSeq",
  expense: "expenseReceiptSeq",
};

export function formatReceiptSerial(
  kind: ReceiptSerialKind,
  n: number | null | undefined,
): string {
  const prefix = RECEIPT_SERIAL_PREFIX[kind];
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    return `${prefix}-`;
  }
  return `${prefix}-${Math.trunc(n)}`;
}

export function lastReceiptSeq(
  settingsData: Record<string, unknown> | undefined,
  kind: ReceiptSerialKind,
): number {
  const raw = settingsData?.[RECEIPT_SEQ_FIELD[kind]];
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0
    ? Math.trunc(raw)
    : 0;
}

/** Allocate `count` sequential receipt numbers from settings seq fields. */
export function nextReceiptNumbers(
  settingsData: Record<string, unknown> | undefined,
  kind: ReceiptSerialKind,
  count: number,
): { numbers: number[]; field: string; nextSeq: number } {
  if (count <= 0) {
    const last = lastReceiptSeq(settingsData, kind);
    return { numbers: [], field: RECEIPT_SEQ_FIELD[kind], nextSeq: last };
  }
  const last = lastReceiptSeq(settingsData, kind);
  const numbers = Array.from({ length: count }, (_, i) => last + i + 1);
  return {
    numbers,
    field: RECEIPT_SEQ_FIELD[kind],
    nextSeq: last + count,
  };
}

export type ReceiptNumberSeed = {
  id: string;
  date: string;
  receiptNo?: number | null;
};

/**
 * Keep existing positive numbers. Fill blanks from max+1, ordered by date then id.
 * Old dumps with no numbers start at 1.
 */
export function assignMissingReceiptNumbers(
  rows: ReceiptNumberSeed[],
): Map<string, number> {
  const out = new Map<string, number>();
  let max = 0;
  for (const row of rows) {
    if (typeof row.receiptNo === "number" && row.receiptNo > 0) {
      const n = Math.trunc(row.receiptNo);
      out.set(row.id, n);
      if (n > max) max = n;
    }
  }
  const missing = rows
    .filter((row) => !out.has(row.id))
    .slice()
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });
  let next = max + 1;
  for (const row of missing) {
    out.set(row.id, next++);
  }
  return out;
}

export function maxAssignedReceiptNo(assigned: Map<string, number>): number {
  let max = 0;
  for (const n of assigned.values()) {
    if (n > max) max = n;
  }
  return max;
}
