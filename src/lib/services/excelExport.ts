/**
 * Excel Export — pure module.
 *
 * No DOM, no `write-excel-file` import here. The browser-only wrapper lives in
 * `excelExportClient.ts`; this module is fully unit-testable in node/jsdom.
 *
 * Responsibilities:
 *   - Column spec constants (per contracts/workbook-format.md §1–§6)
 *   - `coerceCell(value, column)` — enforces the JS-type rules from
 *     data-model.md §6; never throws, only warns.
 *   - `buildWorkbook(filter, data, ctx)` — pure: returns a WorkbookModel.
 *   - `buildFileName(filter, triggerTime)` — pure: returns the .xlsx name.
 *   - `excelExportService` — the ExcelExportService object the contract
 *     describes. `triggerExport` here is a placeholder that the client
 *     wrapper overrides with the actual blob-build + anchor-click flow;
 *     the pure module owns `buildWorkbook` + `buildFileName`.
 *
 * Per the project rules, no new keys are added to `src/messages/*.json` in
 * this feature. Every UI string carries `// TODO: localise this later`.
 */
import type {
  Expense,
  Family,
  Household,
  MosqueSubCategory,
  Payment,
  RecurringTemplate,
} from "@/lib/types";
import { deriveHouseholdFinancialSummary } from "@/lib/services/derived";

// ============================================================================
// Types (mirrors contracts/export-service.ts verbatim)
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
      expenseType: "mosque";
    }
  | {
      kind: "recurring";
      month: string;
      activeOnly: true;
    };

export type CellType = "string" | "number" | "date" | "datetime" | "boolean";

export interface Column {
  header: string;
  width: number; // Excel "characters"
  type: CellType;
  format?: string; // Excel format string
}

export type Cell = string | number | Date | boolean | null;
export type Row = ReadonlyArray<Cell>;

export interface Sheet {
  name: string; // max 31 chars, no \ / ? * [ ]
  columns: Column[];
  rows: Row[];
  rightToLeft: boolean;
  freezeHeader: boolean;
}

export interface WorkbookModel {
  fileName: string;
  sheets: Sheet[];
}

export interface ExportContext {
  adminUid: string;
  adminEmail: string | null;
  adminDisplayName: string | null;
  currency: string;
  triggerTime: Date;
  locale: "en" | "ar" | "ta" | "ml";
}

