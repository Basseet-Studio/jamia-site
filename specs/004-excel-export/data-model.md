# Data Model: Excel Export

**Branch**: `004-excel-export` | **Date**: 2026-06-29
**Source**: `spec.md` Key Entities (L97-103) + `research.md` decisions

Defines the in-memory entities produced and consumed by the export pipeline. The export feature does NOT add any persisted Firestore collections — every entity here lives in browser memory for the duration of a single click → download round trip.

---

## 1. ExportJob (in-memory, transient)

A user-triggered, in-memory operation. Exists for the duration of the click → download flow; not persisted.

| Field | Type | Notes |
|---|---|---|
| `kind` | `ExportKind` | see §2 |
| `triggerTime` | `Date` | set at click time (used for file-name + Info sheet) |
| `filter` | `FilterSnapshot` | see §3 |
| `adminUid` | `string` | from `useAuth().user.uid` |
| `adminEmail` | `string \| null` | from `useAuth().user.email` |
| `adminDisplayName` | `string \| null` | from `useAuth().user.displayName` |
| `fileName` | `string` | derived from `kind` + `filter` + `triggerTime` per `research.md` §8 |
| `status` | `"pending" \| "building" \| "downloaded" \| "failed"` | transitions driven by the export hook |
| `error` | `string \| null` | populated on `failed`; surfaced inline to the admin |

**Lifecycle**:
```
[pending] --hook.start()--> [building] --xlsxBlob ready--> [downloaded] --cleanup hook tears down--> [gone]
                                 └--any throw--> [failed] --inline error--> [gone]
```

