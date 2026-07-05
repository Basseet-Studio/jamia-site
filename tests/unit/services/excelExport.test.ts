/**
 * Unit tests for the pure excelExport module.
 *
 * Covers:
 *  - buildFileName for every filter variant (T018 + T026 + T028).
 *  - buildWorkbook sheet ordering + headers + Info row shape (T019).
 *  - UTF-8 + comma/quote/newline round-trip (T020).
 *  - per-screen filter honour (T027).
 *  - soft-delete inclusion rules (T037).
 *  - numeric type preservation (T038).
 *  - rightToLeft per locale (T039).
 *  - empty-sheet behaviour (T040).
 *  - coerceCell warn-on-string-of-digits (T041).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Timestamp } from "firebase/firestore";

import {
  buildFileName,
  buildWorkbook,
  coerceCell,
  HOUSEHOLDS_COLUMNS,
  FAMILIES_COLUMNS,
  PAYMENTS_COLUMNS,
  EXPENSES_COLUMNS,
  RECURRING_COLUMNS,
  INFO_COLUMNS,
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

function emptyData(): ExportData {
  return {
    households: [],
    families: [],
    payments: [],
    expenses: [],
    recurringTemplates: [],
  };
}

const hh1: Household = {
  id: "hh1",
  name: "North Ward",
  createdAt: ts(new Date("2026-01-01T00:00:00Z")),
  createdBy: "admin-uid",
  active: true,
  deletedAt: null,
  deletedBy: null,
};

const hh2: Household = {
  id: "hh2",
  name: "South Ward",
  createdAt: ts(new Date("2026-02-01T00:00:00Z")),
  createdBy: "admin-uid",
  active: true,
  deletedAt: null,
  deletedBy: null,
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

const paymentKhan: Payment = {
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

const paymentSoftDeleted: Payment = {
  ...paymentKhan,
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

function fullData(): ExportData {
  return {
    households: [hh1, hh2],
    families: [famActive, famSoftDeleted],
    payments: [paymentKhan, paymentSoftDeleted],
    expenses: [expense1],
    recurringTemplates: [tpl1],
  };
}

// ============================================================================
// T018 — buildFileName for kind:"full"
// ============================================================================

describe("buildFileName — kind:full", () => {
  it("returns jamia-finance-{YYYY-MM-DD}.xlsx", () => {
    expect(buildFileName({ kind: "full" }, FIXED_DATE)).toBe(
      "jamia-finance-2026-06-29.xlsx",
    );
  });
});

// ============================================================================
// T026 — buildFileName for every per-screen variant
// ============================================================================

describe("buildFileName — per-screen variants", () => {
  it("households", () => {
    expect(buildFileName({ kind: "households" }, FIXED_DATE)).toBe(
      "jamia-households-2026-06-29.xlsx",
    );
  });
  it("families / all", () => {
    expect(
      buildFileName(
        {
          kind: "families",
          householdId: "hh1",
          showSoftDeleted: false,
          month: "all",
        },
        FIXED_DATE,
      ),
    ).toBe("jamia-families-all-2026-06-29.xlsx");
  });
  it("families / month", () => {
    expect(
      buildFileName(
        {
          kind: "families",
          householdId: "hh1",
          showSoftDeleted: true,
          month: "2026-06",
        },
        FIXED_DATE,
      ),
    ).toBe("jamia-families-2026-06-2026-06-29.xlsx");
  });
  it("payments / all", () => {
    expect(
      buildFileName(
        {
          kind: "payments",
          householdId: "hh1",
          familyId: "fam1",
          filter: "all",
        },
        FIXED_DATE,
      ),
    ).toBe("jamia-payments-all-2026-06-29.xlsx");
  });
  it("payments / month", () => {
    expect(
      buildFileName(
        {
          kind: "payments",
          householdId: "hh1",
          familyId: "fam1",
          filter: { month: "2026-06" },
        },
        FIXED_DATE,
      ),
    ).toBe("jamia-payments-2026-06-2026-06-29.xlsx");
  });
  it("expenses / all", () => {
    expect(
      buildFileName(
        { kind: "expenses", month: "all", subCategory: null, expenseType: "mosque" },
        FIXED_DATE,
      ),
    ).toBe("jamia-expenses-all-2026-06-29.xlsx");
  });
  it("expenses / month", () => {
    expect(
      buildFileName(
        {
          kind: "expenses",
          month: "2026-06",
          subCategory: "maintenance",
          expenseType: "mosque",
        },
        FIXED_DATE,
      ),
    ).toBe("jamia-expenses-2026-06-2026-06-29.xlsx");
  });
  it("recurring", () => {
    expect(
      buildFileName({ kind: "recurring", month: "2026-06", activeOnly: true }, FIXED_DATE),
    ).toBe("jamia-recurring-2026-06-2026-06-29.xlsx");
  });
});

// ============================================================================
// T028 — switching month produces a distinct file name within the same day
// ============================================================================

describe("buildFileName — filter hint changes the name", () => {
  it("expenses month-2026-05 vs 2026-06 are distinct", () => {
    const a = buildFileName(
      {
        kind: "expenses",
        month: "2026-05",
        subCategory: null,
        expenseType: "mosque",
      },
      FIXED_DATE,
    );
    const b = buildFileName(
      {
        kind: "expenses",
        month: "2026-06",
        subCategory: null,
        expenseType: "mosque",
      },
      FIXED_DATE,
    );
    expect(a).not.toBe(b);
    expect(a).toBe("jamia-expenses-2026-05-2026-06-29.xlsx");
    expect(b).toBe("jamia-expenses-2026-06-2026-06-29.xlsx");
  });
});

// ============================================================================
// T019 — buildWorkbook full report: sheet order, Info row, headers, empties
// ============================================================================

describe("buildWorkbook — kind:full", () => {
  it("emits six sheets in the canonical order", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    expect(wb.sheets.map((s) => s.name)).toEqual([
      "Info",
      "Households",
      "Families",
      "Payments",
      "Expenses",
      "Recurring Templates",
    ]);
    expect(wb.fileName).toBe("jamia-finance-2026-06-29.xlsx");
  });

  it("Info sheet has exactly one row with the right columns", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const info = wb.sheets[0];
    expect(info.name).toBe("Info");
    expect(info.columns.map((c) => c.header)).toEqual(
      INFO_COLUMNS.map((c) => c.header),
    );
    expect(info.rows.length).toBe(1);
    const row = info.rows[0];
    expect(row[2]).toBe("admin-uid");
    expect(row[1]).toBe("AED");
    expect(row[5]).toBe("full");
    expect(row[7]).toBe(6); // sheet count
    expect(row[8]).toBe(1); // schema version
  });

  it("every sheet has a header row even with empty data", () => {
    const wb = buildWorkbook({ kind: "full" }, emptyData(), ctxFixture());
    for (const sheet of wb.sheets) {
      expect(sheet.columns.length).toBeGreaterThan(0);
      // data rows can be 0; info always has 1
      if (sheet.name === "Info") {
        expect(sheet.rows.length).toBe(1);
      } else {
        expect(sheet.rows.length).toBe(0);
      }
    }
  });

  it("Households sheet counts active / soft-deleted families correctly", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const hh = wb.sheets.find((s) => s.name === "Households")!;
    // Sorted by name ascending: North, South. North has 1 active + 1 soft.
    expect(hh.rows.length).toBe(2);
    expect(hh.rows[0][2]).toBe(2); // family count
    expect(hh.rows[0][3]).toBe(1); // active
    expect(hh.rows[0][4]).toBe(1); // soft-deleted
  });

  it("Payments Amount column is typed number", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const pay = wb.sheets.find((s) => s.name === "Payments")!;
    expect(pay.columns[5].type).toBe("number");
    // Amount cells are JS numbers, not strings.
    for (const row of pay.rows) {
      expect(typeof row[5]).toBe("number");
    }
  });

  it("Families sheet sort: household asc, active desc, family asc", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const fam = wb.sheets.find((s) => s.name === "Families")!;
    // hh1 contains Khan (active) and Soft Deleted. Active first.
    expect(fam.rows[0][1]).toBe("Khan Family");
    expect(fam.rows[1][1]).toBe("Soft Deleted Family");
  });

  it("rightToLeft is false for English locale, true for Arabic", () => {
    const wbEn = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const wbAr = buildWorkbook(
      { kind: "full" },
      fullData(),
      ctxFixture({ locale: "ar" }),
    );
    expect(wbEn.sheets.every((s) => s.rightToLeft === false)).toBe(true);
    expect(wbAr.sheets.every((s) => s.rightToLeft === true)).toBe(true);
  });
});

// ============================================================================
// T020 — UTF-8 + comma/quote/newline round-trip
// ============================================================================

describe("buildWorkbook — UTF-8 round-trip (T020)", () => {
  it("Arabic, Malayalam, Tamil, comma+quote+newline round-trip", () => {
    const data = fullData();
    const tricky: Payment = {
      ...paymentKhan,
      note: 'محمد, "the mason"\nഫാസിൽ, "kerala"\nபாசில், "tamil"',
    };
    const wb = buildWorkbook({ kind: "full" }, { ...data, payments: [tricky] }, ctxFixture());
    const pay = wb.sheets.find((s) => s.name === "Payments")!;
    expect(pay.rows[0][6]).toBe(tricky.note);
  });

  it("Arabic + Malayalam + Tamil in family name round-trip", () => {
    const data = fullData();
    const arabicFam: Family = {
      ...famActive,
      name: "محمد",
      memberNames: ["ഫാസിൽ", "பாசில்"],
    };
    const wb = buildWorkbook({ kind: "full" }, { ...data, families: [arabicFam] }, ctxFixture());
    const fam = wb.sheets.find((s) => s.name === "Families")!;
    expect(fam.rows[0][1]).toBe("محمد");
    expect(fam.rows[0][4]).toBe("ഫാസിൽ; பாசில்");
  });
});

// ============================================================================
// T027 — per-screen filter honour
// ============================================================================

describe("buildWorkbook — per-screen filters honoured", () => {
  it("expenses with month + subCategory excludes non-matching rows", () => {
    const wb = buildWorkbook(
      {
        kind: "expenses",
        month: "2026-06",
        subCategory: "maintenance",
        expenseType: "mosque",
      },
      fullData(),
      ctxFixture(),
    );
    const exp = wb.sheets[0];
    expect(exp.name).toBe("Expenses");
    expect(exp.rows.length).toBe(1); // only the maintenance expense
    expect(exp.rows[0][2]).toBe("Electricity");
  });

  it("expenses / all with no sub-category returns every mosque expense", () => {
    const wb = buildWorkbook(
      { kind: "expenses", month: "all", subCategory: null, expenseType: "mosque" },
      fullData(),
      ctxFixture(),
    );
    expect(wb.sheets[0].rows.length).toBe(1);
  });

  it("payments / month filters by month", () => {
    const wb = buildWorkbook(
      {
        kind: "payments",
        householdId: "hh1",
        familyId: "fam1",
        filter: { month: "2026-06" },
      },
      fullData(),
      ctxFixture(),
    );
    const pay = wb.sheets[0];
    expect(pay.rows.length).toBe(1); // only Khan's June payment
  });

  it("payments / all returns every payment for the family", () => {
    const wb = buildWorkbook(
      {
        kind: "payments",
        householdId: "hh1",
        familyId: "fam1",
        filter: "all",
      },
      fullData(),
      ctxFixture(),
    );
    expect(wb.sheets[0].rows.length).toBe(1); // only Khan's payment is for fam1
  });

  it("families / showSoftDeleted=false excludes soft-deleted", () => {
    const wb = buildWorkbook(
      {
        kind: "families",
        householdId: "hh1",
        showSoftDeleted: false,
        month: "all",
      },
      fullData(),
      ctxFixture(),
    );
    expect(wb.sheets[0].rows.length).toBe(1);
    expect(wb.sheets[0].rows[0][1]).toBe("Khan Family");
  });

  it("families / showSoftDeleted=true includes soft-deleted", () => {
    const wb = buildWorkbook(
      {
        kind: "families",
        householdId: "hh1",
        showSoftDeleted: true,
        month: "all",
      },
      fullData(),
      ctxFixture(),
    );
    expect(wb.sheets[0].rows.length).toBe(2);
  });

  it("recurring excludes archived templates", () => {
    const wb = buildWorkbook(
      { kind: "recurring", month: "2026-06", activeOnly: true },
      {
        ...fullData(),
        recurringTemplates: [
          tpl1,
          { ...tpl1, id: "t2", name: "Archived", active: false },
        ],
      },
      ctxFixture(),
    );
    const rec = wb.sheets[0];
    expect(rec.rows.length).toBe(1);
    expect(rec.rows[0][0]).toBe("Water");
  });
});

// ============================================================================
// T037 — soft-delete inclusion rules
// ============================================================================

describe("buildWorkbook — soft-delete inclusion rules", () => {
  it("full report Families sheet INCLUDES soft-deleted rows", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const fam = wb.sheets.find((s) => s.name === "Families")!;
    expect(fam.rows.length).toBe(2);
  });

  it("full report Payments sheet INCLUDES soft-deleted-family payments", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const pay = wb.sheets.find((s) => s.name === "Payments")!;
    // Sort: date desc, family asc. Both payments are 2026-06-05 → sort by family asc.
    expect(pay.rows.length).toBe(2);
    expect(pay.rows[0][4]).toBe(true); // Khan active
    expect(pay.rows[1][4]).toBe(false); // Soft Deleted NOT active
  });

  it("families / showSoftDeleted=false excludes soft-deleted", () => {
    const wb = buildWorkbook(
      {
        kind: "families",
        householdId: "hh1",
        showSoftDeleted: false,
        month: "all",
      },
      fullData(),
      ctxFixture(),
    );
    expect(wb.sheets[0].rows.length).toBe(1);
  });
});

// ============================================================================
// T038 — numeric type preservation
// ============================================================================

describe("buildWorkbook — numeric type preservation", () => {
  it("every Amount cell on Payments/Expenses/Families/Recurring is a JS number", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const pay = wb.sheets.find((s) => s.name === "Payments")!;
    const exp = wb.sheets.find((s) => s.name === "Expenses")!;
    const fam = wb.sheets.find((s) => s.name === "Families")!;
    const rec = wb.sheets.find((s) => s.name === "Recurring Templates")!;

    for (const row of pay.rows) expect(typeof row[5]).toBe("number");
    for (const row of exp.rows) expect(typeof row[3]).toBe("number");
    for (const row of fam.rows) {
      expect(typeof row[2]).toBe("number"); // Contribution target
      expect(typeof row[3]).toBe("number"); // Members
    }
    for (const row of rec.rows) expect(typeof row[1]).toBe("number");
  });

  it("Info sheet's Sheet count + Schema version are numbers", () => {
    const wb = buildWorkbook({ kind: "full" }, fullData(), ctxFixture());
    const info = wb.sheets[0];
    expect(typeof info.rows[0][7]).toBe("number");
    expect(typeof info.rows[0][8]).toBe("number");
  });
});

// ============================================================================
// T039 — rightToLeft per locale
// ============================================================================

describe("buildWorkbook — rightToLeft per locale", () => {
  it.each(["en", "ml", "ta"] as const)(
    "locale %s → all sheets rightToLeft=false",
    (locale) => {
      const wb = buildWorkbook(
        { kind: "full" },
        fullData(),
        ctxFixture({ locale }),
      );
      expect(wb.sheets.every((s) => s.rightToLeft === false)).toBe(true);
    },
  );
  it("locale ar → all sheets rightToLeft=true", () => {
    const wb = buildWorkbook(
      { kind: "full" },
      fullData(),
      ctxFixture({ locale: "ar" }),
    );
    expect(wb.sheets.every((s) => s.rightToLeft === true)).toBe(true);
  });
});

// ============================================================================
// T040 — empty-sheet behaviour
// ============================================================================

describe("buildWorkbook — empty-sheet behaviour", () => {
  it("empty collections produce header-only sheets", () => {
    const wb = buildWorkbook({ kind: "full" }, emptyData(), ctxFixture());
    for (const sheet of wb.sheets) {
      if (sheet.name === "Info") continue;
      expect(sheet.columns.length).toBeGreaterThan(0);
      expect(sheet.rows.length).toBe(0);
    }
  });

  it("empty per-screen export still emits the single data sheet", () => {
    const wb = buildWorkbook(
      {
        kind: "payments",
        householdId: "hh1",
        familyId: "fam1",
        filter: "all",
      },
      emptyData(),
      ctxFixture(),
    );
    expect(wb.sheets.length).toBe(1);
    expect(wb.sheets[0].name).toBe("Payments");
    expect(wb.sheets[0].rows.length).toBe(0);
  });
});

// ============================================================================
// T041 — coerceCell warning behaviour
// ============================================================================

describe("coerceCell — warn-on-string-of-digits", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("type:number with string-of-digits triggers exactly one warn", () => {
    const col: Column = { header: "Amount", width: 10, type: "number" };
    const result = coerceCell("123.45", col);
    expect(result).toBe(123.45);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("null cell renders as empty string silently", () => {
    const col: Column = { header: "X", width: 10, type: "number" };
    expect(coerceCell(null, col)).toBe("");
    expect(coerceCell(undefined, col)).toBe("");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("JS number cell is passed through with no warn", () => {
    const col: Column = { header: "Amount", width: 10, type: "number" };
    expect(coerceCell(42, col)).toBe(42);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("non-numeric string in number column warns + returns 0", () => {
    const col: Column = { header: "Amount", width: 10, type: "number" };
    expect(coerceCell("not-a-number", col)).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("Firestore Timestamp → JS Date for date column", () => {
    const col: Column = { header: "Created", width: 10, type: "date" };
    const stamp = ts(new Date("2026-06-29T00:00:00Z"));
    const result = coerceCell(stamp, col);
    expect(result).toBeInstanceOf(Date);
  });

  it("string column: null → ''", () => {
    const col: Column = { header: "Name", width: 10, type: "string" };
    expect(coerceCell(null, col)).toBe("");
  });
});

// ============================================================================
// Headers are human-readable (FR-005 sanity check)
// ============================================================================

describe("column specs are human-readable", () => {
  it("no header is a raw Firestore field name", () => {
    const all = [
      ...INFO_COLUMNS,
      ...HOUSEHOLDS_COLUMNS,
      ...FAMILIES_COLUMNS,
      ...PAYMENTS_COLUMNS,
      ...EXPENSES_COLUMNS,
      ...RECURRING_COLUMNS,
    ];
    for (const c of all) {
      // No camelCase, no underscore — these would be raw field names.
      expect(c.header).not.toMatch(/[a-z][A-Z]/);
      expect(c.header).not.toMatch(/_/);
      expect(c.header.length).toBeGreaterThan(0);
    }
  });

  it("every Amount column has format '#,##0.00'", () => {
    expect(PAYMENTS_COLUMNS[5].format).toBe("#,##0.00");
    expect(EXPENSES_COLUMNS[3].format).toBe("#,##0.00");
    expect(FAMILIES_COLUMNS[2].format).toBe("#,##0.00");
    expect(RECURRING_COLUMNS[1].format).toBe("#,##0.00");
  });
});