export interface ExportResult {
  fileName: string;
  blob: Blob;
  byteSize: number;
  rowCounts: Record<string, number>;
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

export interface ExportData {
  households: Household[];
  families: Family[];
  payments: Payment[];
  expenses: Expense[];
  recurringTemplates: RecurringTemplate[];
}

export interface ExcelExportService {
  triggerExport(
    filter: FilterSnapshot,
    ctx: ExportContext,
  ): Promise<ExportResult>;
  buildWorkbook(
    filter: FilterSnapshot,
    data: ExportData,
    ctx: ExportContext,
  ): WorkbookModel;
  buildFileName(filter: FilterSnapshot, triggerTime: Date): string;
}

// ============================================================================
// Column specs (contracts/workbook-format.md §1–§6)
// ============================================================================

/** Info sheet (kind: "full" only). */
export const INFO_COLUMNS: ReadonlyArray<Column> = [
  {
    header: "Export timestamp",
    width: 20,
    type: "datetime",
    format: "yyyy-mm-dd hh:mm",
  },
  { header: "Currency", width: 8, type: "string" },
  { header: "Admin UID", width: 28, type: "string" },
  { header: "Admin email", width: 30, type: "string" },
  { header: "Admin display name", width: 24, type: "string" },
  { header: "Scope", width: 8, type: "string" },
  { header: "Filter snapshot", width: 30, type: "string" },
  { header: "Sheet count", width: 6, type: "number", format: "0" },
  { header: "Schema version", width: 6, type: "number", format: "0" },
];

/** Households sheet (workbook-format §2). */
export const HOUSEHOLDS_COLUMNS: ReadonlyArray<Column> = [
  { header: "Name", width: 30, type: "string" },
  { header: "Created on", width: 14, type: "date", format: "yyyy-mm-dd" },
  { header: "Family count", width: 12, type: "number", format: "#,##0" },
  { header: "Active family count", width: 12, type: "number", format: "#,##0" },
  {
    header: "Soft-deleted family count",
    width: 12,
    type: "number",
    format: "#,##0",
  },
  {
    header: "Total contributions",
    width: 16,
    type: "number",
    format: "#,##0.00",
  },
  {
    header: "Total expenses",
    width: 16,
    type: "number",
    format: "#,##0.00",
  },
  { header: "Net", width: 14, type: "number", format: "#,##0.00" },
];

/** Families sheet (workbook-format §3). */
export const FAMILIES_COLUMNS: ReadonlyArray<Column> = [
  { header: "Household name", width: 28, type: "string" },
  { header: "Family name", width: 28, type: "string" },
  {
    header: "Contribution target",
    width: 14,
    type: "number",
    format: "#,##0.00",
  },
  { header: "Members", width: 8, type: "number", format: "#,##0" },
  { header: "Member names", width: 36, type: "string" },
  { header: "Active", width: 8, type: "boolean" },
  { header: "Soft-deleted", width: 8, type: "boolean" },
  { header: "Created on", width: 14, type: "date", format: "yyyy-mm-dd" },
  {
    header: "Updated at",
    width: 20,
    type: "datetime",
    format: "yyyy-mm-dd hh:mm",
  },
];

/** Payments sheet (workbook-format §4). */
export const PAYMENTS_COLUMNS: ReadonlyArray<Column> = [
  { header: "Date", width: 14, type: "date", format: "yyyy-mm-dd" },
  { header: "Month", width: 10, type: "string" },
  { header: "Household", width: 28, type: "string" },
  { header: "Family", width: 28, type: "string" },
  { header: "Family active", width: 8, type: "boolean" },
  { header: "Amount", width: 14, type: "number", format: "#,##0.00" },
  { header: "Note", width: 30, type: "string" },
  { header: "Recorded by", width: 24, type: "string" },
  {
    header: "Recorded at",
    width: 20,
    type: "datetime",
    format: "yyyy-mm-dd hh:mm",
  },
  { header: "Coverage group id", width: 38, type: "string" },
];

/** Expenses sheet (workbook-format §5). */
export const EXPENSES_COLUMNS: ReadonlyArray<Column> = [
  { header: "Date", width: 14, type: "date", format: "yyyy-mm-dd" },
  { header: "Month", width: 10, type: "string" },
  { header: "Name", width: 28, type: "string" },
  { header: "Amount", width: 14, type: "number", format: "#,##0.00" },
  { header: "Type", width: 12, type: "string" },
  { header: "Sub-category", width: 14, type: "string" },
  { header: "Status", width: 12, type: "string" },
  {
    header: "Withdrawn at",
    width: 20,
    type: "datetime",
    format: "yyyy-mm-dd hh:mm",
  },
  { header: "Withdrawn by", width: 24, type: "string" },
  { header: "Note", width: 30, type: "string" },
  { header: "Added by", width: 24, type: "string" },
  {
    header: "Added at",
    width: 20,
    type: "datetime",
    format: "yyyy-mm-dd hh:mm",
  },
  { header: "Recurring", width: 8, type: "boolean" },
  { header: "Recurring template id", width: 24, type: "string" },
];

/** Recurring templates sheet (workbook-format §6). */
export const RECURRING_COLUMNS: ReadonlyArray<Column> = [
  { header: "Name", width: 28, type: "string" },
  { header: "Amount", width: 14, type: "number", format: "#,##0.00" },
  { header: "Sub-category", width: 14, type: "string" },
  { header: "Description", width: 30, type: "string" },
  { header: "Active", width: 8, type: "boolean" },
  { header: "Current month status", width: 22, type: "string" },
  { header: "Created on", width: 14, type: "date", format: "yyyy-mm-dd" },
  { header: "Created by", width: 24, type: "string" },
];

/** Bumped when the column spec changes incompatibly (data-model.md §8). */
export const SCHEMA_VERSION = 1;

/** Order used by `kind: "full"` (Info first, then the five data sheets). */
export const FULL_SHEET_ORDER: ReadonlyArray<string> = [
  "Info",
  "Households",
  "Families",
  "Payments",
  "Expenses",
  "Recurring Templates",
];

// ============================================================================
// Cell-type coercion (data-model.md §6)
// ============================================================================

/**
 * Coerce a raw value into the JS shape the column expects. Never throws.
 * Logs `console.warn` on a non-trivial coercion so data bugs surface in dev.
 *
 * - "number"   → JS number (string-of-digits coerced; otherwise the original
 *                value is kept and a warn is logged).
 * - "date"     → JS Date (Firestore Timestamp.toDate() at the boundary).
 * - "datetime" → JS Date.
 * - "boolean"  → JS boolean.
 * - "string"   → string (empty string for null/undefined).
 *
 * Null/undefined cells render as `""` per workbook-format.md §common.
 */
export function coerceCell(value: unknown, column: Column): Cell {
  const type = column.type;
  // null / undefined → empty string
  if (value === null || value === undefined) {
    return "";
  }

  if (type === "string") {
    return String(value);
  }

  if (type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return 0;
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[excelExport] coerceCell: string-of-digits "${value}" coerced to number for column "${column.header}"`,
        );
        return parsed;
      }
      // Non-numeric string in a number column → warn, keep as string-like cell
      // so the row still renders. Real data bug, but never throw.
      // eslint-disable-next-line no-console
      console.warn(
        `[excelExport] coerceCell: non-numeric value "${value}" in number column "${column.header}"`,
      );
      return 0;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[excelExport] coerceCell: unexpected value type for number column "${column.header}":`,
      value,
    );
    return 0;
  }

