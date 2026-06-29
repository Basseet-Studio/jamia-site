/**
 * Round-trip integration test: builds a real .xlsx file in Node using
 * `write-excel-file/node`, then reads it back with `exceljs` (dev-dep) to
 * verify the workbook format contract end-to-end.
 *
 * This is the closest equivalent of the Playwright "open the downloaded file
 * with exceljs" scenario, but runs in plain Node so it doesn't depend on the
 * Firestore / auth emulator + browser session.
 *
 * Covers:
 *  - Six sheets in canonical order for kind:"full" (US1 / T021).
 *  - Headers match the workbook-format spec.
 *  - Numeric columns come back as JS numbers (SC-004).
 *  - SUM on the Payments Amount column returns the expected total.
 *  - UTF-8 + comma / quote / newline round-trip (SC-004 last clause).
 *  - Per-screen filter honour on the resulting file (US2 / T029).
 */
import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import ExcelJS from "exceljs";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import writeXlsxFile from "write-excel-file/node";

import {
  buildFileName,
  buildWorkbook,
  type Column,
  type ExportContext,
  type ExportData,
} from "@/lib/services/excelExport";
import type {
  Expense,
  Family,
  Household,
  Payment,
  RecurringTemplate,
} from "@/lib/types";

function ts(d: Date): Timestamp {
  return Timestamp.fromDate(d);
}

const FIXED_DATE = new Date("2026-06-29T18:42:11Z");

function ctxFixture(over: Partial<ExportContext> = {}): ExportContext {
  return {
    adminUid: "admin-uid",
    adminEmail: "admin@example.com",
    adminDisplayName: "Admin",
    currency: "AED",
    triggerTime: FIXED_DATE,
    locale: "en",
    ...over,
  };
}

const hh: Household = {
  id: "hh1",
  name: "North Ward",
  createdAt: ts(new Date("2026-01-01T00:00:00Z")),
  createdBy: "admin-uid",
};

const famActive: Family = {
  id: "fam1",
  householdId: "hh1",
  name: "Khan Family",
  contributionTarget: 200,
  createdAt: ts(new Date("2026-01-15T00:00:00Z")),
  createdBy: "admin-uid",
  active: true,
  deletedAt: null,
  deletedBy: null,
  memberCount: 2,
  memberNames: ["Ahmed", "Fatima"],
  updatedAt: ts(new Date("2026-03-01T00:00:00Z")),
  updatedBy: "admin-uid",
};

const famSoftDeleted: Family = {
  ...famActive,
  id: "fam2",
  name: "Soft Deleted Family",
  active: false,
  deletedAt: ts(new Date("2026-04-01T00:00:00Z")),
  deletedBy: "admin-uid",
};

const payment1: Payment = {
  id: "p1",
  householdId: "hh1",
  familyId: "fam1",
  amount: 150,
  date: ts(new Date("2026-06-05T00:00:00Z")),
  month: "2026-06",
  note: 'O\'Brien, "the mason"',
  recordedAt: ts(new Date("2026-06-05T01:00:00Z")),
  recordedBy: "admin-uid",
  coverageGroupId: null,
};

const payment2: Payment = {
  ...payment1,
  id: "p2",
  familyId: "fam2",
  amount: 75,
  month: "2026-06",
};

const expense1: Expense = {
  id: "e1",
  name: "Electricity",
  amount: 200,
  date: ts(new Date("2026-06-10T00:00:00Z")),
  month: "2026-06",
  note: null,
  isRecurring: false,
  recurringId: null,
  withdrawn: false,
  withdrawnAt: null,
  withdrawnBy: null,
  addedAt: ts(new Date("2026-06-10T00:00:00Z")),
  addedBy: "admin-uid",
  type: "mosque",
  householdId: null,
  familyId: null,
  mosqueSubCategory: "maintenance",
};

const tpl1: RecurringTemplate = {
  id: "t1",
  name: "Water",
  amount: 50,
  description: "Monthly water bill",
  active: true,
  createdAt: ts(new Date("2026-01-01T00:00:00Z")),
  createdBy: "admin-uid",
  type: "mosque",
  householdId: null,
  familyId: null,
  mosqueSubCategory: "other",
};

const fullData: ExportData = {
  households: [hh],
  families: [famActive, famSoftDeleted],
  payments: [payment1, payment2],
  expenses: [expense1],
  recurringTemplates: [tpl1],
};

/** Same conversion as excelExportClient.toWriterColumns / toWriterSheets. */
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

function materialiseCell(value: unknown, column: Column) {
  const cellObject: {
    value: unknown;
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

function toWriterColumns(columns: ReadonlyArray<Column>) {
  return columns.map((c) => ({
    width: c.width,
    header: { value: c.header, fontWeight: "bold" as const },
  }));
}

function toWriterSheets(workbook: ReturnType<typeof buildWorkbook>) {
  return workbook.sheets.map((sheet) => {
    const headerRow = sheet.freezeHeader
      ? sheet.columns.map((c) => ({
          value: c.header,
          type: String as StringConstructor,
          fontWeight: "bold" as const,
        }))
      : [];
    return {
      data: [
        ...(headerRow.length > 0 ? [headerRow] : []),
        ...sheet.rows.map((r) =>
          r.map((cell, idx) => materialiseCell(cell, sheet.columns[idx])),
        ),
      ],
      sheet: sheet.name,
      columns: toWriterColumns(sheet.columns),
      rightToLeft: sheet.rightToLeft,
      stickyRowsCount: sheet.freezeHeader ? 1 : 0,
      showGridLines: true,
    };
  });
}

async function generateXlsx(
  workbook: ReturnType<typeof buildWorkbook>,
): Promise<Buffer> {
  const sheets = toWriterSheets(workbook);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await writeXlsxFile(sheets as any);
  const nodeResult = result as unknown as {
    toBuffer?: () => Promise<Buffer>;
    toBlob?: () => Promise<Blob>;
  };
  if (typeof nodeResult.toBuffer === "function") {
    return nodeResult.toBuffer();
  }
  // Fallback: toFile already wrote somewhere — but write-excel-file/node has toBuffer.
  const blob = await nodeResult.toBlob!();
  return Buffer.from(await blob.arrayBuffer());
}

async function readXlsx(buffer: Buffer | Uint8Array) {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);
  const out: Array<{
    name: string;
    headers: string[];
    rows: Array<Array<unknown>>;
  }> = [];
  wb.eachSheet((sheet) => {
    const headers: string[] = [];
    const rows: Array<Array<unknown>> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.eachCell((cell) => headers.push(String(cell.value ?? "")));
      } else {
        const arr: Array<unknown> = [];
        row.eachCell((cell) => arr.push(cell.value));
        rows.push(arr);
      }
    });
    out.push({ name: sheet.name, headers, rows });
  });
  return out;
}

