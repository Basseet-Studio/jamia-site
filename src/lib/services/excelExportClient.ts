"use client";
/**
 * Excel Export — browser-only wrapper.
 *
 * Imports `write-excel-file/browser` (Web Worker build) and drives the
 * anchor-click download. This module is intentionally separate from
 * `excelExport.ts` so the pure builder stays unit-testable in node.
 *
 * Two entry points:
 *   - `triggerDownload(filter, ctx)` — for `kind: "full"`. The dashboard
 *     doesn't subscribe to every collection; this function does its own
 *     one-shot reads of all five collections at click time.
 *   - `triggerDownloadWithData(filter, ctx, data)` — for per-screen exports.
 *     The page passes its already-subscribed live data; the export reads the
 *     same snapshot the screen renders.
 */
import writeXlsxFile from "write-excel-file/browser";

import {
  buildFileName,
  buildWorkbook,
  type Cell,
  type Column,
  type ExportContext,
  type ExportData,
  type ExportResult,
  type FilterSnapshot,
  type Row,
  type Sheet,
  type WorkbookModel,
} from "@/lib/services/excelExport";
import { listExpenses } from "@/lib/services/expenses";
import { listHouseholds } from "@/lib/services/households";
import { listFamilies } from "@/lib/services/families";
import { listPayments } from "@/lib/services/payments";
import { listRecurringTemplates } from "@/lib/services/recurring";
import type { Family, Household, Payment } from "@/lib/types";

// ============================================================================
// Pure → write-excel-file row mapping
// ============================================================================

/**
 * Convert a pure workbook model into the shape `write-excel-file` expects.
 * Each cell is materialised as a CellObject `{ value, type, format? }` so
 * that format strings on date/number columns actually take effect (write-
 * excel-file requires `format` on every Date cell, otherwise it throws).
 * Column widths are exported via the `columns` array.
 */
function writerType(
  c: Column,
):
  | StringConstructor
  | NumberConstructor
  | DateConstructor
  | BooleanConstructor {
  switch (c.type) {
    case "number":
      return Number;
    case "date":
    case "datetime":
      return Date;
    case "boolean":
      return Boolean;
    case "string":
    default:
      return String;
  }
}

function materialiseCell(
  value: Cell,
  column: Column,
): {
  value: Cell;
  type:
    | StringConstructor
    | NumberConstructor
    | DateConstructor
    | BooleanConstructor;
  format?: string;
} {
  const cellObject: {
    value: Cell;
    type:
      | StringConstructor
      | NumberConstructor
      | DateConstructor
      | BooleanConstructor;
    format?: string;
  } = {
    value,
    type: writerType(column),
  };
  if (column.format) cellObject.format = column.format;
  return cellObject;
}

function materialiseRow(
  row: Row,
  columns: ReadonlyArray<Column>,
): Array<ReturnType<typeof materialiseCell>> {
  return columns.map((c, idx) => materialiseCell(row[idx], c));
}

function toWriterColumns(columns: ReadonlyArray<Column>) {
  return columns.map((c) => ({
    width: c.width,
  }));
}

/**
 * Build a header row as CellObjects so write-excel-file renders a styled
 * header (bold). The header is prepended to the data rows; the workbook's
 * `freezeHeader: true` flag freezes this top row in Excel / Sheets.
 */
function buildHeaderRow(
  columns: ReadonlyArray<Column>,
): Array<{ value: string; type: StringConstructor; fontWeight: "bold" }> {
  return columns.map((c) => ({
    value: c.header,
    type: String,
    fontWeight: "bold" as const,
  }));
}

function toWriterSheets(workbook: WorkbookModel) {
  return workbook.sheets.map((sheet: Sheet) => {
    const headerRow = sheet.freezeHeader ? buildHeaderRow(sheet.columns) : [];
    return {
      data: [
        ...(headerRow.length > 0 ? [headerRow] : []),
        ...sheet.rows.map((row) => materialiseRow(row, sheet.columns)),
      ],
      sheet: sheet.name,
      columns: toWriterColumns(sheet.columns),
      rightToLeft: sheet.rightToLeft,
      stickyRowsCount: sheet.freezeHeader ? 1 : 0,
      showGridLines: true,
    };
  });
}

// ============================================================================
// Anchor-click download helper
// ============================================================================

function triggerAnchorDownload(blob: Blob, fileName: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("triggerAnchorDownload requires a browser environment");
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a brief delay so the browser has time to start the
  // download. 1 s is a safe margin (research.md §1).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================================
// Full-report data fetch (research.md §5)
// ============================================================================

/** Read payments via per-family paths (allowed by nested Firestore rules). */
async function listPaymentsForFamilies(families: Family[]): Promise<Payment[]> {
  if (families.length === 0) return [];
  const byFamily = await Promise.all(
    families.map((f) => listPayments(f.householdId, f.id)),
  );
  return byFamily.flat();
}

async function fetchAllData(): Promise<ExportData> {
  const [households, expenses, recurringTemplates] = await Promise.all([
    listHouseholds(),
    listExpenses("all"),
    listRecurringTemplates(false),
  ]);

  const familiesByHousehold = await Promise.all(
    households.map((h) => listFamilies(h.id)),
  );
  const families = familiesByHousehold.flat();
  const payments = await listPaymentsForFamilies(families);

  return { households, families, payments, expenses, recurringTemplates };
}

/**
 * One-shot fetch of families, payments, and household expenses for the
 * households list export (family counts + all-time financial columns).
 */
export async function fetchHouseholdExportData(
  households: Household[],
): Promise<ExportData> {
  const [familiesByHousehold, expenses] = await Promise.all([
    Promise.all(households.map((h) => listFamilies(h.id))),
    listExpenses("all", { type: "household" }),
  ]);
  const families = familiesByHousehold.flat();
  const payments = await listPaymentsForFamilies(families);
  return {
    households,
    families,
    payments,
    expenses,
    recurringTemplates: [],
  };
}

// ============================================================================
// Public entry points
// ============================================================================

/**
 * Per-screen export: the caller passes its already-subscribed data. The
 * export reads the same snapshot the screen renders — no extra Firestore
 * reads, no listener churn.
 */
export async function triggerDownloadWithData(
  filter: FilterSnapshot,
  ctx: ExportContext,
  data: ExportData,
): Promise<ExportResult> {
  const workbook = buildWorkbook(filter, data, ctx);
  return buildAndDownload(workbook);
}

/**
 * Full report: fetch every collection in parallel, then download.
 * Used by the dashboard's "Download full report (Excel)" button.
 */
export async function triggerDownload(
  filter: FilterSnapshot,
  ctx: ExportContext,
): Promise<ExportResult> {
  const data = await fetchAllData();
  return triggerDownloadWithData(filter, ctx, data);
}

// ============================================================================
// Internal: build .xlsx + download
// ============================================================================

async function buildAndDownload(
  workbook: WorkbookModel,
): Promise<ExportResult> {
  try {
    const sheets = toWriterSheets(workbook);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await writeXlsxFile(sheets as any);
    const blob = await result.toBlob();
    const byteSize = blob.size;
    triggerAnchorDownload(blob, workbook.fileName);
    const rowCounts: Record<string, number> = {};
    workbook.sheets.forEach((s) => {
      rowCounts[s.name] = s.rows.length;
    });
    return {
      fileName: workbook.fileName,
      blob,
      byteSize,
      rowCounts,
    };
  } catch (cause) {
    // eslint-disable-next-line no-console
    console.error("[excelExportClient] buildAndDownload failed:", cause);
    throw new Error(
      `Excel export failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

export { buildFileName };