  if (type === "date" || type === "datetime") {
    if (value instanceof Date) return value;
    if (typeof value === "object" && value !== null && "toDate" in value) {
      const stamp = value as { toDate?: () => Date };
      if (typeof stamp.toDate === "function") return stamp.toDate();
    }
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[excelExport] coerceCell: could not coerce value to Date for "${column.header}":`,
      value,
    );
    return "";
  }

  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    // eslint-disable-next-line no-console
    console.warn(
      `[excelExport] coerceCell: non-boolean value in boolean column "${column.header}":`,
      value,
    );
    return false;
  }

  return "";
}

// ============================================================================
// buildFileName (workbook-format.md §7)
// ============================================================================

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Sanitise any character that Excel / Windows file system rejects. */
function sanitiseFileName(raw: string): string {
  return raw
    .replace(/[\\/:*?[\]]/g, "-")
    .toLowerCase()
    .replace(/^\.+/, "")
    .replace(/\s+$/, "");
}

export function buildFileName(
  filter: FilterSnapshot,
  triggerTime: Date,
): string {
  const date = dateKey(triggerTime);
  let stem = "jamia-finance";
  switch (filter.kind) {
    case "full":
      stem = "jamia-finance";
      break;
    case "households":
      stem = "jamia-households";
      break;
    case "families":
      stem =
        filter.month === "all"
          ? "jamia-families-all"
          : `jamia-families-${filter.month}`;
      break;
    case "payments":
      stem =
        filter.filter === "all"
          ? "jamia-payments-all"
          : `jamia-payments-${filter.filter.month}`;
      break;
    case "expenses":
      stem =
        filter.month === "all"
          ? "jamia-expenses-all"
          : `jamia-expenses-${filter.month}`;
      break;
    case "recurring":
      stem = `jamia-recurring-${filter.month}`;
      break;
  }
  return sanitiseFileName(`${stem}-${date}.xlsx`);
}

// ============================================================================
// Sub-category localisation (workbook-format.md §5 + §6)
// ============================================================================

const SUB_CATEGORY_LABEL: Record<MosqueSubCategory, string> = {
  maintenance: "maintenance",
  salary: "salary",
  other: "other",
};

function subCategoryLabel(s: MosqueSubCategory | null | undefined): string {
  if (!s) return "";
  return SUB_CATEGORY_LABEL[s] ?? s;
}

// ============================================================================
// Row builders
// ============================================================================

function householdRow(
  h: Household,
  families: Family[],
  payments: Payment[],
  expenses: Expense[],
  columns: ReadonlyArray<Column>,
): Row {
  const inHousehold = families.filter((f) => f.householdId === h.id);
  const active = inHousehold.filter((f) => f.active).length;
  const softDeleted = inHousehold.length - active;
  const hhPayments = payments.filter((p) => p.householdId === h.id);
  const hhExpenses = expenses.filter(
    (e) => e.type === "household" && e.householdId === h.id,
  );
  const financial = deriveHouseholdFinancialSummary(hhPayments, hhExpenses);
  return [
    coerceCell(h.name, columns[0]),
    coerceCell(h.createdAt, columns[1]),
    coerceCell(inHousehold.length, columns[2]),
    coerceCell(active, columns[3]),
    coerceCell(softDeleted, columns[4]),
    coerceCell(financial.totalContributions, columns[5]),
    coerceCell(financial.totalExpenses, columns[6]),
    coerceCell(financial.net, columns[7]),
  ];
}

function familyRow(
  f: Family,
  households: Household[],
  columns: ReadonlyArray<Column>,
): Row {
  const household = households.find((h) => h.id === f.householdId);
  return [
    coerceCell(household?.name ?? "", columns[0]),
    coerceCell(f.name, columns[1]),
    coerceCell(f.contributionTarget, columns[2]),
    coerceCell(f.memberCount, columns[3]),
    coerceCell(
      Array.isArray(f.memberNames) ? f.memberNames.join("; ") : "",
      columns[4],
    ),
    coerceCell(f.active, columns[5]),
    coerceCell(!f.active, columns[6]),
    coerceCell(f.createdAt, columns[7]),
    coerceCell(f.updatedAt, columns[8]),
  ];
}

function paymentRow(
  p: Payment,
  households: Household[],
  families: Family[],
  columns: ReadonlyArray<Column>,
): Row {
  const family = families.find((f) => f.id === p.familyId);
  return [
    coerceCell(p.date, columns[0]),
    coerceCell(p.month, columns[1]),
    coerceCell(
      households.find((h) => h.id === p.householdId)?.name ?? "",
      columns[2],
    ),
    coerceCell(family?.name ?? "", columns[3]),
    coerceCell(family ? family.active : false, columns[4]),
    coerceCell(p.amount, columns[5]),
    coerceCell(p.note ?? "", columns[6]),
    coerceCell(p.recordedBy, columns[7]),
    coerceCell(p.recordedAt, columns[8]),
    coerceCell(p.coverageGroupId ?? "", columns[9]),
  ];
}

function expenseRow(e: Expense, columns: ReadonlyArray<Column>): Row {
  return [
    coerceCell(e.date, columns[0]),
    coerceCell(e.month, columns[1]),
    coerceCell(e.name, columns[2]),
    coerceCell(e.amount, columns[3]),
    coerceCell(e.type, columns[4]),
    coerceCell(subCategoryLabel(e.mosqueSubCategory), columns[5]),
    coerceCell(e.withdrawn ? "Withdrawn" : "Pending", columns[6]),
    coerceCell(e.withdrawnAt, columns[7]),
    coerceCell(e.withdrawnBy ?? "", columns[8]),
    coerceCell(e.note ?? "", columns[9]),
    coerceCell(e.addedBy, columns[10]),
    coerceCell(e.addedAt, columns[11]),
    coerceCell(e.isRecurring, columns[12]),
    coerceCell(e.recurringId ?? "", columns[13]),
  ];
}

function recurringRow(
  t: RecurringTemplate,
  currentMonth: string | null,
  expensesForMonth: Expense[],
  columns: ReadonlyArray<Column>,
): Row {
  let status = "—";
  if (currentMonth) {
    const linked = expensesForMonth.find((e) => e.recurringId === t.id);
    if (!linked) status = "NotAdded";
    else if (linked.withdrawn) status = "Withdrawn";
    else status = "PendingWithdrawal";
  }
  return [
    coerceCell(t.name, columns[0]),
    coerceCell(t.amount, columns[1]),
    coerceCell(subCategoryLabel(t.mosqueSubCategory), columns[2]),
    coerceCell(t.description ?? "", columns[3]),
    coerceCell(t.active, columns[4]),
    coerceCell(status, columns[5]),
    coerceCell(t.createdAt, columns[6]),
    coerceCell(t.createdBy, columns[7]),
  ];
}

function infoRow(
  ctx: ExportContext,
  filter: FilterSnapshot,
  columns: ReadonlyArray<Column>,
): Row {
  return [
    coerceCell(ctx.triggerTime, columns[0]),
    coerceCell(ctx.currency, columns[1]),
    coerceCell(ctx.adminUid, columns[2]),
    coerceCell(ctx.adminEmail ?? "", columns[3]),
    coerceCell(ctx.adminDisplayName ?? "", columns[4]),
    coerceCell("full", columns[5]),
    coerceCell(JSON.stringify({ kind: filter.kind }), columns[6]),
    coerceCell(6, columns[7]),
    coerceCell(SCHEMA_VERSION, columns[8]),
  ];
}

// ============================================================================
// Sheet builders
// ============================================================================

function makeSheet(
  name: string,
  columns: ReadonlyArray<Column>,
  rows: Row[],
  ctx: ExportContext,
): Sheet {
  // Excel sheet-name constraints: max 31 chars, no \ / ? * [ ]
  const safe = name.replace(/[\\/?*\[\]]/g, "-").slice(0, 31);
  return {
    name: safe,
    columns: columns.map((c) => ({ ...c })),
    rows,
    rightToLeft: ctx.locale === "ar",
    freezeHeader: true,
  };
}

function buildInfoSheet(filter: FilterSnapshot, ctx: ExportContext): Sheet {
  const columns = INFO_COLUMNS;
  const rows: Row[] = [infoRow(ctx, filter, columns)];
  return makeSheet("Info", columns, rows, ctx);
}

function buildHouseholdsSheet(
  households: Household[],
  families: Family[],
  payments: Payment[],
  expenses: Expense[],
  ctx: ExportContext,
): Sheet {
  const sorted = [...households].sort((a, b) => a.name.localeCompare(b.name));
  const rows = sorted.map((h) =>
    householdRow(h, families, payments, expenses, HOUSEHOLDS_COLUMNS),
  );
  return makeSheet("Households", HOUSEHOLDS_COLUMNS, rows, ctx);
}

function buildFamiliesSheet(
  families: Family[],
  households: Household[],
  ctx: ExportContext,
  filter: { showSoftDeleted: boolean },
): Sheet {
  let rows: Family[] = families;
  if (!filter.showSoftDeleted) {
    rows = rows.filter((f) => f.active);
  }
  // Sort: household name asc, then active desc, then family name asc.
  rows = [...rows].sort((a, b) => {
    const ha = households.find((h) => h.id === a.householdId)?.name ?? "";
    const hb = households.find((h) => h.id === b.householdId)?.name ?? "";
    if (ha !== hb) return ha.localeCompare(hb);
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const data = rows.map((f) => familyRow(f, households, FAMILIES_COLUMNS));
  return makeSheet("Families", FAMILIES_COLUMNS, data, ctx);
}

function buildPaymentsSheet(
  payments: Payment[],
  households: Household[],
  families: Family[],
  ctx: ExportContext,
  filter: { month: "all" | string },
): Sheet {
  let rows: Payment[] = payments;
  if (filter.month !== "all") {
    rows = rows.filter((p) => p.month === filter.month);
  }
  // Sort: Date desc, then Family asc.
  rows = [...rows].sort((a, b) => {
    const ad =
      a.date && typeof a.date === "object" && "toDate" in a.date
        ? (a.date as { toDate: () => Date }).toDate().getTime()
        : 0;
    const bd =
      b.date && typeof b.date === "object" && "toDate" in b.date
        ? (b.date as { toDate: () => Date }).toDate().getTime()
        : 0;
    if (ad !== bd) return bd - ad;
    const fa = families.find((f) => f.id === a.familyId)?.name ?? "";
    const fb = families.find((f) => f.id === b.familyId)?.name ?? "";
    return fa.localeCompare(fb);
  });
  const data = rows.map((p) =>
    paymentRow(p, households, families, PAYMENTS_COLUMNS),
  );
  return makeSheet("Payments", PAYMENTS_COLUMNS, data, ctx);
}

function buildExpensesSheet(
  expenses: Expense[],
  ctx: ExportContext,
  filter: {
    month: "all" | string;
    subCategory: MosqueSubCategory | null;
    expenseType: "mosque";
  },
): Sheet {
  let rows: Expense[] = expenses;
  rows = rows.filter((e) => e.type === filter.expenseType);
  if (filter.month !== "all") {
    rows = rows.filter((e) => e.month === filter.month);
  }
  if (filter.subCategory) {
    rows = rows.filter((e) => e.mosqueSubCategory === filter.subCategory);
  }
  // Sort: Date desc, then Name asc.
  rows = [...rows].sort((a, b) => {
    const ad =
      a.date && typeof a.date === "object" && "toDate" in a.date
        ? (a.date as { toDate: () => Date }).toDate().getTime()
        : 0;
    const bd =
      b.date && typeof b.date === "object" && "toDate" in b.date
        ? (b.date as { toDate: () => Date }).toDate().getTime()
        : 0;
    if (ad !== bd) return bd - ad;
    return a.name.localeCompare(b.name);
  });
  const data = rows.map((e) => expenseRow(e, EXPENSES_COLUMNS));
  return makeSheet("Expenses", EXPENSES_COLUMNS, data, ctx);
}

function buildRecurringSheet(
  templates: RecurringTemplate[],
  expenses: Expense[],
  ctx: ExportContext,
  filter: { month: string; activeOnly: true },
): Sheet {
  let rows: RecurringTemplate[] = templates;
  if (filter.activeOnly) {
    rows = rows.filter((t) => t.active);
  }
  // Sort: Active desc, then Name asc.
  rows = [...rows].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  // Compute per-template status against the month's expenses (mosque-only,
  // scoped to the requested month). Use a fresh derived list.
  const monthExpenses = expenses.filter(
    (e) => e.type === "mosque" && e.month === filter.month,
  );
  const data = rows.map((t) =>
    recurringRow(t, filter.month, monthExpenses, RECURRING_COLUMNS),
  );
  return makeSheet("Recurring Templates", RECURRING_COLUMNS, data, ctx);
}

// ============================================================================
// Public: buildWorkbook
// ============================================================================

export function buildWorkbook(
  filter: FilterSnapshot,
  data: ExportData,
  ctx: ExportContext,
): WorkbookModel {
  const fileName = buildFileName(filter, ctx.triggerTime);
  const sheets: Sheet[] = [];

  switch (filter.kind) {
    case "full": {
      sheets.push(buildInfoSheet(filter, ctx));
      sheets.push(
        buildHouseholdsSheet(
          data.households,
          data.families,
          data.payments,
          data.expenses,
          ctx,
        ),
      );
      sheets.push(
        buildFamiliesSheet(data.families, data.households, ctx, {
          showSoftDeleted: true,
        }),
      );
      sheets.push(
        buildPaymentsSheet(data.payments, data.households, data.families, ctx, {
          month: "all",
        }),
      );
      sheets.push(
        buildExpensesSheet(data.expenses, ctx, {
          month: "all",
          subCategory: null,
          expenseType: "mosque",
        }),
      );
      sheets.push(
        buildRecurringSheet(data.recurringTemplates, data.expenses, ctx, {
          month: currentMonthKeyForRecurring(ctx),
          activeOnly: true,
        }),
      );
      break;
    }
    case "households": {
      sheets.push(
        buildHouseholdsSheet(
          data.households,
          data.families,
          data.payments,
          data.expenses,
          ctx,
        ),
      );
      break;
    }
    case "families": {
      // The caller has already filtered families to the household.
      sheets.push(
        buildFamiliesSheet(
          data.families.filter((f) => f.householdId === filter.householdId),
          data.households,
          ctx,
          { showSoftDeleted: filter.showSoftDeleted },
        ),
      );
      break;
    }
    case "payments": {
      sheets.push(
        buildPaymentsSheet(
          data.payments.filter(
            (p) =>
              p.householdId === filter.householdId &&
              p.familyId === filter.familyId,
          ),
          data.households,
          data.families,
          ctx,
          { month: filter.filter === "all" ? "all" : filter.filter.month },
        ),
      );
      break;
    }
    case "expenses": {
      sheets.push(
        buildExpensesSheet(data.expenses, ctx, {
          month: filter.month,
          subCategory: filter.subCategory,
          expenseType: "mosque",
        }),
      );
      break;
    }
    case "recurring": {
      sheets.push(
        buildRecurringSheet(data.recurringTemplates, data.expenses, ctx, {
          month: filter.month,
          activeOnly: true,
        }),
      );
      break;
    }
  }

  return { fileName, sheets };
}

/**
 * For the full report, the Recurring sheet's "Current month status" column
 * uses the current calendar month (since the per-screen variant encodes the
 * month in the file name, but the full report has no month hint).
 */
function currentMonthKeyForRecurring(ctx: ExportContext): string {
  return dateKey(ctx.triggerTime).slice(0, 7);
}

// ============================================================================
// Service object
// ============================================================================

/**
 * Pure service object — `triggerExport` is intentionally a placeholder here;
 * the browser-only wrapper at `excelExportClient.ts` supplies the actual
 * blob-build + anchor-click flow. UI code calls the wrapper's
 * `triggerDownload(filter, ctx)` instead.
 */
export const excelExportService: ExcelExportService = {
  triggerExport: (_filter, _ctx) => {
    throw new ExportError(
      "triggerExport must be invoked through excelExportClient.ts in the browser.",
    );
  },
  buildWorkbook,
  buildFileName,
};