**Invariants**:
- A job that is `building` cannot be re-triggered from the same button (`isExporting` is the button's `disabled` flag).
- `error` is non-null iff `status === "failed"`.
- The job holds no Firestore listeners — by the time the file is downloaded, all data is captured in the workbook.

---

## 2. ExportKind (enum)

```ts
type ExportKind =
  | "full"          // "Download full report (Excel)" — all 5 sheets
  | "households"    // per-screen: /households
  | "families"      // per-screen: /households/[id] (with showSoftDeleted flag)
  | "payments"      // per-screen: /households/[hh]/families/[fid]/history
  | "expenses"      // per-screen: /expenses
  | "recurring";    // per-screen: /expenses (recurring section)
```

`"full"` produces 5 data sheets + 1 Info sheet. Every other kind produces 1 data sheet, no Info sheet.

---

## 3. FilterSnapshot (per-screen filters, captured at click time)

```ts
type FilterSnapshot =
  | { kind: "full" }
  | { kind: "households" }                                    // no filter
  | {
      kind: "families";
      householdId: string;
      showSoftDeleted: boolean;                                // NEW toggle (research §2)
      month: string;                                           // "YYYY-MM" or "all"
    }
  | {
      kind: "payments";
      householdId: string;
      familyId: string;
      filter: "all" | { month: string };                       // matches family history page state
    }
  | {
      kind: "expenses";
      month: string | "all";                                   // "all" or "YYYY-MM"
      subCategory: "maintenance" | "salary" | "other" | null;
      expenseType: "mosque";                                   // currently the only option on /expenses
    }
  | {
      kind: "recurring";
      month: string;                                           // for current-month status column
      activeOnly: true;                                        // archived templates go in a separate section
    };
```

**Invariants**:
- Plain serialisable data (no `Timestamp`, no React refs, no Firestore handles).
- Identical shape whether triggered from a screen or a future scheduled-export job.
- The export service does not consult any other state — `FilterSnapshot` is the single source of truth for what rows to include.

---

## 4. Workbook (in-memory representation)

The output of one `ExportJob`. Composed of 1 or more `Sheet`s.

| Field | Type | Notes |
|---|---|---|
| `sheets` | `Sheet[]` | one or more; first is `Info` for `"full"`, otherwise the data sheet is first |
| `fileName` | `string` | matches `ExportJob.fileName` |
| `blob` | `Blob` | produced by `writeExcelFile().toBlob()` |
| `byteSize` | `number` | populated after `blob` is built; shown in the success toast for transparency |

**Invariants**:
- `blob` is non-null iff `status === "downloaded"`.
- `sheets.length` is fixed at construction — the export service does not mutate it mid-build.

---

## 5. Sheet

```ts
interface Sheet {
  name: string;          // Excel sheet name (max 31 chars, no \ / ? * [ ])
  columns: Column[];
  rows: Row[];
  rightToLeft: boolean;  // true for Arabic; matches current admin locale at click time
  freezeHeader: boolean; // always true
}
```

**Invariants**:
- `name` is unique within the workbook.
- `columns.length` is constant across all `rows` (every row has every column, in order).
- Header row is `columns.map(c => c.header)`; the workbook's first row is always headers (frozen).

---

## 6. Column

```ts
interface Column {
  header: string;     // human-readable, localised
  width: number;      // in Excel "characters" (write-excel-file uses char-width units)
  type: "string" | "number" | "date" | "datetime" | "boolean";
  format?: string;    // Excel format string, e.g. "#,##0.00", "yyyy-mm-dd"
}
```

**Type coercion rules** (enforced by `excelExport.ts` at row-build time):
- `"number"` cells MUST be JS `number`. Strings of digits are coerced to `Number`; otherwise the cell is written as the string and a console warning is logged (so a CSV-import bug surfaces immediately).
- `"date"` / `"datetime"` cells MUST be JS `Date`. `Timestamp.toDate()` is called at the boundary.
- `"boolean"` cells render as `true` / `false` (localised by Excel automatically).
- `"string"` cells are written as-is; UTF-8 round-trip is guaranteed.

---

## 7. Row

```ts
type Row = ReadonlyArray<string | number | Date | boolean | null>;
```

`null` cells render as the empty string. The number of cells per row equals `Sheet.columns.length`.

---

## 8. Info sheet (only for `kind: "full"`)

| Column | Type | Notes |
|---|---|---|
| `Export timestamp` | `datetime` | ISO 8601, e.g. `2026-06-29 18:42:11` |
| `Currency` | `string` | from `settings.global.currency` |
| `Admin UID` | `string` | from `useAuth().user.uid` |
| `Admin email` | `string` | may be null for some Firebase Auth providers |
| `Admin display name` | `string` | may be null |
| `Scope` | `string` | always `"full"` for this row |
| `Filter snapshot` | `string` | JSON-serialised `{ kind: "full" }` for future-proofing |
| `Sheet count` | `number` | always 6 (Info + 5 data sheets) |
| `Schema version` | `number` | starts at `1`; bumped if the column spec changes incompatibly |

The Info sheet has a single row.

---

## 9. Per-sheet column specs

The full column spec lives in `contracts/workbook-format.md`. Summary:

### 9.1 Households sheet
`Name`, `Created on (date)`, `Family count (number)`, `Active family count (number)`, `Soft-deleted family count (number)`.

### 9.2 Families sheet
`Household name (string)`, `Family name (string)`, `Contribution target (number)`, `Members (number)`, `Member names (string — semicolon-joined)`, `Active (boolean)`, `Soft-deleted (boolean)`, `Created on (date)`, `Updated at (datetime)`.

### 9.3 Payments sheet
`Date (date)`, `Month (string)`, `Household (string)`, `Family (string)`, `Amount (number)`, `Note (string)`, `Recorded by (string)`, `Recorded at (datetime)`, `Coverage group id (string)`.

### 9.4 Expenses sheet
`Date (date)`, `Month (string)`, `Name (string)`, `Amount (number)`, `Type (string)`, `Sub-category (string)`, `Status (string)`, `Withdrawn at (datetime)`, `Withdrawn by (string)`, `Note (string)`, `Added by (string)`, `Added at (datetime)`, `Recurring (boolean)`, `Recurring template id (string)`.

### 9.5 Recurring templates sheet
`Name (string)`, `Amount (number)`, `Sub-category (string)`, `Description (string)`, `Active (boolean)`, `Current month status (string)`, `Created on (date)`, `Created by (string)`.

**Type rules**:
- All `Amount` cells: `type: "number"`, `format: "#,##0.00"` so Excel `SUM` works (SC-004).
- All `Created on` / `Date` cells: `type: "date"`, `format: "yyyy-mm-dd"`.
- All `…at` / `Recorded at` cells: `type: "datetime"`, `format: "yyyy-mm-dd hh:mm"`.
- All `boolean` cells: rendered as "true" / "false" (Excel translates to ✓/✗ in some locales).
- All `string` cells: written as-is; no truncation, no escaping, no wrapping (FR-007).

---

## 10. Error / edge-case handling

| Case | Behaviour |
|---|---|
| Empty collection | Sheet still appears, header row only, zero data rows (FR-002). |
| Browser missing `Blob` / `URL` | Export button is hidden (research §11). |
| Firestore read throws mid-export | All reads are independent; partial results still produce a workbook with empty sheets for the failed collections. Error toast names the failed collection. |
| Cell value is the wrong type | Coerced + console warning (see §6). Never throws — bad data is a development bug, not a user-facing crash. |
| File name has illegal chars | Sanitised (slashes, colons, asterisks, brackets replaced with `-`). |
| Workbook > 50 MB | Out of scope for v1 — the dataset is "tens of households, hundreds of families, thousands of payments" which is well under 1 MB. |

---

## 11. No new Firestore collections

The export feature adds **zero** new persisted documents. Every entity above lives in browser memory. No new indexes. No new `firestore.rules` entries. The export reads only the five existing collections via the existing service-layer `list*` / `subscribe*` functions.