// ============================================================================
// Full report round-trip
// ============================================================================

describe("Excel round-trip — full report", () => {
  it("generates six sheets in the canonical order with the right headers", async () => {
    const workbook = buildWorkbook({ kind: "full" }, fullData, ctxFixture());
    expect(workbook.fileName).toBe(buildFileName({ kind: "full" }, FIXED_DATE));
    const buffer = await generateXlsx(workbook);
    const sheets = await readXlsx(buffer);
    expect(sheets.map((s) => s.name)).toEqual([
      "Info",
      "Households",
      "Families",
      "Payments",
      "Expenses",
      "Recurring Templates",
    ]);
    // Headers match the workbook-format spec.
    expect(sheets[0].headers).toContain("Export timestamp");
    expect(sheets[0].headers).toContain("Currency");
    expect(sheets[0].headers).toContain("Admin UID");
    expect(sheets[2].headers).toContain("Family name");
    expect(sheets[3].headers).toContain("Amount");
    expect(sheets[4].headers).toContain("Name");
  });

  it("numeric Amount columns come back as JS numbers", async () => {
    const workbook = buildWorkbook({ kind: "full" }, fullData, ctxFixture());
    const buffer = await generateXlsx(workbook);
    const sheets = await readXlsx(buffer);
    const pay = sheets.find((s) => s.name === "Payments")!;
    const amountColIdx = pay.headers.indexOf("Amount");
    for (const row of pay.rows) {
      expect(typeof row[amountColIdx]).toBe("number");
    }
  });

  it("SUM on Payments Amount equals on-screen total", async () => {
    const workbook = buildWorkbook({ kind: "full" }, fullData, ctxFixture());
    const buffer = await generateXlsx(workbook);
    const sheets = await readXlsx(buffer);
    const pay = sheets.find((s) => s.name === "Payments")!;
    const amountColIdx = pay.headers.indexOf("Amount");
    const sumFromRows = pay.rows.reduce(
      (s, r) =>
        s +
        (typeof r[amountColIdx] === "number" ? (r[amountColIdx] as number) : 0),
      0,
    );
    // 150 + 75 = 225
    expect(sumFromRows).toBe(225);
  });

  it("UTF-8 + comma/quote/newline round-trips intact", async () => {
    const tricky: Payment = {
      ...payment1,
      note: 'محمد, "the mason"\nഫാസിൽ\nபாசில்',
    };
    const workbook = buildWorkbook(
      { kind: "full" },
      { ...fullData, payments: [tricky] },
      ctxFixture(),
    );
    const buffer = await generateXlsx(workbook);
    const sheets = await readXlsx(buffer);
    const pay = sheets.find((s) => s.name === "Payments")!;
    const noteColIdx = pay.headers.indexOf("Note");
    // exceljs joins multiline cells with the same \n we wrote.
    expect(String(pay.rows[0][noteColIdx])).toBe(tricky.note);
  });
});

// ============================================================================
// Per-screen round-trip
// ============================================================================

describe("Excel round-trip — per-screen filters", () => {
  it("expenses / month=2026-06 / subCategory=maintenance yields one row", async () => {
    const workbook = buildWorkbook(
      {
        kind: "expenses",
        month: "2026-06",
        subCategory: "maintenance",
        expenseType: "mosque",
      },
      fullData,
      ctxFixture(),
    );
    const buffer = await generateXlsx(workbook);
    const sheets = await readXlsx(buffer);
    expect(sheets.length).toBe(1);
    expect(sheets[0].name).toBe("Expenses");
    expect(sheets[0].rows.length).toBe(1);
  });

  it("families / showSoftDeleted=false excludes soft-deleted", async () => {
    const workbook = buildWorkbook(
      {
        kind: "families",
        householdId: "hh1",
        showSoftDeleted: false,
        month: "all",
      },
      fullData,
      ctxFixture(),
    );
    const buffer = await generateXlsx(workbook);
    const sheets = await readXlsx(buffer);
    expect(sheets[0].rows.length).toBe(1);
  });

  it("payments for soft-deleted family are still included", async () => {
    const workbook = buildWorkbook(
      {
        kind: "payments",
        householdId: "hh1",
        familyId: "fam2",
        filter: "all",
      },
      fullData,
      ctxFixture(),
    );
    const buffer = await generateXlsx(workbook);
    const sheets = await readXlsx(buffer);
    expect(sheets[0].rows.length).toBe(1);
    expect(sheets[0].rows[0][sheets[0].headers.indexOf("Family active")]).toBe(
      false,
    );
  });
});
