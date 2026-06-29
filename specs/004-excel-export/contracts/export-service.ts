/**
 * Excel Export service interface — the single contract between the UI and
 * the export pipeline. Mirrors the existing service-layer pattern (see
 * `specs/001-household-finance-dashboard/contracts/service-interface.ts`).
 *
 * The UI (Server / Client Components) calls `triggerExport(filter)`. The
 * implementation is split across:
 *   - `src/lib/services/excelExport.ts`       — pure, testable, no DOM / no library
 *   - `src/lib/services/excelExportClient.ts` — browser-only wrapper that
 *     imports `write-excel-file/browser` and drives the anchor-click download.
 *
 * Per the project rules, all user-facing strings on the UI side are routed
 * through `useT()` with an inline `// TODO: localise this later` comment.
 * The workbook itself contains data, not localisable UI text.
 */

import type {
  Household,
  Family,
  Payment,
  Expense,
  RecurringTemplate,
} from "@/lib/types";

// ============================================================================
// Filter snapshot (see `data-model.md` §3 for the canonical definition)
// ============================================================================

export type ExportKind =
  | "full"
  | "households"
  | "families"
  | "payments"
  | "expenses"
  | "recurring";

export type ExpenseSubCategory = "maintenance" | "salary" | "other";

export type FilterSnapshot =
  | { kind: "full" }
  | { kind: "households" }
  | {
      kind: "families";
      householdId: string;
      showSoftDeleted: boolean;
      month: string; // "YYYY-MM" or "all"
    }
  | {
      kind: "payments";
      householdId: string;
      familyId: string;
      filter: "all" | { month: string };
    }
  | {
      kind: "expenses";
      month: string | "all";
      subCategory: ExpenseSubCategory | null;
      expenseType: "mosque"; // only mosque-type expenses are listed on /expenses today
    }
  | {
      kind: "recurring";
      month: string;
      activeOnly: true;
    };

// ============================================================================
// Workbook model (see `data-model.md` §4-§7 for the canonical definition)
// ============================================================================

export type CellType = "string" | "number" | "date" | "datetime" | "boolean";

export interface Column {
  header: string;
  width: number; // Excel "characters"
  type: CellType;
  format?: string; // Excel format string ("#,##0.00", "yyyy-mm-dd", …)
}

export type Cell = string | number | Date | boolean | null;
export type Row = ReadonlyArray<Cell>;

export interface Sheet {
  name: string; // unique within workbook, max 31 chars, no \ / ? * [ ]
  columns: Column[];
  rows: Row[];
  rightToLeft: boolean;
  freezeHeader: boolean;
}

export interface WorkbookModel {
  fileName: string;
  sheets: Sheet[];
}

// ============================================================================
// Input / output of the export service
// ============================================================================

export interface ExportContext {
  adminUid: string;
  adminEmail: string | null;
  adminDisplayName: string | null;
  currency: string; // from settings.global.currency
  triggerTime: Date;
  locale: "en" | "ar" | "ta" | "ml"; // for rightToLeft on Arabic sheets
}

export interface ExportResult {
  fileName: string;
  blob: Blob;
  byteSize: number;
  rowCounts: Record<string, number>; // sheet name → row count (excluding header)
}

export class ExportError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

// ============================================================================
// Service interface
// ============================================================================

export interface ExcelExportService {
  /**
   * Build a workbook for the given filter and download it. Resolves with the
   * result on success; rejects with `ExportError` on any failure (caught by
   * the hook and surfaced inline per FR-009).
   */
  triggerExport(filter: FilterSnapshot, ctx: ExportContext): Promise<ExportResult>;

  /**
   * Pure: build a workbook model for the given filter + already-fetched data.
   * Exposed for unit testing and for the future "preview" / "scheduled" jobs.
   */
  buildWorkbook(
    filter: FilterSnapshot,
    data: ExportData,
    ctx: ExportContext,
  ): WorkbookModel;

  /**
   * Pure: derive the file name for a given filter + trigger time. Exposed for
   * unit testing and for any future "send file via email" use cases.
   */
  buildFileName(filter: FilterSnapshot, triggerTime: Date): string;
}

/**
 * The shape of the data the service expects. Pages that subscribe to live
 * data pass their current snapshot; the service does NOT subscribe itself
 * except for the `kind: "full"` case (see `excelExportClient.ts`).
 */
export interface ExportData {
  households: Household[];
  families: Family[];
  payments: Payment[];
  expenses: Expense[];
  recurringTemplates: RecurringTemplate[];
}
